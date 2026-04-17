/**
 * analyticsService.js — In-Memory Analytics Pipeline
 * ───────────────────────────────────────────────────
 * Accumulates raw sensor ticks in a rolling time-series buffer and
 * exposes computed aggregate metrics for the Analytics dashboard.
 *
 * In production, this feeds into BigQuery via Pub/Sub → Dataflow.
 * Locally, we simulate the same aggregation in-process.
 */

const MAX_BUFFER_SIZE = 10_000;  // Max entries before oldest are evicted
const REVENUE_PER_VISITOR = 2.1; // £ average spend per concession visit

class AnalyticsService {
  constructor() {
    /** @type {Array<{type: string, payload: object, timestamp: number}>} */
    this._buffer = [];
    this._totalCrowdTicks = 0;
    this._totalQueueTicks = 0;
    this._totalMatchTicks = 0;
    this._peakDensity = { zone: null, density: 0 };
    this._concessionVisits = 0;

    console.log('[Analytics] ✓ Pipeline initialized');
  }

  /**
   * Record a raw sensor tick into the analytics buffer.
   * @param {'crowd'|'queue'|'match'} type
   * @param {object} payload
   */
  recordTick(type, payload) {
    const entry = { type, payload, timestamp: Date.now() };

    // Evict oldest if buffer is full
    if (this._buffer.length >= MAX_BUFFER_SIZE) {
      this._buffer.shift();
    }
    this._buffer.push(entry);

    // Update running counters
    switch (type) {
      case 'crowd':
        this._totalCrowdTicks++;
        if (payload.density > this._peakDensity.density) {
          this._peakDensity = { zone: payload.zone, density: payload.density };
        }
        break;
      case 'queue':
        this._totalQueueTicks++;
        this._concessionVisits += Math.floor(Math.random() * 5) + 1; // Simulated throughput
        break;
      case 'match':
        this._totalMatchTicks++;
        break;
    }
  }

  /**
   * Returns computed aggregate metrics for the Analytics dashboard.
   */
  getMetrics() {
    // Compute average density across latest crowd ticks
    const crowdTicks = this._buffer.filter((e) => e.type === 'crowd');
    const latestByZone = {};
    for (const tick of crowdTicks) {
      latestByZone[tick.payload.zone] = tick.payload.density;
    }

    const densities = Object.values(latestByZone);
    const avgDensity = densities.length > 0
      ? densities.reduce((a, b) => a + b, 0) / densities.length
      : 0;

    // Congestion risk: % of zones above 0.75 density
    const hotZones = densities.filter((d) => d > 0.75);
    const congestionRisk = densities.length > 0
      ? Math.round((hotZones.length / densities.length) * 100)
      : 0;

    // Estimated active devices (scaled from crowd ticks)
    const activeDevices = Math.floor(this._totalCrowdTicks * 42 + 38000 + Math.random() * 2000);

    // Revenue projection
    const revenue = (this._concessionVisits * REVENUE_PER_VISITOR).toFixed(1);

    return {
      activeDevices,
      revenue: `£${(revenue / 1000).toFixed(1)}K`,
      revenueRaw: parseFloat(revenue),
      congestionRisk,
      avgDensity: parseFloat(avgDensity.toFixed(3)),
      peakZone: this._peakDensity,
      totalTicks: {
        crowd: this._totalCrowdTicks,
        queue: this._totalQueueTicks,
        match: this._totalMatchTicks,
      },
      bufferSize: this._buffer.length,
    };
  }

  /**
   * Returns a rolling time-series of density and queue data.
   * @param {number} minutes — lookback window (default 10)
   */
  getTimeline(minutes = 10) {
    const cutoff = Date.now() - minutes * 60 * 1000;
    const windowEntries = this._buffer.filter((e) => e.timestamp >= cutoff);

    // Bucket by 30-second intervals
    const buckets = {};
    for (const entry of windowEntries) {
      const bucketKey = Math.floor(entry.timestamp / 30000) * 30000;
      if (!buckets[bucketKey]) {
        buckets[bucketKey] = { timestamp: bucketKey, crowd: [], queue: [] };
      }
      if (entry.type === 'crowd') {
        buckets[bucketKey].crowd.push(entry.payload.density);
      }
      if (entry.type === 'queue') {
        buckets[bucketKey].queue.push(entry.payload.waitMins);
      }
    }

    // Aggregate each bucket
    return Object.values(buckets)
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((b) => ({
        timestamp: new Date(b.timestamp).toISOString(),
        avgDensity: b.crowd.length > 0
          ? parseFloat((b.crowd.reduce((a, c) => a + c, 0) / b.crowd.length).toFixed(3))
          : null,
        avgWaitMins: b.queue.length > 0
          ? parseFloat((b.queue.reduce((a, c) => a + c, 0) / b.queue.length).toFixed(1))
          : null,
      }));
  }
}

// Singleton
const analytics = new AnalyticsService();

export { analytics, AnalyticsService };
export default analytics;
