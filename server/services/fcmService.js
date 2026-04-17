/**
 * fcmService.js
 * -------------
 * Delivery layer for Flow nudges via Firebase Cloud Messaging.
 *
 * • sendNudge(uid, nudge) — fetches token from Firestore, sends push,
 *   logs via deduplicator, returns success/failure envelope.
 * • sendGroupNudge(groupId, nudge) — sends to every member in parallel.
 */

import { getMessaging } from 'firebase-admin/messaging';
import { getFirestore } from 'firebase-admin/firestore';
import { logNudgeSent } from './nudgeDeduplicator.js';

// ─── Single Nudge ───────────────────────────────────────────────

/**
 * Sends a push notification to a single attendee.
 *
 * 1. Looks up their FCM token from Firestore: attendees/{uid}
 * 2. Sends via FCM with Android high-priority + APNs sound/badge
 * 3. Logs the nudge for dedup
 *
 * @param {string} uid    – Firebase Auth UID
 * @param {object} nudge  – { title, body, action, deeplink, eventId? }
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendNudge(uid, nudge) {
  if (!uid) {
    return { success: false, error: 'uid is required' };
  }

  let fcmToken;

  // ── 1. Fetch FCM token from Firestore ──────────────────────────
  try {
    const db = getFirestore();
    const snap = await db.collection('attendees').doc(uid).get();

    if (!snap.exists) {
      console.warn(`[FCM] Attendee doc not found for uid=${uid}`);
      return { success: false, error: 'Attendee document not found' };
    }

    fcmToken = snap.data().fcmToken;

    if (!fcmToken) {
      console.warn(`[FCM] No FCM token for uid=${uid}`);
      return { success: false, error: 'No FCM token registered' };
    }
  } catch (err) {
    console.error(`[FCM] Firestore read failed for uid=${uid}:`, err.message);
    return { success: false, error: `Firestore read failed: ${err.message}` };
  }

  // ── 2. Build and send FCM message ──────────────────────────────
  const message = {
    token: fcmToken,
    notification: {
      title: nudge.title,
      body: nudge.body,
    },
    data: {
      action: nudge.action || 'info',
      deeplink: nudge.deeplink || '',
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'flow_nudges',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
        },
      },
    },
    webpush: {
      notification: {
        title: nudge.title,
        body: nudge.body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
      },
      fcmOptions: {
        link: nudge.deeplink || '/',
      },
    },
  };

  try {
    const messageId = await getMessaging().send(message);
    console.log(`[FCM] ✓ Sent to uid=${uid} token=${fcmToken.slice(0, 12)}… msgId=${messageId}`);

    // ── 3. Log for dedup ───────────────────────────────────────────
    const eventId = nudge.eventId || 'unknown';
    try {
      await logNudgeSent(uid, eventId, nudge);
    } catch (logErr) {
      // Non-fatal — don't fail the send because logging broke
      console.error(`[FCM] Dedup log failed for uid=${uid}:`, logErr.message);
    }

    return { success: true, messageId };
  } catch (err) {
    console.error(`[FCM] ✗ Send failed for uid=${uid}:`, err.message);
    return { success: false, error: err.message };
  }
}

// ─── Group Nudge ────────────────────────────────────────────────

/**
 * Sends the same nudge to every member of a group, in parallel.
 *
 * @param {string} groupId  – Firestore group document ID
 * @param {object} nudge    – { title, body, action, deeplink, eventId? }
 * @returns {Promise<{total: number, sent: number, failed: number, results: Array}>}
 */
export async function sendGroupNudge(groupId, nudge) {
  if (!groupId) {
    return { total: 0, sent: 0, failed: 0, results: [] };
  }

  // Read group membership
  let memberUids = [];
  try {
    const db = getFirestore();
    const snap = await db.collection('groups').doc(groupId).get();

    if (!snap.exists) {
      console.warn(`[FCM] Group not found: ${groupId}`);
      return { total: 0, sent: 0, failed: 0, results: [] };
    }

    memberUids = snap.data().memberUids || [];
  } catch (err) {
    console.error(`[FCM] Failed to read group ${groupId}:`, err.message);
    return { total: 0, sent: 0, failed: 0, results: [] };
  }

  if (memberUids.length === 0) {
    console.warn(`[FCM] Group ${groupId} has no members`);
    return { total: 0, sent: 0, failed: 0, results: [] };
  }

  console.log(`[FCM] Sending group nudge to ${memberUids.length} members of group=${groupId}`);

  // Send to all members in parallel
  const settledResults = await Promise.allSettled(
    memberUids.map((uid) => sendNudge(uid, nudge))
  );

  const results = settledResults.map((r, i) => ({
    uid: memberUids[i],
    ...(r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message }),
  }));

  const sent = results.filter((r) => r.success).length;
  const failed = results.length - sent;

  console.log(`[FCM] Group nudge complete: ${sent}/${results.length} sent, ${failed} failed`);

  return { total: results.length, sent, failed, results };
}

export default { sendNudge, sendGroupNudge };
