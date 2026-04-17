/**
 * pubsubConsumer.js
 * -----------------
 * Firebase Cloud Functions v2 — Pub/Sub consumers for the Flow system.
 *
 * Listens to three topics:
 *   • crowd-updates  → Firestore  crowd_zones/{eventId}/{zone}
 *   • queue-updates  → Firestore  queue_states/{eventId}/{standId}
 *   • match-events   → Firestore  events/{eventId}
 */

import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

// ─── Firebase Init ──────────────────────────────────────────────
initializeApp();
const db = getFirestore();

// ─── Validation Schemas ─────────────────────────────────────────
const CrowdUpdateSchema = z.object({
  zone: z.string().min(1).max(10),
  density: z.number().min(0).max(1),
  eventId: z.string().min(1).max(128),
  timestamp: z.string().optional(),
});

const QueueUpdateSchema = z.object({
  standId: z.string().min(1).max(64),
  standName: z.string().min(1).max(128).optional(),
  waitMins: z.number().min(0).max(120),
  capacity: z.number().min(0).max(10000).optional(),
  eventId: z.string().min(1).max(128),
  timestamp: z.string().optional(),
});

const MatchEventSchema = z.object({
  type: z.enum(['first_half', 'halftime_approaching', 'halftime', 'second_half', 'full_time']),
  matchMinute: z.number().int().min(0).max(120).optional(),
  eventId: z.string().min(1).max(128),
  timestamp: z.string().optional(),
});

// ─── Crowd Updates Consumer ─────────────────────────────────────
// Writes zone density to: crowd_zones/{eventId}/{zone}

export const onCrowdUpdate = onMessagePublished(
  { topic: 'crowd-updates', region: 'us-central1' },
  async (event) => {
    const message = event.data.message;
    const raw = JSON.parse(Buffer.from(message.data, 'base64').toString());

    const result = CrowdUpdateSchema.safeParse(raw);
    if (!result.success) {
      console.error('[CrowdConsumer] ✗ Invalid payload:', result.error.issues);
      return;
    }
    const { zone, density, eventId } = result.data;

    const docRef = db.collection('crowd_zones').doc(eventId).collection(zone).doc('latest');

    await docRef.set(
      {
        density,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.log(`[CrowdConsumer] ✓ crowd_zones/${eventId}/${zone} density=${density}`);
  }
);

// ─── Queue Updates Consumer ─────────────────────────────────────
// Writes queue state to: queue_states/{eventId}/{standId}

export const onQueueUpdate = onMessagePublished(
  { topic: 'queue-updates', region: 'us-central1' },
  async (event) => {
    const message = event.data.message;
    const raw = JSON.parse(Buffer.from(message.data, 'base64').toString());

    const result = QueueUpdateSchema.safeParse(raw);
    if (!result.success) {
      console.error('[QueueConsumer] ✗ Invalid payload:', result.error.issues);
      return;
    }
    const { standId, standName, waitMins, capacity, eventId } = result.data;

    const docRef = db.collection('queue_states').doc(eventId).collection(standId).doc('latest');

    await docRef.set(
      {
        standName,
        waitMins,
        capacity,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.log(`[QueueConsumer] ✓ queue_states/${eventId}/${standId} wait=${waitMins}min`);
  }
);

// ─── Match Events Consumer ──────────────────────────────────────
// Writes match phase to: events/{eventId}

export const onMatchEvent = onMessagePublished(
  { topic: 'match-events', region: 'us-central1' },
  async (event) => {
    const message = event.data.message;
    const raw = JSON.parse(Buffer.from(message.data, 'base64').toString());

    const result = MatchEventSchema.safeParse(raw);
    if (!result.success) {
      console.error('[MatchConsumer] ✗ Invalid payload:', result.error.issues);
      return;
    }
    const { type, matchMinute, eventId } = result.data;

    // Determine the current phase from the event type
    let phase;
    switch (type) {
      case 'halftime_approaching':
        phase = 'halftime_approaching';
        break;
      case 'halftime':
        phase = 'halftime';
        break;
      case 'second_half':
        phase = 'second_half';
        break;
      default:
        phase = matchMinute <= 45 ? 'first_half' : 'second_half';
    }

    const docRef = db.collection('events').doc(eventId);

    await docRef.set(
      {
        currentMinute: matchMinute || 0,
        phase,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.log(`[MatchConsumer] ✓ events/${eventId} phase=${phase} minute=${matchMinute}`);
  }
);
