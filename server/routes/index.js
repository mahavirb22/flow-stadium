/**
 * routes/index.js — API Routes
 * ─────────────────────────────
 * All /api/* routes require authentication and rate limiting.
 * /health remains public for liveness probes.
 */

import { Router } from 'express';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { requireAuth } from '../middleware/auth.js';
import { apiLimiter, chatLimiter } from '../middleware/rateLimit.js';
import { validateGroupJoin, validateSeatUpdate } from '../middleware/validate.js';
import cache from '../services/cacheService.js';
import analytics from '../services/analyticsService.js';
import { requireSensorAuth } from '../middleware/sensorAuth.js';
import { zodValidate, IngestCrowdSchema, IngestQueueSchema, IngestMatchSchema, IngestIncidentSchema } from '../schemas.js';

const router = Router();
const db = getFirestore();

const EVENT_ID = process.env.EVENT_ID || 'demo-event-001';

// ─── Public Routes ──────────────────────────────────────────────

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Auth + Rate Limit for all /api/* ───────────────────────────

router.use('/api', apiLimiter);
router.use('/api', requireAuth);

// ─── GET /api/queues ────────────────────────────────────────────
// Returns concession stand queue states sorted by waitMins ascending.

router.get('/api/queues', async (req, res) => {
  try {
    const eventId = req.query.eventId || EVENT_ID;
    const cacheKey = `queues:${eventId}`;

    // Cache-first lookup
    const cached = cache.get(cacheKey);
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.json(cached);
    }

    const eventDoc = db.collection('queue_states').doc(eventId);
    const subcollections = await eventDoc.listCollections();

    const queues = [];
    for (const subcol of subcollections) {
      const snap = await subcol.doc('latest').get();
      if (snap.exists) {
        const data = snap.data();
        queues.push({
          standId: subcol.id,
          standName: data.standName ?? subcol.id,
          waitMins: data.waitMins ?? 0,
          capacity: data.capacity ?? 0,
          updatedAt: data.updatedAt ?? null,
        });
      }
    }

    queues.sort((a, b) => a.waitMins - b.waitMins);

    const payload = { eventId, queues };
    cache.set(cacheKey, payload);
    res.set('X-Cache', 'MISS');
    res.json(payload);
  } catch (err) {
    console.error('[Routes] /api/queues error:', err.message);
    res.status(500).json({ error: 'Failed to fetch queue data' });
  }
});

// ─── GET /api/crowd ─────────────────────────────────────────────
// Returns crowd zone density readings.

router.get('/api/crowd', async (req, res) => {
  try {
    const eventId = req.query.eventId || EVENT_ID;
    const cacheKey = `crowd:${eventId}`;

    const cached = cache.get(cacheKey);
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.json(cached);
    }

    const eventDoc = db.collection('crowd_zones').doc(eventId);
    const subcollections = await eventDoc.listCollections();

    const zones = [];
    for (const subcol of subcollections) {
      const snap = await subcol.doc('latest').get();
      if (snap.exists) {
        const data = snap.data();
        zones.push({
          zone: subcol.id,
          density: data.density ?? 0,
          updatedAt: data.updatedAt ?? null,
        });
      }
    }

    zones.sort((a, b) => b.density - a.density);

    const payload = { eventId, zones };
    cache.set(cacheKey, payload);
    res.set('X-Cache', 'MISS');
    res.json(payload);
  } catch (err) {
    console.error('[Routes] /api/crowd error:', err.message);
    res.status(500).json({ error: 'Failed to fetch crowd data' });
  }
});

// ─── GET /api/cache/stats ───────────────────────────────────────
// Returns cache hit/miss statistics for monitoring.

router.get('/api/cache/stats', (_req, res) => {
  res.json(cache.stats());
});

// ─── GET /api/analytics ─────────────────────────────────────────
// Returns live aggregated metrics for the Analytics dashboard.

router.get('/api/analytics', (_req, res) => {
  res.json(analytics.getMetrics());
});

// ─── GET /api/analytics/timeline ────────────────────────────────
// Returns time-series data for the last N minutes.

router.get('/api/analytics/timeline', (req, res) => {
  const minutes = parseInt(req.query.minutes, 10) || 10;
  res.json(analytics.getTimeline(minutes));
});

// ─── POST /api/group/join ───────────────────────────────────────
// Adds the authenticated user to a group's members list.

router.post('/api/group/join', validateGroupJoin, async (req, res) => {
  try {
    const { groupId, displayName } = req.body;
    const uid = req.user.uid;

    const groupRef = db.collection('groups').doc(groupId);
    const groupSnap = await groupRef.get();

    if (!groupSnap.exists) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const groupData = groupSnap.data();
    const memberUids = groupData.memberUids || [];

    // Prevent duplicate join
    if (memberUids.includes(uid)) {
      return res.status(409).json({ error: 'Already a member of this group' });
    }

    // Add to both memberUids array and members objects
    await groupRef.update({
      memberUids: FieldValue.arrayUnion(uid),
      members: FieldValue.arrayUnion({
        uid,
        name: displayName || uid,
        section: null,
        nearExit: false,
      }),
    });

    res.status(200).json({ success: true, groupId, uid });
  } catch (err) {
    console.error('[Routes] /api/group/join error:', err.message);
    res.status(500).json({ error: 'Failed to join group' });
  }
});

// ─── POST /api/group/location ───────────────────────────────────
// Updates the authenticated user's nearExit field in their group.

router.post('/api/group/location', validateSeatUpdate, async (req, res) => {
  try {
    const { groupId, nearExit } = req.body;
    const uid = req.user.uid;

    const groupRef = db.collection('groups').doc(groupId);
    const groupSnap = await groupRef.get();

    if (!groupSnap.exists) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const groupData = groupSnap.data();
    const members = groupData.members || [];

    // Check membership
    const memberIndex = members.findIndex((m) => m.uid === uid);
    if (memberIndex === -1) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    // Update the member's nearExit field
    members[memberIndex] = {
      ...members[memberIndex],
      nearExit: Boolean(nearExit),
    };

    await groupRef.update({ members });

    res.status(200).json({
      success: true,
      groupId,
      uid,
      nearExit: Boolean(nearExit),
    });
  } catch (err) {
    console.error('[Routes] /api/group/location error:', err.message);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// ─── Sensor Ingest Routes (IoT → Firestore) ────────────────────
// Physical sensors authenticate via X-Sensor-Token (HMAC or static).
// Payloads are validated with Zod before writing to Firestore.

router.use('/ingest', requireSensorAuth);

router.post('/ingest/crowd', zodValidate(IngestCrowdSchema), async (req, res) => {
  try {
    const { zone, density, eventId } = req.validated;
    const docRef = db.collection('crowd_zones').doc(eventId).collection(zone).doc('latest');
    await docRef.set({ density, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    cache.invalidate(`crowd:${eventId}`);
    analytics.recordTick('crowd', req.validated);
    res.json({ success: true, zone, density });
  } catch (err) {
    console.error('[Ingest] /ingest/crowd error:', err.message);
    res.status(500).json({ error: 'Ingestion failed' });
  }
});

router.post('/ingest/queue', zodValidate(IngestQueueSchema), async (req, res) => {
  try {
    const { standId, standName, waitMins, capacity, eventId } = req.validated;
    const docRef = db.collection('queue_states').doc(eventId).collection(standId).doc('latest');
    await docRef.set({ standName, waitMins, capacity, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    cache.invalidate(`queues:${eventId}`);
    analytics.recordTick('queue', req.validated);
    res.json({ success: true, standId, waitMins });
  } catch (err) {
    console.error('[Ingest] /ingest/queue error:', err.message);
    res.status(500).json({ error: 'Ingestion failed' });
  }
});

router.post('/ingest/match', zodValidate(IngestMatchSchema), async (req, res) => {
  try {
    const { type, matchMinute, eventId } = req.validated;
    let phase = type;
    if (type === 'first_half' || type === 'second_half') {
      phase = matchMinute <= 45 ? 'first_half' : 'second_half';
    }
    const docRef = db.collection('events').doc(eventId);
    await docRef.set({ currentMinute: matchMinute || 0, phase, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    analytics.recordTick('match', req.validated);
    res.json({ success: true, phase, matchMinute });
  } catch (err) {
    console.error('[Ingest] /ingest/match error:', err.message);
    res.status(500).json({ error: 'Ingestion failed' });
  }
});

// ─── GET /api/incidents ──────────────────────────────────────────
// Returns active incidents for the event.

router.get('/api/incidents', async (req, res) => {
  try {
    const eventId = req.query.eventId || EVENT_ID;
    const cacheKey = `incidents:${eventId}`;

    const cached = cache.get(cacheKey);
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.json(cached);
    }

    const incidentsSnap = await db.collection('events').doc(eventId)
      .collection('incidents')
      .where('resolved', '==', false)
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();

    const incidents = [];
    incidentsSnap.forEach(doc => {
      incidents.push({ id: doc.id, ...doc.data() });
    });

    const payload = { eventId, incidents };
    cache.set(cacheKey, payload, 30); // Short cache for incidents
    res.set('X-Cache', 'MISS');
    res.json(payload);
  } catch (err) {
    console.error('[Routes] /api/incidents error:', err.message);
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
});

// ─── POST /api/incidents ─────────────────────────────────────────

router.post('/api/incidents', zodValidate(IngestIncidentSchema), async (req, res) => {
  try {
    const { type, description, severity, zone, eventId = EVENT_ID } = req.validated;
    
    const incidentDoc = {
      type,
      description,
      severity,
      zone,
      timestamp: FieldValue.serverTimestamp(),
      resolved: false,
      reportedBy: 'command_center'
    };

    const ref = await db.collection('events').doc(eventId).collection('incidents').add(incidentDoc);
    cache.invalidate(`incidents:${eventId}`);
    
    res.json({ success: true, id: ref.id });
  } catch (err) {
    console.error('[Routes] POST /api/incidents error:', err.message);
    res.status(500).json({ error: 'Failed to report incident' });
  }
});

export default router;

