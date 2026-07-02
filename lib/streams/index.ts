/**
 * streams — DynamoDB Streams → aggregation scaffolding (PRD §9.4, Stage 0.5).
 *
 * Public surface:
 *  • aggregator — `applyStreamRecord` (dispatcher) + `materializeStandings` (stub).
 *  • reconcile  — ground-truth repair sweep for §9.4 aggregates.
 *  • local      — the dev/test emulation harness (`processRecords`, poller).
 *
 * These are all SERVER-only modules (they touch the DB); do not import from a
 * client component.
 */

export {
  applyStreamRecord,
  materializeStandings,
  type StreamRecord,
  type StreamEventName,
  type StandingsEntityType,
} from "./aggregator";

export {
  reconcileCourtReviews,
  reconcileGroupMemberCount,
  reconcileOrphans,
  type CourtReviewAggregate,
  type OrphanHealReport,
} from "./reconcile";

export {
  processRecords,
  runLocalStreamConsumer,
  normalizeRecord,
  type LocalStreamConsumerOptions,
} from "./local";
