import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { computeStandings, champion, generateSchedule } from "@/lib/roundrobin/engine";
import type { Entrant, Match, RrConfig, RrRound } from "@/lib/roundrobin/types";
import { entrants, SCORING, scoreRound, sideAWins } from "./_helpers";

function match(id: string, round: number, a: string, b: string, sa: number, sb: number): Match {
  return { id, round, index: 0, sideA: [a], sideB: [b], scoreA: sa, scoreB: sb, status: "scored" };
}
function round(n: number, matches: Match[], byes: string[] = []): RrRound {
  return { round: n, matches, byes };
}
function cfg(es: Entrant[], overrides: Partial<RrConfig> = {}): RrConfig {
  return {
    format: "roundRobin",
    mode: "singles",
    entrants: es,
    courts: 1,
    scoring: SCORING,
    rngSeed: 7,
    ...overrides,
  };
}
const rankOf = (st: ReturnType<typeof computeStandings>, id: string) => st.find((s) => s.entrantId === id)!.rank;

describe("tiebreak ladder (§6.8)", () => {
  it("rung 1 — wins", () => {
    const es = [{ id: "A", name: "A" }, { id: "B", name: "B" }, { id: "C", name: "C" }];
    const rounds = [round(1, [match("m1", 1, "A", "B", 11, 3)]), round(2, [match("m2", 2, "A", "C", 11, 3)])];
    const st = computeStandings(cfg(es), rounds);
    expect(rankOf(st, "A")).toBe(1); // 2 wins
  });

  it("rung 2 — point-diff breaks equal wins", () => {
    const es = [{ id: "A", name: "A" }, { id: "B", name: "B" }, { id: "C", name: "C" }, { id: "D", name: "D" }];
    // A and B each 1 win; A by a wider margin.
    const rounds = [round(1, [match("m1", 1, "A", "C", 11, 1), match("m2", 1, "B", "D", 11, 9)])];
    const st = computeStandings(cfg(es), rounds);
    expect(rankOf(st, "A")).toBeLessThan(rankOf(st, "B"));
  });

  it("rung 3 — points-for breaks equal wins + diff", () => {
    const es = [{ id: "A", name: "A" }, { id: "B", name: "B" }, { id: "C", name: "C" }, { id: "D", name: "D" }];
    // Equal diff (+8) but A scored more.
    const rounds = [round(1, [match("m1", 1, "A", "C", 15, 7), match("m2", 1, "B", "D", 11, 3)])];
    const st = computeStandings(cfg(es), rounds);
    expect(rankOf(st, "A")).toBeLessThan(rankOf(st, "B"));
  });

  it("rung 4 — head-to-head (E1) vs skip (E3)", () => {
    // A & B both 2-1, +8, PF 25; A beat B head-to-head. Seeds put B ahead.
    const es: Entrant[] = [
      { id: "A", name: "A", seed: 2 },
      { id: "B", name: "B", seed: 1 },
      { id: "C", name: "C", seed: 3 },
      { id: "D", name: "D", seed: 4 },
    ];
    const rounds = [
      round(1, [match("r1", 1, "A", "B", 11, 3), match("r1b", 1, "C", "D", 3, 11)]),
      round(2, [match("r2", 2, "A", "C", 3, 11), match("r2b", 2, "B", "D", 11, 3)]),
      round(3, [match("r3", 3, "A", "D", 11, 3), match("r3b", 3, "B", "C", 11, 3)]),
    ];
    // E1: head-to-head applies → A (beat B) ranks above B.
    const e1 = computeStandings(cfg(es), rounds);
    expect(rankOf(e1, "A")).toBeLessThan(rankOf(e1, "B"));
    // E3 movement: head-to-head skipped → falls to seed → B (seed 1) ranks above A.
    const e3 = computeStandings(cfg(es, { format: "movement", movement: "upDown" }), rounds);
    expect(rankOf(e3, "B")).toBeLessThan(rankOf(e3, "A"));
  });

  it("rung 5 — fewest byes (before seed)", () => {
    // A and B are otherwise identical (no games); only A took a bye. Seeds put
    // A ahead, so if byes were ignored A would win — but fewer byes ranks first.
    const es: Entrant[] = [
      { id: "A", name: "A", seed: 1 },
      { id: "B", name: "B", seed: 2 },
    ];
    const rounds = [round(1, [], ["A"])];
    const st = computeStandings(cfg(es), rounds);
    expect(rankOf(st, "B")).toBeLessThan(rankOf(st, "A")); // B: 0 byes, A: 1 bye
  });

  it("rung 6 — seed (lower first) when all else equal", () => {
    const es: Entrant[] = [
      { id: "A", name: "A", seed: 2 },
      { id: "B", name: "B", seed: 1 },
    ];
    const st = computeStandings(cfg(es), []); // no games played
    expect(rankOf(st, "B")).toBe(1);
  });

  it("rung 7 — stable rng breaks fully-equal entrants deterministically", () => {
    const es: Entrant[] = [
      { id: "A", name: "A", seed: 1 },
      { id: "B", name: "B", seed: 1 },
      { id: "C", name: "C", seed: 1 },
    ];
    const first = computeStandings(cfg(es), []).map((s) => s.entrantId);
    const second = computeStandings(cfg(es), []).map((s) => s.entrantId);
    expect(first).toEqual(second);
    expect([...first].sort()).toEqual(["A", "B", "C"]);
  });

  it("ranks are a contiguous 1..n permutation for any scored schedule", () => {
    fc.assert(
      fc.property(fc.integer({ min: 3, max: 12 }), (n) => {
        const c = cfg(entrants(n));
        const rounds = generateSchedule(c).rounds.map((r) => scoreRound(r, sideAWins));
        const st = computeStandings(c, rounds);
        expect(st.map((s) => s.rank)).toEqual(Array.from({ length: n }, (_, i) => i + 1));
      }),
      { numRuns: 40 },
    );
  });
});

describe("champion (§6.8)", () => {
  it("is null until the event is complete, then the standings leader", () => {
    const c = cfg(entrants(4));
    const sched = generateSchedule(c);
    const scored = sched.rounds.map((r) => scoreRound(r, sideAWins));
    // Drop the last match's scores → not complete.
    const partial = scored.map((r, i) =>
      i === scored.length - 1
        ? { ...r, matches: r.matches.map((m) => ({ ...m, scoreA: undefined, scoreB: undefined, status: "pending" as const })) }
        : r,
    );
    expect(champion(c, partial)).toBeNull();
    const winner = champion(c, scored);
    expect(winner).not.toBeNull();
    expect(winner).toBe(computeStandings(c, scored)[0].entrantId);
  });
});
