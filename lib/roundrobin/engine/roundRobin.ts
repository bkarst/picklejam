/**
 * roundRobin.ts — E1: circle-method round robin (§6.8).
 *
 * Every competitor (a singles player or a fixed doubles TEAM — one entrant
 * either way) meets every other exactly once, or twice with `playEveryoneTwice`.
 * Odd counts add a rotating BYE sentinel so exactly one entrant sits per round
 * and bye counts differ by ≤ 1. Fully STATIC: schedule = f(config, rngSeed).
 */

import type { RrConfig, RrRound } from "../types";
import { circleRounds, mkMatch, padEven, seededOrder } from "./shared";

/** Build the pairing rounds; reused by E5 pool play (via `poolRoundRobin`). */
function buildRounds(
  competitorIds: string[],
  courts: number,
  playTwice: boolean,
  startRound: number,
): RrRound[] {
  const n = competitorIds.length;
  const m = padEven(n);
  // Sentinel index `n` (only when odd) represents "bye".
  const token = (idx: number): string | null => (idx < n ? competitorIds[idx] : null);

  const pass = circleRounds(m); // m-1 rounds
  const rounds: RrRound[] = [];

  const emit = (roundOffset: number, swap: boolean) => {
    pass.forEach((pairs, r) => {
      const roundNum = startRound + roundOffset + r;
      const matches = [];
      const byes: string[] = [];
      let idx = 0;
      for (const [i, j] of pairs) {
        const a = token(i);
        const b = token(j);
        if (a === null && b === null) continue;
        if (a === null) {
          byes.push(b as string);
          continue;
        }
        if (b === null) {
          byes.push(a);
          continue;
        }
        const [sideA, sideB] = swap ? [[b], [a]] : [[a], [b]];
        matches.push(
          mkMatch(roundNum, idx, sideA, sideB, { court: (idx % courts) + 1 }),
        );
        idx++;
      }
      rounds.push({ round: roundNum, matches, byes, label: `Round ${roundNum}` });
    });
  };

  emit(0, false);
  // "Twice": replay the identical set of pairings (sides swapped) so every
  // unordered pair meets exactly twice and byes double fairly.
  if (playTwice) emit(pass.length, true);

  return rounds;
}

/** E1 static schedule. */
export function generateRoundRobin(config: RrConfig): RrRound[] {
  const ids = seededOrder(
    config.entrants.map((e) => e.id),
    config.rngSeed,
  );
  return buildRounds(ids, Math.max(1, config.courts), !!config.playEveryoneTwice, 1);
}

/**
 * Deterministic (NON-shuffled) round-robin over an ordered member list, for E5
 * pools. Members are already snake-seeded; do not reshuffle. Matches carry the
 * given pool label + a stable id prefix so ids stay unique across the event.
 */
export function poolRoundRobin(
  memberIds: string[],
  courts: number,
  label: string,
  idPrefix: string,
): RrRound[] {
  const rounds = buildRounds(memberIds, courts, false, 1);
  for (const round of rounds) {
    round.label = label;
    round.matches.forEach((mm, i) => {
      mm.id = `${idPrefix}-r${round.round}m${i}`;
      mm.label = label;
    });
  }
  return rounds;
}
