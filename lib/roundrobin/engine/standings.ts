/**
 * standings.ts — canonical tiebreak ladder (§6.8).
 *
 *   wins → point-diff → points-for → head-to-head (E1/E4/E5 only)
 *        → fewest byes → seed (lower first) → stable rng by rngSeed
 *
 * The ranking is a stack of refinements: partition entrants into groups equal on
 * the current key, sort/sub-partition each group by the next key, and so on. The
 * head-to-head rung is *group-relative* (a mini-league among the still-tied
 * entrants), which is why it must run mid-ladder rather than as a scalar sort
 * key. The final rng rung guarantees a total, deterministic order (rank 1..n).
 */

import type { RrConfig, RrRound, Standing } from "../types";
import { isDecided, outcome, rngKeyFor, seedMap } from "./shared";

/** Formats whose tiebreak ladder includes the head-to-head rung. */
function usesHeadToHead(config: RrConfig): boolean {
  return (
    config.format === "roundRobin" ||
    config.format === "swiss" ||
    config.format === "poolsBracket"
  );
}

/** Accumulate raw per-entrant totals across every scored match + bye. */
function tally(config: RrConfig, rounds: RrRound[]): Map<string, Standing> {
  const stats = new Map<string, Standing>();
  for (const e of config.entrants) {
    stats.set(e.id, {
      entrantId: e.id,
      rank: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDiff: 0,
      byes: 0,
      played: 0,
    });
  }

  for (const round of rounds) {
    for (const id of round.byes) {
      const s = stats.get(id);
      if (s) s.byes++;
    }
    for (const m of round.matches) {
      if (!isDecided(m)) continue;
      const a = m.scoreA as number;
      const b = m.scoreB as number;
      const res = outcome(m); // "A" | "B" | "tie"
      // Credit EVERY id on a side (uniform across singles / fixed teams / mixer pairs).
      for (const id of m.sideA) {
        const s = stats.get(id);
        if (!s) continue;
        s.played++;
        s.pointsFor += a;
        s.pointsAgainst += b;
        if (res === "A") s.wins++;
        else if (res === "B") s.losses++;
        else s.ties++;
      }
      for (const id of m.sideB) {
        const s = stats.get(id);
        if (!s) continue;
        s.played++;
        s.pointsFor += b;
        s.pointsAgainst += a;
        if (res === "B") s.wins++;
        else if (res === "A") s.losses++;
        else s.ties++;
      }
    }
  }

  for (const s of stats.values()) s.pointDiff = s.pointsFor - s.pointsAgainst;
  return stats;
}

/**
 * Intra-group head-to-head wins: among the currently-tied `group`, how many
 * decided matches each member won against *another* member of the same group.
 */
function headToHeadWins(group: string[], rounds: RrRound[]): Map<string, number> {
  const set = new Set(group);
  const wins = new Map<string, number>();
  for (const id of group) wins.set(id, 0);
  const inGroup = (side: string[]) => side.every((id) => set.has(id));
  for (const round of rounds) {
    for (const m of round.matches) {
      if (!isDecided(m)) continue;
      if (!inGroup(m.sideA) || !inGroup(m.sideB)) continue;
      const w = outcome(m);
      const winners = w === "A" ? m.sideA : w === "B" ? m.sideB : [];
      for (const id of winners) wins.set(id, (wins.get(id) ?? 0) + 1);
    }
  }
  return wins;
}

/**
 * Refine an ordered list of groups by a score function (HIGHER = better rank):
 * within each group sort descending, then split into runs of equal score.
 */
function refine(
  groups: string[][],
  scoreFn: (id: string, group: string[]) => number,
): string[][] {
  const next: string[][] = [];
  for (const g of groups) {
    if (g.length <= 1) {
      next.push(g);
      continue;
    }
    const scored = g.map((id) => ({ id, v: scoreFn(id, g) }));
    scored.sort((x, y) => y.v - x.v);
    let run: string[] = [scored[0].id];
    for (let k = 1; k < scored.length; k++) {
      if (scored[k].v === scored[k - 1].v) run.push(scored[k].id);
      else {
        next.push(run);
        run = [scored[k].id];
      }
    }
    next.push(run);
  }
  return next;
}

/**
 * Rank every entrant by the canonical tiebreak ladder and return standings in
 * rank order (rank 1..n), including entrants who have not yet played.
 */
export function computeStandings(config: RrConfig, rounds: RrRound[]): Standing[] {
  const stats = tally(config, rounds);
  const seeds = seedMap(config);

  // Each rung is a HIGHER-is-better score function; ordered top→bottom of ladder.
  const rungs: Array<(id: string, group: string[]) => number> = [
    (id) => stats.get(id)!.wins,
    (id) => stats.get(id)!.pointDiff,
    (id) => stats.get(id)!.pointsFor,
  ];
  if (usesHeadToHead(config)) {
    rungs.push((id, group) => headToHeadWins(group, rounds).get(id) ?? 0);
  }
  rungs.push((id) => -stats.get(id)!.byes); // fewest byes
  rungs.push((id) => -(seeds.get(id) ?? Number.MAX_SAFE_INTEGER)); // lower seed first
  rungs.push((id) => rngKeyFor(config.rngSeed, id)); // stable, always-total

  let groups: string[][] = [config.entrants.map((e) => e.id)];
  for (const rung of rungs) groups = refine(groups, rung);

  const ordered = groups.flat();
  return ordered.map((id, i) => {
    const s = stats.get(id)!;
    return { ...s, rank: i + 1 };
  });
}
