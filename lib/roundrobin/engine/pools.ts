/**
 * pools.ts — E5: pool play → single-elimination bracket (§6.8).
 *
 * Entrants are snake-seeded into `poolCount` pools, each plays a round robin
 * (reusing E1), then the top `advancePerPool` from every pool advance to a
 * knockout bracket seeded across pools. The pool rounds are STATIC (returned by
 * `generateSchedule`); the bracket is DYNAMIC — `nextRound` builds it from
 * confirmed pool standings, then advances winners round by round, wiring
 * `winnerTo` / `loserTo` linkage and QF/SF/Final/3rd-place labels.
 *
 * SIMPLIFICATION: `elim: "double"` is treated as single-elim in this engine
 * (single-elim + a 3rd-place consolation). A losers bracket is deferred to the
 * generalized bracket renderer (Stage 6, per the roadmap).
 */

import type { Entrant, Match, RrConfig, RrRound } from "../types";
import {
  isDecided,
  mkMatch,
  nextPow2,
  padEven,
  rngKeyFor,
  seedMap,
  seedSlots,
  winnerSide,
  loserSide,
} from "./shared";
import { poolRoundRobin } from "./roundRobin";
import { computeStandings } from "./standings";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Snake-seed entrants into pools (seed 1→P0, 2→P1, …, then reverse). */
export function poolAssignment(config: RrConfig): { pools: Entrant[][]; letters: string[] } {
  const seeds = seedMap(config);
  const sorted = [...config.entrants].sort((a, b) => {
    const d = seeds.get(a.id)! - seeds.get(b.id)!;
    if (d !== 0) return d;
    return rngKeyFor(config.rngSeed, a.id) - rngKeyFor(config.rngSeed, b.id);
  });
  const poolCount = Math.max(1, config.pools?.poolCount ?? 1);
  const pools: Entrant[][] = Array.from({ length: poolCount }, () => []);
  sorted.forEach((e, i) => {
    const row = Math.floor(i / poolCount);
    const col = row % 2 === 0 ? i % poolCount : poolCount - 1 - (i % poolCount);
    pools[col].push(e);
  });
  return { pools, letters: pools.map((_, i) => LETTERS[i] ?? `P${i}`) };
}

/** Number of static pool rounds (max round-robin length across pools). */
export function poolRoundCount(config: RrConfig): number {
  const { pools } = poolAssignment(config);
  return Math.max(0, ...pools.map((p) => (p.length < 2 ? 0 : padEven(p.length) - 1)));
}

/** E5 static schedule: pool round robins, combined by round index. */
export function poolSchedule(config: RrConfig): RrRound[] {
  const { pools, letters } = poolAssignment(config);
  const courts = Math.max(1, config.courts);
  const perPool = pools.map((members, p) =>
    poolRoundRobin(members.map((m) => m.id), courts, `Pool ${letters[p]}`, letters[p]),
  );
  const maxR = Math.max(0, ...perPool.map((rs) => rs.length));
  const combined: RrRound[] = [];
  for (let r = 0; r < maxR; r++) {
    const matches: Match[] = [];
    const byes: string[] = [];
    for (const rs of perPool) {
      const round = rs[r];
      if (!round) continue;
      matches.push(...round.matches);
      byes.push(...round.byes);
    }
    matches.forEach((mm, i) => {
      mm.index = i;
      mm.court = (i % courts) + 1;
    });
    combined.push({ round: r + 1, matches, byes, label: `Round ${r + 1}` });
  }
  return combined;
}

/** Overall bracket seeding: top finishers per pool, tier-major (all #1s, #2s…). */
function seedFromPools(config: RrConfig, poolRounds: RrRound[]): string[] {
  const { pools, letters } = poolAssignment(config);
  const advance = Math.max(1, config.pools?.advancePerPool ?? 1);
  const perPoolTop = pools.map((members, p) => {
    const scoped = poolRounds.map((r) => ({
      ...r,
      matches: r.matches.filter((m) => m.id.startsWith(`${letters[p]}-`)),
    }));
    const subConfig: RrConfig = { ...config, format: "roundRobin", entrants: members, pools: undefined };
    return computeStandings(subConfig, scoped).slice(0, advance).map((s) => s.entrantId);
  });
  const participants: string[] = [];
  for (let t = 0; t < advance; t++) {
    for (let p = 0; p < pools.length; p++) {
      const id = perPoolTop[p][t];
      if (id) participants.push(id);
    }
  }
  return participants;
}

/** Round labels/ids by bracket size at depth k (M = matches that round). */
function labelBase(B: number, k: number): { base: string; round: string } {
  const M = B / 2 ** k;
  if (M === 1) return { base: "Final", round: "Final" };
  if (M === 2) return { base: "SF", round: "Semifinals" };
  if (M === 4) return { base: "QF", round: "Quarterfinals" };
  return { base: `R${M * 2}`, round: `Round of ${M * 2}` };
}

const idFor = (B: number, k: number, i: number): string => {
  const { base } = labelBase(B, k);
  return base === "Final" ? "Final" : `${base}${i + 1}`;
};

/**
 * Emit the next bracket round from confirmed pool standings + prior bracket
 * results, or null while pools/prior rounds are still in progress.
 */
function nextBracketRound(
  config: RrConfig,
  participants: string[],
  bracketRounds: RrRound[],
  prc: number,
): RrRound | null {
  const P = participants.length;
  if (P < 2) return null;
  const B = nextPow2(P);
  const R = Math.round(Math.log2(B));
  const courts = Math.max(1, config.courts);
  const order = seedSlots(B);
  const slot: (string | null)[] = order.map((s) => (s <= P ? participants[s - 1] : null));

  const byId = new Map<string, Match>();
  for (const r of bracketRounds) for (const m of r.matches) byId.set(m.id, m);
  const decidedWinner = (id: string): string | null => {
    const m = byId.get(id);
    if (!m || !isDecided(m)) return null;
    const w = winnerSide(m);
    return w ? w[0] : null;
  };
  const decidedLoser = (id: string): string | null => {
    const m = byId.get(id);
    if (!m || !isDecided(m)) return null;
    const l = loserSide(m);
    return l ? l[0] : null;
  };

  const memo = new Map<string, string | null>();
  const winnerId = (k: number, i: number): string | null => {
    const key = `${k}:${i}`;
    if (memo.has(key)) return memo.get(key)!;
    let res: string | null;
    if (k === 1) {
      const a = slot[2 * i];
      const b = slot[2 * i + 1];
      if (a === null) res = b;
      else if (b === null) res = a;
      else res = decidedWinner(idFor(B, 1, i));
    } else {
      const a = winnerId(k - 1, 2 * i);
      const b = winnerId(k - 1, 2 * i + 1);
      res = a === null || b === null ? null : decidedWinner(idFor(B, k, i));
    }
    memo.set(key, res);
    return res;
  };
  const sidesOf = (k: number, i: number): [string | null, string | null] =>
    k === 1 ? [slot[2 * i], slot[2 * i + 1]] : [winnerId(k - 1, 2 * i), winnerId(k - 1, 2 * i + 1)];

  for (let k = 1; k <= R; k++) {
    const half = B / 2 ** k;
    const slots: Array<{ i: number; a: string | null; b: string | null }> = [];
    for (let i = 0; i < half; i++) {
      const [a, b] = sidesOf(k, i);
      if (k === 1 && (a === null || b === null)) continue; // bye — auto-advances
      slots.push({ i, a, b });
    }
    // A later round is not ready until every feeding match has been decided.
    if (slots.some((s) => s.a === null || s.b === null)) return null;
    const real = slots as Array<{ i: number; a: string; b: string }>;
    if (real.length === 0) continue;

    // Already emitted? Advance only when the whole round is decided; else wait.
    const emitted = real.filter((rm) => byId.has(idFor(B, k, rm.i))).length;
    if (emitted === real.length) {
      const done = real.every((rm) => decidedWinner(idFor(B, k, rm.i)) !== null);
      if (done) continue;
      return null; // round in progress
    }

    const { base, round: roundLabel } = labelBase(B, k);
    const isSF = k === R - 1 && R >= 2 && half === 2;
    const sfBothReal = isSF && real.length === 2;

    const matches: Match[] = real.map((rm, mi) => {
      const id = idFor(B, k, rm.i);
      const winnerTo =
        k < R
          ? { matchId: idFor(B, k + 1, Math.floor(rm.i / 2)), slot: (rm.i % 2 === 0 ? "A" : "B") as "A" | "B" }
          : null;
      const loserTo =
        sfBothReal ? { matchId: "3rd", slot: (rm.i === 0 ? "A" : "B") as "A" | "B" } : null;
      return mkMatch(prc + k, mi, [rm.a], [rm.b], {
        id,
        court: (mi % courts) + 1,
        label: base,
        winnerTo,
        loserTo,
      });
    });

    // The final round also seats the 3rd-place match (both SF losers).
    if (k === R && R >= 2) {
      const s0 = sidesOf(R - 1, 0);
      const s1 = sidesOf(R - 1, 1);
      const sfReal = s0[0] !== null && s0[1] !== null && s1[0] !== null && s1[1] !== null;
      if (sfReal) {
        const l0 = decidedLoser(idFor(B, R - 1, 0));
        const l1 = decidedLoser(idFor(B, R - 1, 1));
        if (l0 && l1) {
          matches.push(
            mkMatch(prc + k, matches.length, [l0], [l1], {
              id: "3rd",
              court: (matches.length % courts) + 1,
              label: "3rd place",
            }),
          );
        }
      }
    }

    return { round: prc + k, matches, byes: [], label: roundLabel };
  }

  return null; // bracket complete
}

/** E5 dynamic advance: pools → bracket. */
export function poolsNext(config: RrConfig, completed: RrRound[]): RrRound | null {
  const prc = poolRoundCount(config);
  const poolRounds = completed.filter((r) => r.round <= prc);
  if (prc > 0) {
    if (poolRounds.length < prc) return null;
    const allScored = poolRounds.every((r) => r.matches.every(isDecided));
    if (!allScored) return null;
  }
  const participants = seedFromPools(config, poolRounds);
  const bracketRounds = completed.filter((r) => r.round > prc);
  return nextBracketRound(config, participants, bracketRounds, prc);
}

/** E5 champion: the winner of the bracket final, once decided. */
export function poolsChampion(config: RrConfig, rounds: RrRound[]): string | null {
  for (const r of rounds) {
    for (const m of r.matches) {
      if (m.id === "Final") {
        const w = winnerSide(m);
        return w ? w[0] : null;
      }
    }
  }
  return null;
}
