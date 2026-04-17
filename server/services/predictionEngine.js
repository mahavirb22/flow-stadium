/**
 * predictionEngine.js
 * -------------------
 * The core intelligence loop of Flow.
 *
 * Reads live Firestore telemetry, derives venue signals (hot zones,
 * fastest queues, match phase), then asks Gemini for per-attendee nudge
 * decisions — skipping anyone nudged in the last 5 minutes.
 */

import { getFirestore } from 'firebase-admin/firestore';
import { generateNudgeDecision } from './geminiService.js';
import { wasNudgedRecently } from './nudgeDeduplicator.js';

// ─── Thresholds ─────────────────────────────────────────────────
const DENSITY_HOT  = 0.75;
const DENSITY_QUIET = 0.30;
const NUDGE_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

// ─── Firestore Readers ──────────────────────────────────────────

async function readCrowdZones(db, eventId) {
  const zones = [];
  try {
    const eventDoc = db.collection('crowd_zones').doc(eventId);
    const subcollections = await eventDoc.listCollections();

    for (const subcol of subcollections) {
      const snap = await subcol.doc('latest').get();
      if (snap.exists) {
        zones.push({ zone: subcol.id, density: snap.data().density ?? 0 });
      }
    }
  } catch (err) {
    console.error('[Engine] Failed to read crowd_zones:', err.message);
  }
  return zones;
}

async function readQueueStates(db, eventId) {
  const queues = [];
  try {
    const eventDoc = db.collection('queue_states').doc(eventId);
    const subcollections = await eventDoc.listCollections();

    for (const subcol of subcollections) {
      const snap = await subcol.doc('latest').get();
      if (snap.exists) {
        const data = snap.data();
        queues.push({
          standId: subcol.id,
          standName: data.standName ?? subcol.id,
          waitMins: data.waitMins ?? 0,
          capacity: data.capacity ?? 0,
        });
      }
    }
  } catch (err) {
    console.error('[Engine] Failed to read queue_states:', err.message);
  }
  return queues;
}

async function readMatchState(db, eventId) {
  try {
    const snap = await db.collection('events').doc(eventId).get();
    if (!snap.exists) return { currentMinute: 0, phase: 'unknown' };
    return snap.data();
  } catch (err) {
    console.error('[Engine] Failed to read match state:', err.message);
    return { currentMinute: 0, phase: 'unknown' };
  }
}

async function readGroups(db, eventId) {
  const groups = [];
  try {
    const snap = await db
      .collection('groups')
      .where('eventId', '==', eventId)
      .where('active', '==', true)
      .get();

    snap.forEach((doc) => groups.push({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error('[Engine] Failed to read groups:', err.message);
  }
  return groups;
}

async function readAttendees(db, eventId) {
  const attendees = [];
  try {
    const snap = await db
      .collection('attendees')
      .where('eventId', '==', eventId)
      .get();

    snap.forEach((doc) => {
      const data = doc.data();
      attendees.push({
        uid: doc.id,
        section: data.section ?? null,
        fcmToken: data.fcmToken ?? null,
        prefs: data.prefs ?? [],
      });
    });
  } catch (err) {
    console.error('[Engine] Failed to read attendees:', err.message);
  }
  return attendees;
}

// ─── Signal Computation ─────────────────────────────────────────

function computeSignals(zones, queues, matchState) {
  const hotZones = zones
    .filter((z) => z.density > DENSITY_HOT)
    .sort((a, b) => b.density - a.density);

  const quietZones = zones
    .filter((z) => z.density < DENSITY_QUIET)
    .sort((a, b) => a.density - b.density);

  const sortedQueues = [...queues].sort((a, b) => a.waitMins - b.waitMins);
  const fastestQueue = sortedQueues[0] || null;

  const { currentMinute = 0, phase = 'unknown' } = matchState;
  const isHalftimeApproaching = currentMinute >= 41 && currentMinute <= 44;

  return {
    hotZones,
    quietZones,
    fastestQueue,
    queues: sortedQueues,
    currentMinute,
    phase,
    isHalftimeApproaching,
  };
}

// ─── Main Prediction Cycle ──────────────────────────────────────

/**
 * Runs a single prediction cycle for the given event.
 *
 * 1. Reads all venue data from Firestore in parallel.
 * 2. Computes derived signals (hot zones, fastest queue, halftime flag).
 * 3. For each attendee, checks dedup window and calls Gemini.
 * 4. Returns an array of actionable nudge objects.
 *
 * @param {string} eventId
 * @returns {Promise<Array<{uid: string, nudge: object}>>}
 */
export async function runPredictionCycle(eventId) {
  if (!eventId) throw new Error('[Engine] eventId is required.');

  const db = getFirestore();
  const cycleStart = Date.now();

  console.log(`[Engine] ──── Prediction cycle starting for event=${eventId} ────`);

  // ── 1. Parallel Firestore reads ────────────────────────────────
  const [zones, queues, matchState, groups, attendees] = await Promise.all([
    readCrowdZones(db, eventId),
    readQueueStates(db, eventId),
    readMatchState(db, eventId),
    readGroups(db, eventId),
    readAttendees(db, eventId),
  ]);

  console.log(
    `[Engine] Data: ${zones.length} zones, ${queues.length} queues, ` +
    `${groups.length} groups, ${attendees.length} attendees, ` +
    `minute=${matchState.currentMinute} phase=${matchState.phase}`
  );

  // ── 2. Compute derived signals ─────────────────────────────────
  const signals = computeSignals(zones, queues, matchState);

  // ── 3. Per-attendee nudge decisions ────────────────────────────
  const nudges = [];

  for (const attendee of attendees) {
    // Skip attendees without an FCM token — cannot deliver push
    if (!attendee.fcmToken) {
      console.log(`[Engine] Skipping uid=${attendee.uid} — no FCM token`);
      continue;
    }

    // Dedup check — skip if nudged within the cooldown window
    try {
      const recentlyNudged = await wasNudgedRecently(attendee.uid, eventId, NUDGE_COOLDOWN_MS);
      if (recentlyNudged) {
        console.log(`[Engine] Skipping uid=${attendee.uid} — nudged recently`);
        continue;
      }
    } catch (err) {
      console.error(`[Engine] Dedup check failed for uid=${attendee.uid}:`, err.message);
      // Fail open — proceed with nudge decision
    }

    // Build context for Gemini
    const context = {
      ...signals,
      groups: groups.filter(
        (g) => g.members?.includes(attendee.uid)
      ),
    };

    try {
      const decision = await generateNudgeDecision(attendee, context);

      if (decision && decision.send === true) {
        nudges.push({
          uid: attendee.uid,
          fcmToken: attendee.fcmToken,
          nudge: {
            title: decision.title,
            body: decision.body,
            action: decision.action || 'info',
            deeplink: decision.deeplink || '',
          },
        });
      }
    } catch (err) {
      console.error(`[Engine] Gemini decision failed for uid=${attendee.uid}:`, err.message);
    }
  }

  const elapsed = Date.now() - cycleStart;
  console.log(
    `[Engine] ──── Cycle complete: ${nudges.length} nudges generated in ${elapsed}ms ────`
  );

  return nudges;
}

// Exported for testing
export { computeSignals, readCrowdZones, readQueueStates, readMatchState };
export default { runPredictionCycle };
