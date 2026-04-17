/**
 * auth.js — Authentication Middleware
 * ────────────────────────────────────
 * Verifies Firebase ID tokens from the Authorization header.
 * Checks if the user is banned via Firestore banned_users collection.
 */

import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// ─── Token Verification Cache (60s TTL) ─────────────────────────
// Avoids hitting Firebase Auth on every single API request.
const _tokenCache = new Map();
const TOKEN_CACHE_TTL_MS = 60_000;

function getCachedToken(token) {
  const entry = _tokenCache.get(token);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > TOKEN_CACHE_TTL_MS) {
    _tokenCache.delete(token);
    return null;
  }
  return entry.decoded;
}

function setCachedToken(token, decoded) {
  _tokenCache.set(token, { decoded, cachedAt: Date.now() });
  // Evict stale entries periodically
  if (_tokenCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of _tokenCache) {
      if (now - v.cachedAt > TOKEN_CACHE_TTL_MS) _tokenCache.delete(k);
    }
  }
}

/**
 * Express middleware that:
 * 1. Extracts Bearer token from Authorization header
 * 2. Verifies it with Firebase Admin Auth
 * 3. Checks Firestore banned_users for the uid
 * 4. Attaches decoded token to req.user
 *
 * Returns 401 if token is missing/invalid, 403 if user is banned.
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  // ── 1. Extract token ────────────────────────────────────────────
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing or malformed Authorization header' });
  }

  const token = authHeader.split('Bearer ')[1].trim();

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Token is empty' });
  }

  // ── 2. Verify token (cache-first) ──────────────────────────────
  let decoded = getCachedToken(token);
  if (!decoded) {
    try {
      decoded = await getAuth().verifyIdToken(token);
      setCachedToken(token, decoded);
    } catch (err) {
      const message =
        err.code === 'auth/id-token-expired'
          ? 'Token has expired'
          : err.code === 'auth/id-token-revoked'
            ? 'Token has been revoked'
            : 'Invalid token';

      return res.status(401).json({ error: 'Unauthorized', message });
    }
  }

  // ── 3. Check banned status ──────────────────────────────────────
  try {
    const db = getFirestore();
    const bannedDoc = await db.collection('banned_users').doc(decoded.uid).get();

    if (bannedDoc.exists) {
      const data = bannedDoc.data();
      if (data.banned === true) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Account has been suspended',
          reason: data.reason || undefined,
        });
      }
    }
  } catch (err) {
    // Non-fatal — log and allow through rather than blocking all requests
    console.error('[Auth] Banned check failed:', err.message);
  }

  // ── 4. Attach user to request ───────────────────────────────────
  req.user = decoded;
  next();
}

/**
 * Optional auth — attaches user if token present, but doesn't reject.
 * Useful for endpoints that behave differently for authed vs anon users.
 */
export async function optionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1].trim();
    try {
      req.user = await getAuth().verifyIdToken(token);
    } catch {
      // Silently ignore — user remains null
      req.user = null;
    }
  }

  next();
}

export default { requireAuth, optionalAuth };
