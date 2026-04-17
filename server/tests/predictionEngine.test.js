/**
 * predictionEngine.test.js
 * ────────────────────────
 * Jest tests for the Flow prediction engine.
 *
 * Run: node --experimental-vm-modules ../node_modules/jest/bin/jest.js
 */

import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';

// ─── Mock Setup (before dynamic imports) ────────────────────────

let firestoreConfig = {};

jest.unstable_mockModule('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: (name) => firestoreConfig[name] || { doc: jest.fn() },
  }),
  FieldValue: {
    serverTimestamp: () => 'SERVER_TIMESTAMP',
  },
}));

const mockGenerateNudgeDecision = jest.fn();
jest.unstable_mockModule('../services/geminiService.js', () => ({
  generateNudgeDecision: mockGenerateNudgeDecision,
  parseGeminiResponse: jest.fn(),
  default: { generateNudgeDecision: mockGenerateNudgeDecision },
}));

const mockWasNudgedRecently = jest.fn();
const mockLogNudgeSent = jest.fn();
jest.unstable_mockModule('../services/nudgeDeduplicator.js', () => ({
  wasNudgedRecently: mockWasNudgedRecently,
  logNudgeSent: mockLogNudgeSent,
  default: { wasNudgedRecently: mockWasNudgedRecently, logNudgeSent: mockLogNudgeSent },
}));

// ─── Dynamic imports (after mocks registered) ──────────────────

let computeSignals;
let runPredictionCycle;

beforeAll(async () => {
  const mod = await import('../services/predictionEngine.js');
  computeSignals = mod.computeSignals;
  runPredictionCycle = mod.runPredictionCycle;
});

beforeEach(() => {
  jest.clearAllMocks();
  firestoreConfig = {};
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. Halftime Surge Detection
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('computeSignals — halftime detection', () => {
  it('correctly detects halftime approaching at minute 41', () => {
    const zones = [
      { zone: 'A', density: 0.9 },
      { zone: 'B', density: 0.2 },
      { zone: 'C', density: 0.5 },
    ];
    const queues = [
      { standId: 'stand_1', standName: 'North Dog House', waitMins: 12 },
      { standId: 'stand_2', standName: 'East Wing Burgers', waitMins: 3 },
    ];
    const matchState = { currentMinute: 41, phase: 'first_half' };

    const signals = computeSignals(zones, queues, matchState);

    expect(signals.isHalftimeApproaching).toBe(true);
    expect(signals.hotZones).toHaveLength(1);
    expect(signals.hotZones[0].zone).toBe('A');
    expect(signals.hotZones[0].density).toBe(0.9);
    expect(signals.quietZones).toHaveLength(1);
    expect(signals.quietZones[0].zone).toBe('B');
    expect(signals.fastestQueue.standId).toBe('stand_2');
    expect(signals.fastestQueue.waitMins).toBe(3);
    expect(signals.currentMinute).toBe(41);
  });

  it('does NOT flag halftime at minute 40', () => {
    const signals = computeSignals([], [], { currentMinute: 40, phase: 'first_half' });
    expect(signals.isHalftimeApproaching).toBe(false);
  });

  it('does NOT flag halftime at minute 45', () => {
    const signals = computeSignals([], [], { currentMinute: 45, phase: 'halftime' });
    expect(signals.isHalftimeApproaching).toBe(false);
  });

  it('flags halftime at minutes 42, 43, 44', () => {
    for (const min of [42, 43, 44]) {
      const signals = computeSignals([], [], { currentMinute: min, phase: 'first_half' });
      expect(signals.isHalftimeApproaching).toBe(true);
    }
  });

  it('handles empty zones and queues', () => {
    const signals = computeSignals([], [], { currentMinute: 10, phase: 'first_half' });
    expect(signals.fastestQueue).toBeNull();
    expect(signals.hotZones).toHaveLength(0);
    expect(signals.quietZones).toHaveLength(0);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. Dedup: Attendee Not Nudged If Recent
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('runPredictionCycle — dedup', () => {
  it('skips attendee if nudge_log shows nudge within 5 min', async () => {
    setupMockFirestore({
      zones: [],
      queues: [],
      matchState: { currentMinute: 42, phase: 'first_half' },
      groups: [],
      attendees: [{ uid: 'user-1', section: 'A', fcmToken: 'tok-1', prefs: ['food'] }],
    });

    mockWasNudgedRecently.mockResolvedValue(true);

    const nudges = await runPredictionCycle('evt-001');

    expect(mockGenerateNudgeDecision).not.toHaveBeenCalled();
    expect(nudges).toHaveLength(0);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. Malformed Gemini Response
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('runPredictionCycle — malformed Gemini', () => {
  it('handles null Gemini response without crash', async () => {
    setupMockFirestore({
      zones: [{ zone: 'A', density: 0.85 }],
      queues: [{ standId: 'stand_1', standName: 'North Dogs', waitMins: 5 }],
      matchState: { currentMinute: 41, phase: 'first_half' },
      groups: [],
      attendees: [{ uid: 'user-1', section: 'A', fcmToken: 'tok-1', prefs: [] }],
    });

    mockWasNudgedRecently.mockResolvedValue(false);
    mockGenerateNudgeDecision.mockResolvedValue(null);

    const nudges = await runPredictionCycle('evt-001');

    expect(nudges).toHaveLength(0);
    expect(mockGenerateNudgeDecision).toHaveBeenCalledTimes(1);
  });

  it('handles Gemini throwing an error without crash', async () => {
    setupMockFirestore({
      zones: [],
      queues: [],
      matchState: { currentMinute: 20, phase: 'first_half' },
      groups: [],
      attendees: [{ uid: 'user-1', section: 'A', fcmToken: 'tok-1', prefs: [] }],
    });

    mockWasNudgedRecently.mockResolvedValue(false);
    mockGenerateNudgeDecision.mockRejectedValue(new Error('API timeout'));

    const nudges = await runPredictionCycle('evt-001');

    expect(nudges).toHaveLength(0);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. No FCM Token
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('runPredictionCycle — no FCM token', () => {
  it('skips attendee without fcmToken, processes one with token', async () => {
    setupMockFirestore({
      zones: [],
      queues: [],
      matchState: { currentMinute: 10, phase: 'first_half' },
      groups: [],
      attendees: [
        { uid: 'no-token-user', section: 'B', fcmToken: null, prefs: [] },
        { uid: 'has-token-user', section: 'B', fcmToken: 'tok-xyz', prefs: [] },
      ],
    });

    mockWasNudgedRecently.mockResolvedValue(false);
    mockGenerateNudgeDecision.mockResolvedValue({ send: false });

    const nudges = await runPredictionCycle('evt-001');

    expect(mockGenerateNudgeDecision).toHaveBeenCalledTimes(1);
    expect(mockGenerateNudgeDecision.mock.calls[0][0].uid).toBe('has-token-user');
    expect(nudges).toHaveLength(0);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function setupMockFirestore({ zones, queues, matchState, groups, attendees }) {
  const zoneSubcols = zones.map((z) => ({
    id: z.zone,
    doc: jest.fn(() => ({
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({ density: z.density }),
      }),
    })),
  }));

  const queueSubcols = queues.map((q) => ({
    id: q.standId,
    doc: jest.fn(() => ({
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({ standName: q.standName, waitMins: q.waitMins, capacity: q.capacity || 50 }),
      }),
    })),
  }));

  const groupDocs = groups.map((g) => ({ id: g.id || 'grp-1', data: () => g }));
  const attendeeDocs = attendees.map((a) => ({ id: a.uid, data: () => a }));

  firestoreConfig = {
    crowd_zones: {
      doc: jest.fn(() => ({
        listCollections: jest.fn().mockResolvedValue(zoneSubcols),
      })),
    },
    queue_states: {
      doc: jest.fn(() => ({
        listCollections: jest.fn().mockResolvedValue(queueSubcols),
      })),
    },
    events: {
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => matchState,
        }),
      })),
    },
    groups: {
      where: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            forEach: (cb) => groupDocs.forEach(cb),
          }),
        }),
      }),
    },
    attendees: {
      where: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({
          forEach: (cb) => attendeeDocs.forEach(cb),
        }),
      }),
    },
  };
}
