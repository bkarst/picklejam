/**
 * mixer.ts — E2: social mixer, ROTATING partners (§6.8).
 *
 * Entrants are individual players. Each round players are paired into
 * partnerships and partnerships are seated at tables (matches of two
 * partnerships = four players). Partnerships come from the circle method (a
 * 1-factorization): over the first `m-1` rounds every player partners every
 * other exactly once — so repeat partners are ZERO within the feasible window.
 * Opponents are then chosen greedily to minimize repeat opponents.
 *
 * `popcorn` = HARD no-repeat-partner: rounds are clamped to that feasible max
 * (`m-1`). Fully STATIC given the seed.
 */

import type { Match, RrConfig, RrRound } from "../types";
import { circleRounds, mkMatch, padEven } from "./shared";
import { makeRng, deriveSeed } from "../rng";

type Pair = [string, string];

/** The most rounds a hard no-repeat-partner mixer can run for `n` players. */
export function mixerFeasibleMax(n: number): number {
  return padEven(n) - 1;
}

/** Undirected key for a player-pair count. */
const pk = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Greedily seat partnerships into matches, minimizing repeat opponents. A
 * leftover (odd) partnership sits out — both its players take a bye.
 */
function seatTables(
  partnerships: Pair[],
  oppCount: Map<string, number>,
  courts: number,
  roundNum: number,
  rng: () => number,
): { matches: Match[]; byes: string[] } {
  const remaining = partnerships.slice();
  const matches: Match[] = [];
  const byes: string[] = [];
  let idx = 0;

  while (remaining.length >= 2) {
    const P = remaining.shift() as Pair;
    // Pick the opponent partnership with the fewest prior cross-encounters.
    let best = Infinity;
    const candidates: number[] = [];
    for (let k = 0; k < remaining.length; k++) {
      const Q = remaining[k];
      let score = 0;
      for (const a of P) for (const b of Q) score += oppCount.get(pk(a, b)) ?? 0;
      if (score < best) {
        best = score;
        candidates.length = 0;
        candidates.push(k);
      } else if (score === best) {
        candidates.push(k);
      }
    }
    const chosen = candidates[Math.floor(rng() * candidates.length)];
    const Q = remaining.splice(chosen, 1)[0];
    for (const a of P) for (const b of Q) oppCount.set(pk(a, b), (oppCount.get(pk(a, b)) ?? 0) + 1);
    matches.push(mkMatch(roundNum, idx, [...P], [...Q], { court: (idx % courts) + 1 }));
    idx++;
  }
  if (remaining.length === 1) byes.push(...remaining[0]);
  return { matches, byes };
}

/** E2 static schedule. */
export function generateMixer(config: RrConfig): RrRound[] {
  const courts = Math.max(1, config.courts);
  // Seed-dependent player order, then a fixed BYE sentinel if odd.
  const players: (string | null)[] = config.entrants.map((e) => e.id);
  const seedRng = makeRng(config.rngSeed);
  for (let i = players.length - 1; i > 0; i--) {
    const j = Math.floor(seedRng() * (i + 1));
    [players[i], players[j]] = [players[j], players[i]];
  }
  const m = padEven(players.length);
  if (players.length % 2 === 1) players.push(null); // sentinel

  const feasibleMax = m - 1;
  const requested = config.rounds ?? feasibleMax;
  const total = config.popcorn ? Math.min(requested, feasibleMax) : Math.max(0, requested);

  const pass = circleRounds(m); // each round = perfect matching of indices
  const oppCount = new Map<string, number>();
  const rounds: RrRound[] = [];

  for (let r = 0; r < total; r++) {
    // Beyond the feasible window (non-popcorn only) the factorization cycles.
    const pairs = pass[r % pass.length];
    const partnerships: Pair[] = [];
    const byes: string[] = [];
    for (const [i, j] of pairs) {
      const a = players[i];
      const b = players[j];
      if (a === null && b === null) continue;
      if (a === null) byes.push(b as string);
      else if (b === null) byes.push(a);
      else partnerships.push([a, b]);
    }
    const rng = makeRng(deriveSeed(config.rngSeed, r + 1));
    const seated = seatTables(partnerships, oppCount, courts, r + 1, rng);
    rounds.push({
      round: r + 1,
      matches: seated.matches,
      byes: [...byes, ...seated.byes],
      label: `Round ${r + 1}`,
    });
  }

  return rounds;
}
