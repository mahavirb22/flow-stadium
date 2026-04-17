/**
 * nudgeLoop.js
 * ------------
 * Runs the prediction engine on a 60-second interval, dispatching
 * nudges via FCM for each actionable result.
 *
 * Each cycle is isolated — a single attendee failure never crashes the loop.
 */

import { runPredictionCycle } from '../services/predictionEngine.js';
import { logNudgeSent } from '../services/nudgeDeduplicator.js';
import { sendNudge } from '../services/fcmService.js';

// ─── Constants ──────────────────────────────────────────────────
const CYCLE_INTERVAL_MS = 60_000; // 60 seconds

// ─── Loop Controller ────────────────────────────────────────────

let intervalHandle = null;
let cycleCount = 0;

/**
 * Starts the nudge loop for a specific event.
 * Runs one prediction cycle immediately, then repeats every 60 seconds.
 *
 * @param {string} eventId
 * @returns {{ stop: () => void }}  Handle to stop the loop
 */
export function startNudgeLoop(eventId) {
  if (!eventId) throw new Error('[NudgeLoop] eventId is required.');

  console.log(`[NudgeLoop] ▶  Starting nudge loop for event=${eventId} (every ${CYCLE_INTERVAL_MS / 1000}s)`);

  async function executeCycle() {
    cycleCount += 1;
    const cycleId = cycleCount;
    console.log(`[NudgeLoop] ── Cycle #${cycleId} starting ──`);

    try {
      const nudges = await runPredictionCycle(eventId);

      let sent = 0;
      let failed = 0;

      for (const { uid, fcmToken, nudge } of nudges) {
        try {
          // Dispatch push notification
          await sendNudge(fcmToken, nudge);

          // Record in Firestore so dedup catches it next cycle
          await logNudgeSent(uid, eventId, nudge);

          sent += 1;
          console.log(`[NudgeLoop]   ✓ Nudge delivered to uid=${uid}: "${nudge.title}"`);
        } catch (nudgeErr) {
          failed += 1;
          console.error(`[NudgeLoop]   ✗ Failed to nudge uid=${uid}:`, nudgeErr.message);
          // Continue to next attendee — never let one failure crash the loop
        }
      }

      console.log(
        `[NudgeLoop] ── Cycle #${cycleId} complete: ${sent} sent, ${failed} failed, ` +
        `${nudges.length} total ──`
      );
    } catch (cycleErr) {
      // Catch-all so the interval keeps running even on catastrophic errors
      console.error(`[NudgeLoop] ✗ Cycle #${cycleId} crashed:`, cycleErr.message);
    }
  }

  // Run immediately, then on interval
  executeCycle();
  intervalHandle = setInterval(executeCycle, CYCLE_INTERVAL_MS);

  return {
    stop() {
      if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
        console.log('[NudgeLoop] ■  Nudge loop stopped.');
      }
    },
  };
}

export default { startNudgeLoop };
