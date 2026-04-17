/**
 * fcmService.test.js
 * ──────────────────
 * Jest tests for the server-side FCM delivery service.
 *
 * Run: node --experimental-vm-modules ../node_modules/jest/bin/jest.js
 */

import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';

// ─── Shared Mock State ──────────────────────────────────────────

const mockSend = jest.fn();
const mockDocGet = jest.fn();
const mockDocSet = jest.fn();
let firestoreData = {};

// ─── Mock firebase-admin/messaging ──────────────────────────────

jest.unstable_mockModule('firebase-admin/messaging', () => ({
  getMessaging: () => ({
    send: mockSend,
  }),
}));

// ─── Mock firebase-admin/firestore ──────────────────────────────

jest.unstable_mockModule('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: (name) => ({
      doc: (id) => {
        const key = `${name}/${id}`;
        return {
          get: () => {
            if (firestoreData[key]) {
              return Promise.resolve({
                exists: true,
                data: () => firestoreData[key],
              });
            }
            return Promise.resolve({ exists: false, data: () => null });
          },
          set: mockDocSet,
          collection: (sub) => ({
            doc: (subId) => ({
              get: jest.fn().mockResolvedValue({ exists: false }),
              set: mockDocSet,
            }),
          }),
        };
      },
    }),
  }),
  FieldValue: {
    serverTimestamp: () => 'SERVER_TIMESTAMP',
  },
}));

// ─── Mock nudgeDeduplicator ─────────────────────────────────────

const mockLogNudgeSent = jest.fn().mockResolvedValue(undefined);

jest.unstable_mockModule('../services/nudgeDeduplicator.js', () => ({
  logNudgeSent: mockLogNudgeSent,
  wasNudgedRecently: jest.fn().mockResolvedValue(false),
  default: { logNudgeSent: mockLogNudgeSent },
}));

// ─── Dynamic Imports ────────────────────────────────────────────

let sendNudge;
let sendGroupNudge;

beforeAll(async () => {
  const mod = await import('../services/fcmService.js');
  sendNudge = mod.sendNudge;
  sendGroupNudge = mod.sendGroupNudge;
});

beforeEach(() => {
  jest.clearAllMocks();
  firestoreData = {};
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. sendNudge — correct payload structure
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('sendNudge — correct payload', () => {
  it('calls admin.messaging().send with correct payload structure', async () => {
    // Setup attendee with token
    firestoreData['attendees/user-1'] = { fcmToken: 'test-token-abc123' };
    mockSend.mockResolvedValue('msg-id-001');

    const nudge = {
      title: 'Halftime soon!',
      body: 'Stand 3 has only 2 min wait. Go now!',
      action: 'navigate',
      deeplink: 'flow://navigate?dest=stand_3',
      eventId: 'evt-001',
    };

    const result = await sendNudge('user-1', nudge);

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg-id-001');

    // Verify send was called with correct structure
    expect(mockSend).toHaveBeenCalledTimes(1);
    const sentMessage = mockSend.mock.calls[0][0];

    expect(sentMessage.token).toBe('test-token-abc123');
    expect(sentMessage.notification.title).toBe('Halftime soon!');
    expect(sentMessage.notification.body).toBe('Stand 3 has only 2 min wait. Go now!');
    expect(sentMessage.data.action).toBe('navigate');
    expect(sentMessage.data.deeplink).toBe('flow://navigate?dest=stand_3');
    expect(sentMessage.android.priority).toBe('high');
    expect(sentMessage.android.notification.channelId).toBe('flow_nudges');
    expect(sentMessage.apns.payload.aps.sound).toBe('default');
    expect(sentMessage.apns.payload.aps.badge).toBe(1);

    // Verify dedup log was called
    expect(mockLogNudgeSent).toHaveBeenCalledWith('user-1', 'evt-001', nudge);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. sendNudge — missing FCM token
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('sendNudge — missing FCM token', () => {
  it('returns { success: false } without throwing when attendee has no token', async () => {
    firestoreData['attendees/no-token-user'] = { section: 'A' }; // no fcmToken

    const nudge = { title: 'Test', body: 'Test body', action: 'info' };

    const result = await sendNudge('no-token-user', nudge);

    expect(result.success).toBe(false);
    expect(result.error).toContain('No FCM token');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('returns { success: false } when attendee document does not exist', async () => {
    // firestoreData has nothing for this uid

    const nudge = { title: 'Test', body: 'Test body', action: 'info' };

    const result = await sendNudge('nonexistent-user', nudge);

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('returns { success: false } when uid is null', async () => {
    const result = await sendNudge(null, { title: 'Test', body: 'Test' });

    expect(result.success).toBe(false);
    expect(mockSend).not.toHaveBeenCalled();
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. sendGroupNudge — parallel delivery
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('sendGroupNudge — parallel delivery', () => {
  it('sends to all group members in parallel', async () => {
    // Setup group with 3 members
    firestoreData['groups/grp-1'] = {
      memberUids: ['alice', 'bob', 'charlie'],
    };

    // Setup attendees with tokens
    firestoreData['attendees/alice'] = { fcmToken: 'token-alice' };
    firestoreData['attendees/bob'] = { fcmToken: 'token-bob' };
    firestoreData['attendees/charlie'] = { fcmToken: 'token-charlie' };

    mockSend.mockResolvedValue('msg-group');

    const nudge = {
      title: 'Meet at Gate 3',
      body: '3 of you heading out. 4 min walk.',
      action: 'navigate',
      deeplink: 'flow://navigate?dest=Gate%203',
      eventId: 'evt-001',
    };

    const result = await sendGroupNudge('grp-1', nudge);

    expect(result.total).toBe(3);
    expect(result.sent).toBe(3);
    expect(result.failed).toBe(0);

    // All 3 sends should have been called
    expect(mockSend).toHaveBeenCalledTimes(3);

    // Each send should have a different token
    const tokens = mockSend.mock.calls.map((c) => c[0].token);
    expect(tokens).toContain('token-alice');
    expect(tokens).toContain('token-bob');
    expect(tokens).toContain('token-charlie');
  });

  it('handles partial failures gracefully', async () => {
    firestoreData['groups/grp-2'] = {
      memberUids: ['dave', 'eve'],
    };

    // Dave has a token, Eve does not
    firestoreData['attendees/dave'] = { fcmToken: 'token-dave' };
    firestoreData['attendees/eve'] = { section: 'B' }; // no token

    mockSend.mockResolvedValue('msg-partial');

    const nudge = { title: 'Test', body: 'Test', action: 'info', eventId: 'evt-001' };

    const result = await sendGroupNudge('grp-2', nudge);

    expect(result.total).toBe(2);
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
  });

  it('returns empty result for nonexistent group', async () => {
    const result = await sendGroupNudge('nonexistent', { title: 'T', body: 'B' });

    expect(result.total).toBe(0);
    expect(result.sent).toBe(0);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
