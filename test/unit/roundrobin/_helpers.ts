/**
 * Shared fixtures + simulation helpers for the round-robin engine property
 * tests (§14.1). Not a test file (no `.test` suffix) — imported by the suites.
 */
import type { Entrant, Match, RrConfig, RrRound, ScoringConfig } from "@/lib/roundrobin/types";
import { generateSchedule, nextRound } from "@/lib/roundrobin/engine";

export const SCORING: ScoringConfig = { pointsToWin: 11, winBy: 2 };

/** `n` entrants `e0..e{n-1}`; `withSeed` stamps 1-based seeds. */
export function entrants(n: number, withSeed = false): Entrant[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `e${i}`,
    name: `P${i}`,
    ...(withSeed ? { seed: i + 1 } : {}),
  }));
}

/** Unordered key for a pair of entrant ids. */
export const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Every entrant id appearing on either side of a match. */
export const matchIds = (m: Match): string[] => [...m.sideA, ...m.sideB];

/** A decision function picks the winning slot of a match. */
export type Decide = (m: Match) => "A" | "B";

/** Apply scores to one round per `decide` (winner = pointsToWin, loser = 3). */
export function scoreRound(round: RrRound, decide: Decide, pointsToWin = 11): RrRound {
  return {
    ...round,
    matches: round.matches.map((m) => {
      const w = decide(m);
      const win = pointsToWin;
      const lose = 3;
      return {
        ...m,
        scoreA: w === "A" ? win : lose,
        scoreB: w === "B" ? win : lose,
        status: "scored" as const,
      };
    }),
  };
}

/**
 * Drive a full event: generate the static schedule, score every round via
 * `decide`, and keep pulling `nextRound` until the engine is done.
 */
export function simulate(config: RrConfig, decide: Decide): RrRound[] {
  const sched = generateSchedule(config);
  const rounds: RrRound[] = sched.rounds.map((r) => scoreRound(r, decide, config.scoring.pointsToWin));
  // Guard against runaway loops in a buggy dynamic format.
  for (let guard = 0; guard < 500; guard++) {
    const nr = nextRound(config, rounds);
    if (!nr) break;
    rounds.push(scoreRound(nr, decide, config.scoring.pointsToWin));
  }
  return rounds;
}

/** Winner always side A — the simplest deterministic decision. */
export const sideAWins: Decide = () => "A";
