/**
 * Cloud Functions entry point.
 * Re-exports all function triggers so Firebase picks them up.
 */

export { onCrowdUpdate, onQueueUpdate, onMatchEvent } from './pubsubConsumer.js';
export { onGroupUpdated } from './groupCoordinator.js';
