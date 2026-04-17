/**
 * schemas.js — Zod Validation Schemas
 * ────────────────────────────────────
 * Production-grade ingestion validation for all sensor data payloads.
 * Prevents malformed JSON or out-of-range values from reaching Firestore.
 */

import { z } from 'zod';

// ─── Crowd Update ───────────────────────────────────────────────
export const CrowdUpdateSchema = z.object({
  zone: z.string().min(1).max(10),
  density: z.number().min(0).max(1),
  eventId: z.string().min(1).max(128),
  timestamp: z.string().optional(),
});

// ─── Queue Update ───────────────────────────────────────────────
export const QueueUpdateSchema = z.object({
  standId: z.string().min(1).max(64),
  standName: z.string().min(1).max(128).optional(),
  waitMins: z.number().min(0).max(120),
  capacity: z.number().min(0).max(10000).optional(),
  eventId: z.string().min(1).max(128),
  timestamp: z.string().optional(),
});

// ─── Match Event ────────────────────────────────────────────────
export const MatchEventSchema = z.object({
  type: z.enum([
    'first_half',
    'halftime_approaching',
    'halftime',
    'second_half',
    'full_time',
  ]),
  matchMinute: z.number().int().min(0).max(120).optional(),
  eventId: z.string().min(1).max(128),
  timestamp: z.string().optional(),
});

// ─── Ingest Payload (REST API) ──────────────────────────────────
export const IngestCrowdSchema = CrowdUpdateSchema;
export const IngestQueueSchema = QueueUpdateSchema;
export const IngestMatchSchema = MatchEventSchema;

/**
 * Express middleware factory — validates req.body against a Zod schema.
 * Returns 400 with structured errors if validation fails.
 */
export function zodValidate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        issues: result.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
          code: i.code,
        })),
      });
    }
    req.validated = result.data;
    next();
  };
}

export default {
  CrowdUpdateSchema,
  QueueUpdateSchema,
  MatchEventSchema,
  zodValidate,
};
