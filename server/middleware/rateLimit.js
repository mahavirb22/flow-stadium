/**
 * rateLimit.js — Rate Limiting Middleware
 * ───────────────────────────────────────
 * Two tiers:
 *   • General API: 60 req/min per IP
 *   • Chat endpoint: 20 req/min per authenticated user
 */

import rateLimit from 'express-rate-limit';

/**
 * General API rate limiter — 60 requests per minute per IP.
 * Applied to all /api/* routes.
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  handler: (_req, res) => {
    const retryAfter = Math.ceil(60); // window is 60s
    res.status(429).json({
      error: 'Too many requests',
      retryAfter,
    });
  },
});

/**
 * Chat/AI endpoint rate limiter — 20 requests per minute per user UID.
 * Falls back to IP if no user is attached (shouldn't happen behind auth).
 */
export const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.uid || req.ip,
  handler: (req, res) => {
    const retryAfter = Math.ceil(60);
    res.status(429).json({
      error: 'Too many requests',
      retryAfter,
    });
  },
});

export default { apiLimiter, chatLimiter };
