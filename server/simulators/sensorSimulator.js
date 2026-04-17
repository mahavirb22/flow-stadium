/**
 * sensorSimulator.js
 * ------------------
 * Simulates stadium sensor data for the Flow hackathon demo.
 *
 * • 6 crowd zones (A–F) publish density readings every 30 s.
 * • 5 concession stands publish queue states every 45 s.
 * • A match clock ticks 1 match-minute per real second.
 * • At match minute 41, a "halftime_approaching" event fires.
 */

import { PubSub } from '@google-cloud/pubsub';
import analytics from '../services/analyticsService.js';

// ─── Constants ───────────────────────────────────────────────────
const CROWD_ZONES = ['A', 'B', 'C', 'D', 'E', 'F'];

const CONCESSION_STANDS = [
  { standId: 'stand_1', standName: 'North Dog House' },
  { standId: 'stand_2', standName: 'East Wing Burgers' },
  { standId: 'stand_3', standName: 'South Taco Bar' },
  { standId: 'stand_4', standName: 'West End Pizza' },
  { standId: 'stand_5', standName: 'Central Drinks' },
];

const CROWD_INTERVAL_MS   = 30_000;   // every 30 seconds
const QUEUE_INTERVAL_MS   = 45_000;   // every 45 seconds
const CLOCK_TICK_MS       = 1_000;    // 1 real second = 1 match minute
const HALFTIME_MINUTE     = 41;

const TOPICS = {
  crowd:  'crowd-updates',
  queue:  'queue-updates',
  match:  'match-events',
};

// ─── Helpers ─────────────────────────────────────────────────────

/** Random float between min and max (inclusive), rounded to 2 dp. */
function randomFloat(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

/** Random integer between min and max (inclusive). */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Publish a JSON message to a Pub/Sub topic. */
async function publish(pubsub, topicName, payload) {
  const dataBuffer = Buffer.from(JSON.stringify(payload));
  const topic = pubsub.topic(topicName);
  
  try {
    const messageId = await topic.publishMessage({ data: dataBuffer });
    console.log(`[PubSub] → ${topicName}  msgId=${messageId}  payload=${JSON.stringify(payload)}`);
  } catch (err) {
    if (err.code === 5) {
      try {
        console.log(`[PubSub] Topic ${topicName} not found. Creating it...`);
        await pubsub.createTopic(topicName);
        const messageId = await topic.publishMessage({ data: dataBuffer });
        console.log(`[PubSub] → ${topicName}  msgId=${messageId}  payload=${JSON.stringify(payload)}`);
      } catch (createErr) {
        console.error(`[PubSub] ✗ Failed to create and publish to ${topicName}:`, createErr.message);
      }
    } else {
      console.error(`[PubSub] ✗ Failed to publish to ${topicName}:`, err.message);
    }
  }

  // Feed analytics pipeline regardless of Pub/Sub success
  const typeMap = { 'crowd-updates': 'crowd', 'queue-updates': 'queue', 'match-events': 'match' };
  analytics.recordTick(typeMap[topicName] || topicName, payload);
}

// ─── Simulator Class ─────────────────────────────────────────────

class SensorSimulator {
  constructor({ eventId = 'demo-event-001', projectId } = {}) {
    this.eventId = eventId;
    this.matchMinute = 0;
    this.halftimeFired = false;
    this.intervals = [];

    // Initialise Pub/Sub client
    const pubsubConfig = projectId ? { projectId } : {};
    
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      pubsubConfig.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      pubsubConfig.keyFilename = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    }

    this.pubsub = new PubSub(pubsubConfig);

    console.log(`[Simulator] Initialized for event "${this.eventId}"`);
  }

  // ── Match Clock ──────────────────────────────────────────────

  startMatchClock() {
    const clockInterval = setInterval(() => {
      this.matchMinute += 1;
      console.log(`[Clock] ⏱  Match minute ${this.matchMinute}`);

      // Fire halftime_approaching exactly at minute 41
      if (this.matchMinute === HALFTIME_MINUTE && !this.halftimeFired) {
        this.halftimeFired = true;
        publish(this.pubsub, TOPICS.match, {
          type: 'halftime_approaching',
          matchMinute: HALFTIME_MINUTE,
          eventId: this.eventId,
          timestamp: new Date().toISOString(),
        });
      }

      // Stop clock after 90 minutes (full match)
      if (this.matchMinute >= 90) {
        console.log('[Clock] ⏱  Full time reached. Stopping clock.');
        clearInterval(clockInterval);
      }
    }, CLOCK_TICK_MS);

    this.intervals.push(clockInterval);
  }

  // ── Crowd density ────────────────────────────────────────────

  startCrowdPublisher() {
    // Publish once immediately, then on interval
    const publishCrowd = () => {
      for (const zone of CROWD_ZONES) {
        publish(this.pubsub, TOPICS.crowd, {
          zone,
          density: Math.min(1, Math.max(0, randomFloat(0, 1))),
          eventId: this.eventId,
          timestamp: new Date().toISOString(),
        });
      }
    };

    publishCrowd();
    const id = setInterval(publishCrowd, CROWD_INTERVAL_MS);
    this.intervals.push(id);
  }

  // ── Queue states ─────────────────────────────────────────────

  startQueuePublisher() {
    const publishQueues = () => {
      for (const { standId, standName } of CONCESSION_STANDS) {
        publish(this.pubsub, TOPICS.queue, {
          standId,
          standName,
          waitMins: Math.min(60, Math.max(0, randomInt(1, 25))),
          capacity: Math.min(10000, Math.max(0, randomInt(20, 120))),
          eventId: this.eventId,
          timestamp: new Date().toISOString(),
        });
      }
    };

    publishQueues();
    const id = setInterval(publishQueues, QUEUE_INTERVAL_MS);
    this.intervals.push(id);
  }

  // ── Lifecycle ────────────────────────────────────────────────

  start() {
    console.log('[Simulator] ▶  Starting all publishers …');
    this.startMatchClock();
    this.startCrowdPublisher();
    this.startQueuePublisher();
  }

  stop() {
    console.log('[Simulator] ■  Stopping all publishers.');
    for (const id of this.intervals) clearInterval(id);
    this.intervals = [];
  }
}

export default SensorSimulator;
