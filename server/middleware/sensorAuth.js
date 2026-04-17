/**
 * sensorAuth.js — Sensor Device Authentication Middleware
 * ───────────────────────────────────────────────────────
 * Verifies X-Sensor-Token header for physical IoT sensor payloads.
 * Uses HMAC-SHA256 signature validation against a shared secret.
 *
 * In production, each sensor has a unique key stored in Secret Manager.
 * Locally, we use SENSOR_SECRET from .env.
 */

import { createHmac } from 'crypto';

const SENSOR_SECRET = process.env.SENSOR_SECRET || 'flow-stadium-sensor-key-2024';

/**
 * Express middleware that verifies sensor authentication.
 *
 * Accepts two formats:
 *   1. Static token: X-Sensor-Token: <secret>
 *   2. HMAC signature: X-Sensor-Token: hmac:<timestamp>:<signature>
 *      where signature = HMAC-SHA256(secret, timestamp + ':' + body)
 *
 * Returns 401 if token is missing or invalid.
 */
export function requireSensorAuth(req, res, next) {
  const token = req.headers['x-sensor-token'];

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing X-Sensor-Token header',
    });
  }

  // ── Format 1: Static token (dev/demo mode) ──────────────────
  if (token === SENSOR_SECRET) {
    req.sensor = { type: 'static', verified: true };
    return next();
  }

  // ── Format 2: HMAC signature (production) ───────────────────
  if (token.startsWith('hmac:')) {
    const parts = token.split(':');
    if (parts.length !== 3) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Malformed HMAC token',
      });
    }

    const [, timestamp, signature] = parts;
    const tsNum = parseInt(timestamp, 10);

    // Reject tokens older than 5 minutes
    if (Math.abs(Date.now() - tsNum) > 5 * 60 * 1000) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token timestamp expired',
      });
    }

    const body = JSON.stringify(req.body);
    const expected = createHmac('sha256', SENSOR_SECRET)
      .update(`${timestamp}:${body}`)
      .digest('hex');

    if (signature !== expected) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid HMAC signature',
      });
    }

    req.sensor = { type: 'hmac', verified: true, timestamp: tsNum };
    return next();
  }

  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Invalid sensor token format',
  });
}

export default { requireSensorAuth };
