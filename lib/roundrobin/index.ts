/**
 * lib/roundrobin — public surface of the pure, seeded round-robin engine (§6.8).
 *
 * The engine is a deterministic function of `RrConfig` (incl. `rngSeed`) and
 * confirmed scores — "same seed ⇒ identical schedule for every viewer" (§14.1).
 */

export type * from "./types";
export {
  validateConfig,
  generateSchedule,
  nextRound,
  computeStandings,
  champion,
  isComplete,
  poolRoundCount,
} from "./engine";

// Randomness primitives (the ONLY source of randomness) — handy for callers that
// need to derive a fresh seed (e.g. "shuffle" on a not-started event).
export { makeRng, shuffle, randInt, deriveSeed } from "./rng";
