/**
 * auth.test.js
 * ────────────
 * Tests for auth middleware and rate limiting.
 * Uses Supertest against a minimal Express app with mocked Firebase Admin.
 */

import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';

// ─── Mock firebase-admin/auth ───────────────────────────────────

const mockVerifyIdToken = jest.fn();

jest.unstable_mockModule('firebase-admin/auth', () => ({
  getAuth: () => ({
    verifyIdToken: mockVerifyIdToken,
  }),
}));

// ─── Mock firebase-admin/firestore ──────────────────────────────

const mockDocGet = jest.fn();

jest.unstable_mockModule('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: () => ({
      doc: () => ({
        get: mockDocGet,
      }),
    }),
  }),
  FieldValue: { serverTimestamp: () => 'SERVER_TS' },
}));

// ─── Import after mocks ────────────────────────────────────────

let requireAuth;
let express;
let request;

beforeAll(async () => {
  const authMod = await import('../middleware/auth.js');
  requireAuth = authMod.requireAuth;

  const expressMod = await import('express');
  express = expressMod.default;

  const supertestMod = await import('supertest');
  request = supertestMod.default;
});

beforeEach(() => {
  jest.clearAllMocks();
});

// Helper: create a minimal Express app with auth middleware
function createApp() {
  const app = express();
  app.use(express.json());
  app.get('/protected', requireAuth, (req, res) => {
    res.json({ uid: req.user.uid, email: req.user.email });
  });
  return app;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('Auth Middleware', () => {
  it('returns 401 when no Authorization header is present', async () => {
    const app = createApp();

    const res = await request(app).get('/protected');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
    expect(res.body.message).toMatch(/Missing/i);
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header has no Bearer prefix', async () => {
    const app = createApp();

    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Basic abc123');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('returns 401 when token is expired', async () => {
    const app = createApp();

    mockVerifyIdToken.mockRejectedValue(
      Object.assign(new Error('Token expired'), { code: 'auth/id-token-expired' })
    );

    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer expired-token');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
    expect(res.body.message).toMatch(/expired/i);
  });

  it('returns 401 when token is completely invalid', async () => {
    const app = createApp();

    mockVerifyIdToken.mockRejectedValue(
      Object.assign(new Error('Token invalid'), { code: 'auth/argument-error' })
    );

    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer garbage-token');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
    expect(res.body.message).toMatch(/Invalid/i);
  });

  it('attaches decoded user to req.user when token is valid', async () => {
    const app = createApp();

    const decoded = { uid: 'user-123', email: 'test@flow.app' };
    mockVerifyIdToken.mockResolvedValue(decoded);
    mockDocGet.mockResolvedValue({ exists: false }); // not banned

    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer valid-token-abc');

    expect(res.status).toBe(200);
    expect(res.body.uid).toBe('user-123');
    expect(res.body.email).toBe('test@flow.app');
    expect(mockVerifyIdToken).toHaveBeenCalledWith('valid-token-abc');
  });

  it('returns 403 when user is banned', async () => {
    const app = createApp();

    mockVerifyIdToken.mockResolvedValue({ uid: 'banned-user' });
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ banned: true, reason: 'Misconduct' }),
    });

    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer valid-but-banned');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.reason).toBe('Misconduct');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('Rate Limiting', () => {
  it('returns 429 after exceeding threshold', async () => {
    // Import the rate limiter
    const { apiLimiter } = await import('../middleware/rateLimit.js');

    const app = express();
    // Set a very low limit for testing
    const testLimiter = (await import('express-rate-limit')).default({
      windowMs: 60_000,
      max: 2,
      keyGenerator: (req) => req.ip,
      handler: (_req, res) => {
        res.status(429).json({ error: 'Too many requests', retryAfter: 60 });
      },
    });

    app.use(testLimiter);
    app.get('/test', (_req, res) => res.json({ ok: true }));

    // First two requests should pass
    const r1 = await request(app).get('/test');
    expect(r1.status).toBe(200);

    const r2 = await request(app).get('/test');
    expect(r2.status).toBe(200);

    // Third request should be rate limited
    const r3 = await request(app).get('/test');
    expect(r3.status).toBe(429);
    expect(r3.body.error).toBe('Too many requests');
    expect(r3.body.retryAfter).toBe(60);
  });
});
