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
 * Greedily seat partnerships into matches, minimizing repeat opponents. When the
 * partnership count is ODD exactly one sits out — chosen for BYE FAIRNESS.
 */
function seatTables(
  partnerships: Pair[],
  oppCount: Map<string, number>,
  byeCount: Map<string, number>,
  courts: number,
  roundNum: number,
  rng: () => number,
): { matches: Match[]; byes: string[] } {
  const remaining = partnerships.slice();
  const matches: Match[] = [];
  const byes: string[] = [];
  let idx = 0;

  // Odd partnership count ⇒ one partnership sits out. Pick the FAIREST bye — the pair whose
  // players have the fewest prior byes (rng tie-break) — instead of whatever the greedy
  // opponent-picker happened to leave over, which starved some players and benched others
  // 4-of-5 rounds (M27). `byeCount` spans BOTH the sentinel bye and this leftover bye.
  if (remaining.length % 2 === 1) {
    // Rank byeable pairs by (max prior byes of the two, then their sum) ascending, so we
    // bench the pair that pushes NO player far ahead — keeping the per-player bye counts
    // tight rather than benching a low-bye player next to an already-benched partner.
    let bestMax = Infinity;
    let bestSum = Infinity;
    const candidates: number[] = [];
    for (let k = 0; k < remaining.length; k++) {
      const [a, b] = remaining[k];
      const ca = byeCount.get(a) ?? 0;
      const cb = byeCount.get(b) ?? 0;
      const mx = Math.max(ca, cb);
      const sm = ca + cb;
      if (mx < bestMax || (mx === bestMax && sm < bestSum)) {
        bestMax = mx;
        bestSum = sm;
        candidates.length = 0;
        candidates.push(k);
      } else if (mx === bestMax && sm === bestSum) {
        candidates.push(k);
      }
    }
    const [a, b] = remaining.splice(candidates[Math.floor(rng() * candidates.length)], 1)[0];
    byes.push(a, b);
    byeCount.set(a, (byeCount.get(a) ?? 0) + 1);
    byeCount.set(b, (byeCount.get(b) ?? 0) + 1);
  }

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
  const byeCount = new Map<string, number>(); // total byes per player, for bye fairness (M27)
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
    // The sentinel bye (odd player count, rotated fairly by the circle method) counts toward
    // bye history so seatTables balances the leftover-partnership bye against it too.
    for (const b of byes) byeCount.set(b, (byeCount.get(b) ?? 0) + 1);
    const rng = makeRng(deriveSeed(config.rngSeed, r + 1));
    const seated = seatTables(partnerships, oppCount, byeCount, courts, r + 1, rng);
    rounds.push({
      round: r + 1,
      matches: seated.matches,
      byes: [...byes, ...seated.byes],
      label: `Round ${r + 1}`,
    });
  }

  return rounds;
}
