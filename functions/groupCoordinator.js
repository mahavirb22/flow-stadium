/**
 * groupCoordinator.js
 * -------------------
 * Firebase Cloud Function v2 — Firestore trigger on groups/{groupId}.
 *
 * When a group document is updated, checks whether all members have
 * set nearExit: true. If so, finds the least congested exit gate,
 * builds a meeting-point nudge, and sends it to every group member.
 */

import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

// ─── Firebase Init (idempotent) ─────────────────────────────────
if (getApps().length === 0) initializeApp();
const db = getFirestore();

// ─── Gate Map (maps stadium sections to nearest exit gates) ─────
const SECTION_GATE_MAP = {
  A: 'Gate 1 — North',
  B: 'Gate 2 — East',
  C: 'Gate 3 — South',
  D: 'Gate 4 — West',
  E: 'Gate 1 — North',
  F: 'Gate 3 — South',
};

const ALL_GATES = [
  'Gate 1 — North',
  'Gate 2 — East',
  'Gate 3 — South',
  'Gate 4 — West',
];

// ─── Find Best Gate ─────────────────────────────────────────────

/**
 * Determines the least congested gate given member sections and live
 * crowd zone data.
 *
 * Strategy: Score each gate by the density of its closest zone.
 * Pick the gate with the lowest crowd density.
 *
 * @param {string[]} memberSections  – Sections where group members are seated
 * @param {Array<{zone: string, density: number}>} crowdZones
 * @returns {string} Best gate name
 */
export function findBestGate(memberSections, crowdZones) {
  // Build density lookup: zone → density
  const densityMap = {};
  for (const { zone, density } of crowdZones) {
    densityMap[zone] = density;
  }

  // Gate → zone mapping (reverse of SECTION_GATE_MAP)
  const gateZones = {
    'Gate 1 — North': ['A', 'E'],
    'Gate 2 — East': ['B'],
    'Gate 3 — South': ['C', 'F'],
    'Gate 4 — West': ['D'],
  };

  // Score each gate: average density of its zones (lower = better)
  let bestGate = ALL_GATES[0];
  let bestScore = Infinity;

  for (const gate of ALL_GATES) {
    const zones = gateZones[gate] || [];
    if (zones.length === 0) continue;

    const avgDensity =
      zones.reduce((sum, z) => sum + (densityMap[z] ?? 0.5), 0) / zones.length;

    if (avgDensity < bestScore) {
      bestScore = avgDensity;
      bestGate = gate;
    }
  }

  console.log(`[GroupCoord] Best gate: ${bestGate} (density score: ${bestScore.toFixed(2)})`);
  return bestGate;
}

// ─── Cloud Function ─────────────────────────────────────────────

export const onGroupUpdated = onDocumentUpdated(
  { document: 'groups/{groupId}', region: 'us-central1' },
  async (event) => {
    const groupId = event.params.groupId;
    const afterData = event.data.after.data();

    if (!afterData) {
      console.warn(`[GroupCoord] Group ${groupId} was deleted — ignoring.`);
      return;
    }

    // ── 1. Already sent? ─────────────────────────────────────────
    if (afterData.meetingNudgeSent === true) {
      console.log(`[GroupCoord] Group ${groupId} meeting nudge already sent — skipping.`);
      return;
    }

    // ── 2. Check all members nearExit ────────────────────────────
    const members = afterData.members || [];
    if (members.length === 0) {
      console.log(`[GroupCoord] Group ${groupId} has no members.`);
      return;
    }

    const allNearExit = members.every((m) => m.nearExit === true);
    if (!allNearExit) {
      console.log(
        `[GroupCoord] Group ${groupId}: not all members near exit ` +
        `(${members.filter((m) => m.nearExit).length}/${members.length}).`
      );
      return;
    }

    console.log(`[GroupCoord] ✓ All ${members.length} members of group ${groupId} near exit!`);

    // ── 3. Read crowd zones for gate scoring ─────────────────────
    let crowdZones = [];
    try {
      const eventId = afterData.eventId || 'demo-event-001';
      const eventDoc = db.collection('crowd_zones').doc(eventId);
      const subcollections = await eventDoc.listCollections();

      for (const subcol of subcollections) {
        const snap = await subcol.doc('latest').get();
        if (snap.exists) {
          crowdZones.push({ zone: subcol.id, density: snap.data().density ?? 0.5 });
        }
      }
    } catch (err) {
      console.error('[GroupCoord] Failed to read crowd zones:', err.message);
      // Proceed with empty zones — findBestGate handles defaults
    }

    // ── 4. Find least congested gate ─────────────────────────────
    const memberSections = members
      .map((m) => m.section)
      .filter(Boolean);
    const chosenGate = findBestGate(memberSections, crowdZones);

    // ── 5. Build nudge ───────────────────────────────────────────
    const walkMins = Math.floor(Math.random() * 4) + 2; // 2–5 min estimate
    const nudge = {
      title: `Your group — meet at ${chosenGate}`,
      body: `${members.length} of you heading out. ${walkMins} min walk.`,
      action: 'navigate',
      deeplink: `flow://navigate?dest=${encodeURIComponent(chosenGate)}`,
    };

    // ── 6. Send to all members ───────────────────────────────────
    const memberUids = afterData.memberUids || members.map((m) => m.uid).filter(Boolean);

    const sendResults = await Promise.allSettled(
      memberUids.map(async (uid) => {
        const attendeeSnap = await db.collection('attendees').doc(uid).get();
        if (!attendeeSnap.exists) return { uid, sent: false, reason: 'no attendee doc' };

        const fcmToken = attendeeSnap.data().fcmToken;
        if (!fcmToken) return { uid, sent: false, reason: 'no FCM token' };

        const message = {
          token: fcmToken,
          notification: { title: nudge.title, body: nudge.body },
          data: { action: nudge.action, deeplink: nudge.deeplink },
          android: { priority: 'high', notification: { channelId: 'flow_nudges' } },
          apns: { payload: { aps: { sound: 'default', badge: 1 } } },
        };

        const msgId = await getMessaging().send(message);
        console.log(`[GroupCoord] ✓ Sent to uid=${uid} msgId=${msgId}`);
        return { uid, sent: true, msgId };
      })
    );

    const sentCount = sendResults.filter(
      (r) => r.status === 'fulfilled' && r.value?.sent
    ).length;

    console.log(
      `[GroupCoord] Group ${groupId}: ${sentCount}/${memberUids.length} ` +
      `nudges sent → ${chosenGate}`
    );

    // ── 7. Mark group as notified ────────────────────────────────
    try {
      await db.collection('groups').doc(groupId).set(
        {
          meetingNudgeSent: true,
          chosenGate,
          meetingNudgeSentAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error(`[GroupCoord] Failed to update group ${groupId}:`, err.message);
    }
  }
);
