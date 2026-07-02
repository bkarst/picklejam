/**
 * engine/index.ts — the public engine surface (§6.8), dispatching each format.
 *
 * Everything is PURE and SEEDED:
 *  - `generateSchedule` = f(config)                     (static, up-front rounds)
 *  - `nextRound`        = f(config, confirmed scores)   (dynamic advance)
 *  - `computeStandings` / `champion` = f(config, rounds)
 */

import type { RrConfig, RrRound, Schedule } from "../types";
import { isDecided } from "./shared";
import { computeStandings } from "./standings";
import { generateRoundRobin } from "./roundRobin";
import { generateMixer } from "./mixer";
import { movementRound1, movementNext, movementChampion, movementRounds } from "./movement";
import { swissRound } from "./swiss";
import { poolSchedule, poolsNext, poolsChampion } from "./pools";

export { validateConfig } from "./validate";
export { computeStandings } from "./standings";

/** Static schedule = f(config). Dynamic formats return what is known up front. */
export function generateSchedule(config: RrConfig): Schedule {
  switch (config.format) {
    case "roundRobin":
      return { rounds: generateRoundRobin(config), dynamic: false };
    case "mixer":
      return { rounds: generateMixer(config), dynamic: false };
    case "movement": {
      // Both kinds are result-driven → dynamic; only round 1 is known up front.
      const r1 = movementRound1(config);
      return { rounds: [r1], dynamic: true };
    }
    case "swiss": {
      const r1 = swissRound(config, []);
      return { rounds: r1 ? [r1] : [], dynamic: true };
    }
    case "poolsBracket":
      return { rounds: poolSchedule(config), dynamic: true };
    default:
      return { rounds: [], dynamic: false };
  }
}

/** Dynamic advance = f(seed + confirmed scores). Null for static formats / when complete. */
export function nextRound(config: RrConfig, completed: RrRound[]): RrRound | null {
  switch (config.format) {
    case "roundRobin":
    case "mixer":
      return null; // fully static
    case "movement":
      return movementNext(config, completed);
    case "swiss":
      return swissRound(config, completed);
    case "poolsBracket":
      return poolsNext(config, completed);
    default:
      return null;
  }
}

/** True once every match is scored AND no further round can be generated. */
export function isComplete(config: RrConfig, rounds: RrRound[]): boolean {
  if (rounds.length === 0) return false;
  const allScored = rounds.every((r) => r.matches.every(isDecided));
  if (!allScored) return false;
  return nextRound(config, rounds) === null;
}

/** The event winner once decided, else null. */
export function champion(config: RrConfig, rounds: RrRound[]): string | null {
  if (config.format === "poolsBracket") {
    return poolsChampion(config, rounds);
  }
  if (config.format === "movement") {
    if (config.movement === "king") return movementChampion(config, rounds);
    // Up & Down the River: ranked by standings once the run is complete.
    if (rounds.length < movementRounds(config)) return null;
    if (!isComplete(config, rounds)) return null;
    const st = computeStandings(config, rounds);
    return st.length ? st[0].entrantId : null;
  }
  // E1 / E2 / E4: the clear standings leader once the event is complete.
  if (!isComplete(config, rounds)) return null;
  const st = computeStandings(config, rounds);
  return st.length ? st[0].entrantId : null;
}
