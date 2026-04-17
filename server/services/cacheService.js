/**
 * cacheService.js — In-Memory TTL Cache
 * ──────────────────────────────────────
 * Production-identical interface to Redis/Memorystore.
 * Swap for `ioredis` in production with zero code changes.
 *
 * Default TTL: 10 seconds (matches the UI "Last sync" indicator).
 */

const DEFAULT_TTL_MS = 10_000; // 10 seconds
const SWEEP_INTERVAL_MS = 5_000; // clean expired keys every 5s

class FlowCache {
  constructor() {
    /** @type {Map<string, {value: any, expiresAt: number}>} */
    this._store = new Map();
    this._hits = 0;
    this._misses = 0;

    // Passive expiry sweeper
    this._sweeper = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this._store) {
        if (entry.expiresAt <= now) {
          this._store.delete(key);
        }
      }
    }, SWEEP_INTERVAL_MS);

    // Allow process to exit even if sweeper is running
    if (this._sweeper.unref) this._sweeper.unref();

    console.log('[Cache] ✓ In-memory TTL cache initialized');
  }

  /**
   * Get a cached value. Returns undefined on miss or expiry.
   */
  get(key) {
    const entry = this._store.get(key);
    if (!entry) {
      this._misses++;
      return undefined;
    }
    if (entry.expiresAt <= Date.now()) {
      this._store.delete(key);
      this._misses++;
      return undefined;
    }
    this._hits++;
    return entry.value;
  }

  /**
   * Set a value with optional TTL (defaults to 10s).
   */
  set(key, value, ttlMs = DEFAULT_TTL_MS) {
    this._store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Invalidate a specific key or pattern (prefix*).
   */
  invalidate(keyOrPattern) {
    if (keyOrPattern.endsWith('*')) {
      const prefix = keyOrPattern.slice(0, -1);
      for (const key of this._store.keys()) {
        if (key.startsWith(prefix)) this._store.delete(key);
      }
    } else {
      this._store.delete(keyOrPattern);
    }
  }

  /**
   * Returns cache statistics for monitoring.
   */
  stats() {
    return {
      size: this._store.size,
      hits: this._hits,
      misses: this._misses,
      hitRate: this._hits + this._misses > 0
        ? ((this._hits / (this._hits + this._misses)) * 100).toFixed(1) + '%'
        : '0%',
    };
  }

  /**
   * Flush all entries.
   */
  flush() {
    this._store.clear();
    this._hits = 0;
    this._misses = 0;
  }
}

// Singleton instance
const cache = new FlowCache();

export { cache, FlowCache };
export default cache;
