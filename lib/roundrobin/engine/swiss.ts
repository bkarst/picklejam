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
    // Later rounds: pair nearest records, avoiding rematches until unavoidable.
    const remaining = pool.slice();
    let idx = 0;
    while (remaining.length > 0) {
      const p = remaining.shift() as string;
      let k = remaining.findIndex((q) => !played.has(mk(p, q)));
      if (k < 0) k = 0;
      const q = remaining.splice(k, 1)[0];
      matches.push(mkMatch(roundNum, idx, [p], [q], { court: court(idx) }));
      idx++;
    }
  }

  return { round: roundNum, matches, byes, label: `Round ${roundNum}` };
}
