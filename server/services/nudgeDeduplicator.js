/**
 * nudgeDeduplicator.js
 * --------------------
 * Prevents nudge spam by tracking when each attendee was last nudged.
 * Uses Firestore collection: nudge_log/{eventId}/{uid}
 */

import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// ─── Default Window ─────────────────────────────────────────────
const DEFAULT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// ─── Check Recent Nudge ─────────────────────────────────────────

/**
 * Returns true if the attendee was nudged within the given time window.
 *
 * @param {string} uid       – Firebase Auth UID
 * @param {string} eventId   – Current event identifier
 * @param {number} windowMs  – Dedup window in milliseconds (default 5 min)
 * @returns {Promise<boolean>}
 */
export async function wasNudgedRecently(uid, eventId, windowMs = DEFAULT_WINDOW_MS) {
  if (!uid || !eventId) return false;

  try {
    const db = getFirestore();
    const docRef = db.collection('nudge_log').doc(eventId).collection('attendees').doc(uid);
    const snap = await docRef.get();

    if (!snap.exists) return false;

    const data = snap.data();
    if (!data.lastNudgedAt) return false;

    // Firestore Timestamp → JS Date
    const lastNudgedAt = data.lastNudgedAt.toDate
      ? data.lastNudgedAt.toDate()
      : new Date(data.lastNudgedAt);

    const elapsed = Date.now() - lastNudgedAt.getTime();
    return elapsed < windowMs;
  } catch (err) {
    console.error(`[Dedup] Error checking nudge_log for uid=${uid}:`, err.message);
    // Fail open — allow the nudge rather than silently suppressing
    return false;
  }
}

// ─── Log Nudge Sent ─────────────────────────────────────────────

/**
 * Records that a nudge was sent to the given attendee.
 *
 * @param {string} uid      – Firebase Auth UID
 * @param {string} eventId  – Current event identifier
 * @param {object} nudge    – The nudge payload that was sent
 * @returns {Promise<void>}
 */
export async function logNudgeSent(uid, eventId, nudge) {
  if (!uid || !eventId) return;

  try {
    const db = getFirestore();
    const docRef = db.collection('nudge_log').doc(eventId).collection('attendees').doc(uid);

    await docRef.set(
      {
        lastNudgedAt: FieldValue.serverTimestamp(),
        lastNudge: {
          title: nudge.title || '',
          body: nudge.body || '',
          action: nudge.action || '',
          deeplink: nudge.deeplink || '',
          sentAt: new Date().toISOString(),
        },
      },
      { merge: true }
    );

    console.log(`[Dedup] ✓ Logged nudge for uid=${uid} event=${eventId}`);
  } catch (err) {
    console.error(`[Dedup] Error writing nudge_log for uid=${uid}:`, err.message);
  }
}

export default { wasNudgedRecently, logNudgeSent };
