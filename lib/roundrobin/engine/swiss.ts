/**
 * swiss.ts — E4: Swiss pairing (§6.8).
 *
 * DYNAMIC. Round 1 pairs by seed; every later round pairs nearest records
 * (order = current standings) while avoiding rematches until unavoidable, with
 * at most one bye per player total (bye ≤ 1). `rounds` = number of Swiss rounds.
 * The next round is a pure function of `rngSeed` + confirmed scores.
 */

import type { RrConfig, RrRound } from "../types";
import { mkMatch } from "./shared";
import { computeStandings } from "./standings";

/** Undirected "have these two already played?" key. */
const mk = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Pair `order` (standings order, nearest record first) into a perfect matching that
 * MINIMIZES rematches, preferring to pair nearest records. `order.length` is even (any
 * bye already removed).
 *
 * A plain greedy (top player + first non-played opponent) commits early pairings that can
 * force a later AVOIDABLE rematch even when a fully rematch-free matching exists (M28). This
 * is small-n backtracking: at each step it tries opponents non-rematch-first then nearest,
 * and keeps the first matching of the minimum rematch count — so it emits zero rematches
 * whenever a rematch-free perfect matching exists, and the fewest otherwise. Deterministic.
 */
function pairAvoidingRematches(order: string[], played: Set<string>): Array<[string, string]> {
  const n = order.length;
  const used = new Array<boolean>(n).fill(false);
  const cur: Array<[string, string]> = [];
  const holder: { best: { pairs: Array<[string, string]>; rematches: number } | null } = { best: null };

  const dfs = (matched: number, rematches: number): void => {
    // Prune: this branch can't beat the best so far. Adding pairs only adds rematches, so a
    // partial total ≥ best is hopeless — and this also keeps the FIRST (nearest-preferring)
    // matching found at the minimum rematch count rather than a later, less-near one.
    if (holder.best && rematches >= holder.best.rematches) return;
    if (matched === n) {
      holder.best = { pairs: cur.map((p) => [p[0], p[1]] as [string, string]), rematches };
      return;
    }
    let i = 0;
    while (used[i]) i++;
    used[i] = true;
    const cands: number[] = [];
    for (let j = i + 1; j < n; j++) if (!used[j]) cands.push(j);
    // Try non-rematch opponents first, then nearest record (lower index).
    cands.sort((a, b) => {
      const ra = played.has(mk(order[i], order[a])) ? 1 : 0;
      const rb = played.has(mk(order[i], order[b])) ? 1 : 0;
      return ra - rb || a - b;
    });
    for (const j of cands) {
      used[j] = true;
      cur.push([order[i], order[j]]);
      dfs(matched + 2, rematches + (played.has(mk(order[i], order[j])) ? 1 : 0));
      cur.pop();
      used[j] = false;
    }
    used[i] = false;
  };

  dfs(0, 0);
  return holder.best ? holder.best.pairs : [];
}

/**
 * Build the next Swiss round (round `completed.length + 1`), or null once the
 * configured number of rounds is reached.
 */
export function swissRound(config: RrConfig, completed: RrRound[]): RrRound | null {
  const rounds = config.rounds ?? 0;
  const roundNum = completed.length + 1;
  if (roundNum > rounds) return null;

  // Order: current standings (nearest record first); round 1 falls through the
  // ladder to seed order — deterministic and seed-based.
  const order = computeStandings(config, completed).map((s) => s.entrantId);

  // Prior byes + prior pairings.
  const byeCount = new Map<string, number>();
  const played = new Set<string>();
  for (const r of completed) {
    for (const id of r.byes) byeCount.set(id, (byeCount.get(id) ?? 0) + 1);
    for (const m of r.matches) played.add(mk(m.sideA[0], m.sideB[0]));
  }

  const pool = order.slice();
  const byes: string[] = [];
  if (pool.length % 2 === 1) {
    // Bye to the lowest-ranked player who has not had one (standard Swiss).
    let pick = -1;
    for (let i = pool.length - 1; i >= 0; i--) {
      if ((byeCount.get(pool[i]) ?? 0) === 0) {
        pick = i;
        break;
      }
    }
    if (pick === -1) pick = pool.length - 1; // fallback (should not occur for rounds ≤ n)
    byes.push(pool.splice(pick, 1)[0]);
  }

  const matches = [];
  const court = (i: number): number => (i % Math.max(1, config.courts)) + 1;

  if (completed.length === 0) {
    // Round 1: standard Swiss FOLD — split the seed order in half and pair the top
    // half against the bottom (1v[n/2+1], 2v[n/2+2], …), so the strongest seeds meet
    // mid-field opponents rather than each other (adjacent 1v2 pairing).
    const half = pool.length / 2;
    for (let i = 0; i < half; i++) {
      matches.push(mkMatch(roundNum, i, [pool[i]], [pool[i + half]], { court: court(i) }));
    }
  } else {
    // Later rounds: pair nearest records, avoiding rematches until GENUINELY unavoidable —
    // a backtracking min-rematch matching (a plain greedy forces avoidable rematches, M28).
    let idx = 0;
    for (const [p, q] of pairAvoidingRematches(pool, played)) {
      matches.push(mkMatch(roundNum, idx, [p], [q], { court: court(idx) }));
      idx++;
    }
  }

  return { round: roundNum, matches, byes, label: `Round ${roundNum}` };
}
