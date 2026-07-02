/**
 * schedule.ts — PURE weekly league scheduling + standings (PRD §7.2–7.3).
 *
 * Leagues are recurring weekly play: every season week is ONE round of a
 * round-robin over the paid roster. We REUSE the round-robin engine's circle
 * method ({@link circleRounds}, a 1-factorization of K_m) so each week is a
 * perfect matching in which — across the first `m-1` weeks — every unordered pair
 * meets exactly once. When the season runs longer than `m-1` weeks the pairings
 * cycle (week `w` uses RR round `w mod (m-1)`), so the same fair rotation repeats.
 *
 * Odd rosters pad with a rotating BYE sentinel (the sentinel index `n`), so one
 * entrant sits out each week and bye counts differ by at most one.
 *
 * Everything here is a deterministic function of its inputs — no `Date.now`, no
 * randomness, no DB — which is exactly what makes it unit-testable and what lets
 * the data layer replay it to (re)materialize a schedule (§14.1).
 */

import { circleRounds, padEven } from "@/lib/roundrobin/engine/shared";

// ── weekly schedule ───────────────────────────────────────────────────────────

/** A single fixture within a week: two sides of entrant ids (uid or teamId). */
export interface ScheduleFixture {
  /** Stable id, unique within its (week, division). */
  mid: string;
  sideA: string[];
  sideB: string[];
}

/** A week of fixtures + the entrants sitting out (byes). */
export interface ScheduleWeek {
  week: number; // 1-based
  fixtures: ScheduleFixture[];
  byes: string[];
}

/**
 * Build a `seasonWeeks`-long weekly schedule for `entrantIds` (PURE). Each week is
 * one round-robin round from the circle method; weeks beyond `m-1` cycle the
 * pairings. Fewer than 2 entrants (or `seasonWeeks < 1`) ⇒ an empty schedule.
 *
 * `midPrefix` (e.g. the division id) namespaces the fixture ids so matches from
 * different divisions never collide inside a shared weekly partition.
 */
export function buildWeeklySchedule(
  entrantIds: readonly string[],
  seasonWeeks: number,
  opts: { midPrefix?: string } = {},
): ScheduleWeek[] {
  const n = entrantIds.length;
  const weeks: ScheduleWeek[] = [];
  if (n < 2 || seasonWeeks < 1) return weeks;

  const m = padEven(n); // even count for the circle method (sentinel = "bye")
  const token = (idx: number): string | null => (idx < n ? entrantIds[idx] : null);
  const pass = circleRounds(m); // m-1 perfect matchings
  const prefix = opts.midPrefix ? `${opts.midPrefix}-` : "";

  for (let w = 0; w < seasonWeeks; w++) {
    const pairs = pass[w % pass.length];
    const fixtures: ScheduleFixture[] = [];
    const byes: string[] = [];
    let idx = 0;
    for (const [i, j] of pairs) {
      const a = token(i);
      const b = token(j);
      if (a === null && b === null) continue; // sentinel v sentinel (never real)
      if (a === null) {
        byes.push(b as string);
        continue;
      }
      if (b === null) {
        byes.push(a);
        continue;
      }
      fixtures.push({ mid: `${prefix}${pad(idx)}`, sideA: [a], sideB: [b] });
      idx++;
    }
    weeks.push({ week: w + 1, fixtures, byes });
  }
  return weeks;
}

/** Zero-pad so a fixture id sorts lexicographically by index. */
function pad(n: number, width = 4): string {
  return String(Math.trunc(n)).padStart(width, "0");
}

// ── standings ─────────────────────────────────────────────────────────────────

/** A ranked standings row (mirrors the persisted `LeagueStandingItem` payload). */
export interface StandingRow {
  entrantId: string;
  rank: number; // 1-based
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  played: number;
}

/** A match the standings compute reads (only DECIDED matches are tallied). */
export interface StandingMatch {
  sideA: string[];
  sideB: string[];
  scoreA?: number;
  scoreB?: number;
}

const isDecided = (m: StandingMatch): boolean =>
  typeof m.scoreA === "number" &&
  typeof m.scoreB === "number" &&
  m.sideA.length > 0 &&
  m.sideB.length > 0;

/**
 * Compute ranked standings (PURE) for `entrantIds` over `matches` (§7.3). Only
 * decided matches count. Tiebreak ladder: wins → point-diff → points-for →
 * head-to-head (among the still-tied) → entrant id (ascending, always total).
 * Every entrant appears, including those who have not played yet.
 */
export function computeLeagueStandings(
  entrantIds: readonly string[],
  matches: readonly StandingMatch[],
): StandingRow[] {
  const stats = new Map<string, StandingRow>();
  for (const id of entrantIds) {
    stats.set(id, {
      entrantId: id,
      rank: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDiff: 0,
      played: 0,
    });
  }

  const decided = matches.filter(isDecided);
  for (const m of decided) {
    const a = m.scoreA as number;
    const b = m.scoreB as number;
    const res = a > b ? "A" : b > a ? "B" : "tie";
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
  for (const s of stats.values()) s.pointDiff = s.pointsFor - s.pointsAgainst;

  // Head-to-head wins *within* a currently-tied group (group-relative, so it must
  // run mid-ladder rather than as a scalar sort key).
  const headToHead = (group: string[]): Map<string, number> => {
    const set = new Set(group);
    const wins = new Map<string, number>(group.map((id) => [id, 0]));
    const inGroup = (side: string[]) => side.every((id) => set.has(id));
    for (const m of decided) {
      if (!inGroup(m.sideA) || !inGroup(m.sideB)) continue;
      const a = m.scoreA as number;
      const b = m.scoreB as number;
      const winners = a > b ? m.sideA : b > a ? m.sideB : [];
      for (const id of winners) wins.set(id, (wins.get(id) ?? 0) + 1);
    }
    return wins;
  };

  // Refine ordered groups by a HIGHER-is-better score, splitting equal runs. JS
  // sort is stable, so entrants equal on every rung keep the starting order.
  const refine = (
    groups: string[][],
    scoreFn: (id: string, group: string[]) => number,
  ): string[][] => {
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
  };

  const rungs: Array<(id: string, group: string[]) => number> = [
    (id) => stats.get(id)!.wins,
    (id) => stats.get(id)!.pointDiff,
    (id) => stats.get(id)!.pointsFor,
    (id, group) => headToHead(group).get(id) ?? 0,
  ];

  // Seed the ladder from entrant id ASCENDING so any residual tie is broken
  // deterministically (the stable sort preserves this order through every rung).
  let groups: string[][] = [[...entrantIds].sort()];
  for (const rung of rungs) groups = refine(groups, rung);

  return groups.flat().map((id, i) => ({ ...stats.get(id)!, rank: i + 1 }));
}
