import { describe, it, expect } from "vitest";
import {
  buildWeeklySchedule,
  computeLeagueStandings,
  type ScheduleWeek,
  type StandingMatch,
} from "@/lib/leagues/schedule";

/**
 * Pure weekly schedule + standings (§7.2–7.3). Deterministic: no DB, no clock, no
 * RNG — so every assertion is exact.
 */

/** Sorted "a|b" key for an unordered fixture pair (for coverage assertions). */
const pairKey = (a: string, b: string) => [a, b].sort().join("|");
const allPairKeys = (weeks: ScheduleWeek[]) =>
  weeks.flatMap((w) => w.fixtures.map((f) => pairKey(f.sideA[0], f.sideB[0])));

describe("buildWeeklySchedule (§7.2)", () => {
  it("even roster: each of N-1 weeks is a perfect matching, every pair meets exactly once", () => {
    const weeks = buildWeeklySchedule(["A", "B", "C", "D"], 3);
    expect(weeks).toHaveLength(3);
    for (const w of weeks) {
      expect(w.fixtures).toHaveLength(2); // 4 players → 2 courts per week
      expect(w.byes).toEqual([]);
      // Everyone plays exactly once this week (no double-booking).
      const seen = w.fixtures.flatMap((f) => [...f.sideA, ...f.sideB]);
      expect(new Set(seen).size).toBe(4);
    }
    // Across the season every unordered pair appears exactly once (round robin).
    const pairs = allPairKeys(weeks);
    expect(new Set(pairs).size).toBe(6); // C(4,2)
    expect(pairs).toHaveLength(6);
  });

  it("odd roster: one rotating bye per week; every pair meets once and each byes once", () => {
    const weeks = buildWeeklySchedule(["A", "B", "C"], 3);
    expect(weeks).toHaveLength(3);
    for (const w of weeks) {
      expect(w.fixtures).toHaveLength(1);
      expect(w.byes).toHaveLength(1);
    }
    const byes = weeks.flatMap((w) => w.byes).sort();
    expect(byes).toEqual(["A", "B", "C"]); // each sits out exactly once
    const pairs = allPairKeys(weeks);
    expect(new Set(pairs)).toEqual(new Set(["A|B", "A|C", "B|C"]));
  });

  it("seasons longer than the round-robin cycle repeat the rotation", () => {
    const weeks = buildWeeklySchedule(["A", "B", "C", "D"], 5);
    expect(weeks.map((w) => w.week)).toEqual([1, 2, 3, 4, 5]);
    // Week 4 repeats week 1's pairings; week 5 repeats week 2's (cycle length 3).
    expect(allPairKeys([weeks[3]])).toEqual(allPairKeys([weeks[0]]));
    expect(allPairKeys([weeks[4]])).toEqual(allPairKeys([weeks[1]]));
  });

  it("fixture ids are unique within a week and namespaced by the midPrefix", () => {
    const weeks = buildWeeklySchedule(["A", "B", "C", "D"], 1, { midPrefix: "div9" });
    const mids = weeks[0].fixtures.map((f) => f.mid);
    expect(mids.every((m) => m.startsWith("div9-"))).toBe(true);
    expect(new Set(mids).size).toBe(mids.length);
  });

  it("degenerate rosters/lengths yield an empty schedule", () => {
    expect(buildWeeklySchedule(["A"], 4)).toEqual([]);
    expect(buildWeeklySchedule([], 4)).toEqual([]);
    expect(buildWeeklySchedule(["A", "B"], 0)).toEqual([]);
  });
});

describe("computeLeagueStandings (§7.3)", () => {
  const m = (a: string, b: string, sa?: number, sb?: number): StandingMatch => ({
    sideA: [a],
    sideB: [b],
    scoreA: sa,
    scoreB: sb,
  });
  const rankOf = (rows: ReturnType<typeof computeLeagueStandings>, id: string) =>
    rows.find((r) => r.entrantId === id)!.rank;

  it("ranks by wins, and lists every entrant (including winless / unplayed)", () => {
    const rows = computeLeagueStandings(
      ["A", "B", "C"],
      [m("A", "B", 11, 3), m("A", "C", 11, 5)],
    );
    expect(rows).toHaveLength(3);
    expect(rankOf(rows, "A")).toBe(1); // 2-0
    const a = rows.find((r) => r.entrantId === "A")!;
    expect(a).toMatchObject({ wins: 2, losses: 0, played: 2, pointsFor: 22, pointsAgainst: 8 });
    expect(rows.find((r) => r.entrantId === "C")!.played).toBe(1);
  });

  it("tiebreak ladder: point-diff, then points-for, then head-to-head", () => {
    // Diff: A and B each 1-0; A won by more.
    const byDiff = computeLeagueStandings(
      ["A", "B", "C", "D"],
      [m("A", "C", 11, 1), m("B", "D", 11, 9)],
    );
    expect(rankOf(byDiff, "A")).toBeLessThan(rankOf(byDiff, "B"));

    // Points-for: equal diff (+8) but A scored more.
    const byPF = computeLeagueStandings(
      ["A", "B", "C", "D"],
      [m("A", "C", 15, 7), m("B", "D", 11, 3)],
    );
    expect(rankOf(byPF, "A")).toBeLessThan(rankOf(byPF, "B"));

    // Head-to-head: A & B identical on every scalar rung; A beat B directly.
    const byH2H = computeLeagueStandings(
      ["A", "B", "C", "D"],
      [
        m("A", "B", 11, 3),
        m("C", "D", 3, 11),
        m("A", "C", 3, 11),
        m("B", "D", 11, 3),
      ],
    );
    expect(rankOf(byH2H, "A")).toBeLessThan(rankOf(byH2H, "B"));
  });

  it("only DECIDED matches count; ranks are 1..n and deterministic on a total tie", () => {
    const rows = computeLeagueStandings(
      ["B", "A"],
      [m("A", "B") /* unscored → ignored */],
    );
    expect(rows.every((r) => r.played === 0)).toBe(true);
    // Fully tied → broken by entrant id ascending (deterministic total order).
    expect(rows.map((r) => r.entrantId)).toEqual(["A", "B"]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2]);
  });
});
