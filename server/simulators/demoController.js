/**
 * demoController.js
 * ─────────────────
 * HTTP endpoints for controlling the live hackathon demo.
 * Protected by DEMO_SECRET header. Only active when DEMO_MODE=true.
 *
 * POST /demo/start     — starts simulator, sets event to minute 0
 * POST /demo/halftime  — jumps to minute 41, triggers halftime events
 * POST /demo/group-exit — marks all demo group members as nearExit
 * POST /demo/reset     — wipes all demo Firestore data
 */

import { Router } from 'express';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { PubSub } from '@google-cloud/pubsub';

const router = Router();
const DEMO_GROUP_ID = process.env.DEMO_GROUP_ID || 'demo-group-001';
const EVENT_ID = process.env.EVENT_ID || 'demo-event-001';
const DEMO_SECRET = process.env.DEMO_SECRET || 'flow-demo-2026';

// ─── Gate: only mount if DEMO_MODE=true ─────────────────────────

export function isDemoMode() {
  return process.env.DEMO_MODE === 'true';
}

// ─── Auth: check DEMO_SECRET header ─────────────────────────────

function requireDemoSecret(req, res, next) {
  const secret = req.headers['x-demo-secret'] || req.headers['demo-secret'];

  if (!secret || secret !== DEMO_SECRET) {
    return res.status(401).json({ error: 'Invalid demo secret' });
  }

  next();
}

router.use(requireDemoSecret);

// ─── POST /demo/start ───────────────────────────────────────────

router.post('/start', async (_req, res) => {
  try {
    const db = getFirestore();

    // Set event to minute 0
    await db.collection('events').doc(EVENT_ID).set(
      {
        currentMinute: 0,
        phase: 'pre_match',
        startedAt: FieldValue.serverTimestamp(),
        eventId: EVENT_ID,
      },
      { merge: true }
    );

    // Initialize crowd zones with moderate density
    const zones = ['A', 'B', 'C', 'D', 'E', 'F'];
    const batch = db.batch();

    for (const zone of zones) {
      const ref = db.collection('crowd_zones').doc(EVENT_ID).collection(zone).doc('latest');
      batch.set(ref, {
        zone,
        density: 0.3 + Math.random() * 0.2,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // Initialize queue stands
    const stands = [
      { id: 'stand_1', name: 'North Dog House', waitMins: 5 },
      { id: 'stand_2', name: 'East Wing Burgers', waitMins: 8 },
      { id: 'stand_3', name: 'South Drinks Bar', waitMins: 12 },
      { id: 'stand_4', name: 'West Nachos', waitMins: 6 },
      { id: 'stand_5', name: 'Central Pizza', waitMins: 10 },
    ];

    for (const stand of stands) {
      const ref = db.collection('queue_states').doc(EVENT_ID).collection(stand.id).doc('latest');
      batch.set(ref, {
        standId: stand.id,
        standName: stand.name,
        waitMins: stand.waitMins,
        capacity: 50,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();

    console.log('[Demo] ✓ Started — event set to minute 0');
    res.json({ success: true, action: 'start', eventId: EVENT_ID, matchMinute: 0 });
  } catch (err) {
    console.error('[Demo] Start failed:', err.message);
    res.status(500).json({ error: 'Failed to start demo', details: err.message });
  }
});

// ─── POST /demo/halftime ────────────────────────────────────────

router.post('/halftime', async (_req, res) => {
  try {
    const db = getFirestore();
    const pubsub = new PubSub();

    // 1. Jump match clock to minute 41
    await db.collection('events').doc(EVENT_ID).set(
      {
        currentMinute: 41,
        phase: 'halftime_approaching',
      },
      { merge: true }
    );

    // 2. Spike crowd density in zones A and B (halftime rush)
    const batch = db.batch();

    const crowdUpdates = [
      { zone: 'A', density: 0.92 },
      { zone: 'B', density: 0.88 },
      { zone: 'C', density: 0.75 },
      { zone: 'D', density: 0.45 },
      { zone: 'E', density: 0.25 },
      { zone: 'F', density: 0.18 },
    ];

    for (const { zone, density } of crowdUpdates) {
      const ref = db.collection('crowd_zones').doc(EVENT_ID).collection(zone).doc('latest');
      batch.set(ref, { zone, density, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }

    // 3. Drop Stand 3 to 2 min wait (the one we'll nudge people towards)
    const stand3Ref = db.collection('queue_states').doc(EVENT_ID).collection('stand_3').doc('latest');
    batch.set(stand3Ref, {
      standId: 'stand_3',
      standName: 'South Drinks Bar',
      waitMins: 2,
      capacity: 50,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    await batch.commit();

    // 4. Publish halftime event to Pub/Sub
    try {
      const topic = pubsub.topic('match-events');
      await topic.publishMessage({
        json: {
          type: 'halftime_approaching',
          matchMinute: 41,
          eventId: EVENT_ID,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (pubsubErr) {
      console.warn('[Demo] Pub/Sub publish skipped (topic may not exist):', pubsubErr.message);
    }

    console.log('[Demo] ✓ Halftime triggered — minute 41, Stand 3 → 2 min');
    res.json({
      success: true,
      action: 'halftime',
      matchMinute: 41,
      standsUpdated: ['stand_3 → 2 min'],
      hotZones: ['A (0.92)', 'B (0.88)'],
    });
  } catch (err) {
    console.error('[Demo] Halftime failed:', err.message);
    res.status(500).json({ error: 'Failed to trigger halftime', details: err.message });
  }
});

// ─── POST /demo/group-exit ──────────────────────────────────────

router.post('/group-exit', async (_req, res) => {
  try {
    const db = getFirestore();
    const groupRef = db.collection('groups').doc(DEMO_GROUP_ID);
    const groupSnap = await groupRef.get();

    if (!groupSnap.exists) {
      // Create demo group if it doesn't exist
      await groupRef.set({
        name: 'Demo Squad',
        eventId: EVENT_ID,
        memberUids: ['demo-alice', 'demo-bob', 'demo-charlie'],
        members: [
          { uid: 'demo-alice', name: 'Alice', section: 'A', nearExit: true },
          { uid: 'demo-bob', name: 'Bob', section: 'B', nearExit: true },
          { uid: 'demo-charlie', name: 'Charlie', section: 'C', nearExit: true },
        ],
        meetingNudgeSent: false,
      });
    } else {
      // Update all members to nearExit: true
      const data = groupSnap.data();
      const members = (data.members || []).map((m) => ({
        ...m,
        nearExit: true,
      }));

      await groupRef.update({
        members,
        meetingNudgeSent: false, // reset so the coordinator fires again
      });
    }

    console.log('[Demo] ✓ Group exit — all members near exit');
    res.json({ success: true, action: 'group-exit', groupId: DEMO_GROUP_ID });
  } catch (err) {
    console.error('[Demo] Group exit failed:', err.message);
    res.status(500).json({ error: 'Failed to trigger group exit', details: err.message });
  }
});

// ─── POST /demo/reset ───────────────────────────────────────────

router.post('/reset', async (_req, res) => {
  try {
    const db = getFirestore();
    const batch = db.batch();

    // Reset event
    batch.set(db.collection('events').doc(EVENT_ID), {
      currentMinute: 0,
      phase: 'pre_match',
      startedAt: FieldValue.serverTimestamp(),
    });

    // Reset crowd zones
    for (const zone of ['A', 'B', 'C', 'D', 'E', 'F']) {
      const ref = db.collection('crowd_zones').doc(EVENT_ID).collection(zone).doc('latest');
      batch.set(ref, { zone, density: 0.3, updatedAt: FieldValue.serverTimestamp() });
    }

    // Reset queue stands
    const stands = [
      { id: 'stand_1', name: 'North Dog House', waitMins: 5 },
      { id: 'stand_2', name: 'East Wing Burgers', waitMins: 8 },
      { id: 'stand_3', name: 'South Drinks Bar', waitMins: 10 },
      { id: 'stand_4', name: 'West Nachos', waitMins: 6 },
      { id: 'stand_5', name: 'Central Pizza', waitMins: 9 },
    ];

    for (const s of stands) {
      const ref = db.collection('queue_states').doc(EVENT_ID).collection(s.id).doc('latest');
      batch.set(ref, {
        standId: s.id,
        standName: s.name,
        waitMins: s.waitMins,
        capacity: 50,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // Reset demo group
    batch.set(db.collection('groups').doc(DEMO_GROUP_ID), {
      name: 'Demo Squad',
      eventId: EVENT_ID,
      memberUids: ['demo-alice', 'demo-bob', 'demo-charlie'],
      members: [
        { uid: 'demo-alice', name: 'Alice', section: 'A', nearExit: false },
        { uid: 'demo-bob', name: 'Bob', section: 'B', nearExit: false },
        { uid: 'demo-charlie', name: 'Charlie', section: 'C', nearExit: false },
      ],
      meetingNudgeSent: false,
      chosenGate: null,
    });

    await batch.commit();

    // Clear nudge log for demo users
    const nudgeRefs = ['demo-alice', 'demo-bob', 'demo-charlie'];
    for (const uid of nudgeRefs) {
      try {
        await db.collection('nudge_log').doc(EVENT_ID).collection('attendees').doc(uid).delete();
      } catch {
        // ignore if doesn't exist
      }
    }

    try {
      const incidentsSnap = await db.collection('events').doc(EVENT_ID).collection('incidents').get();
      const incBatch = db.batch();
      incidentsSnap.docs.forEach(doc => {
        incBatch.delete(doc.ref);
      });
      await incBatch.commit();
    } catch (err) {
      console.warn('Could not delete incidents', err.message);
    }

    console.log('[Demo] ✓ Reset complete');
    res.json({ success: true, action: 'reset', eventId: EVENT_ID });
  } catch (err) {
    console.error('[Demo] Reset failed:', err.message);
    res.status(500).json({ error: 'Failed to reset demo', details: err.message });
  }
});

export default router;
