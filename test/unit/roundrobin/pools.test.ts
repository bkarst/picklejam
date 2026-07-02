import { describe, it, expect } from "vitest";
import { generateSchedule, nextRound, champion, isComplete } from "@/lib/roundrobin/engine";
import { poolAssignment } from "@/lib/roundrobin/engine/pools";
import type { Match, RrConfig, RrRound } from "@/lib/roundrobin/types";
import { entrants, pairKey, SCORING, scoreRound, sideAWins, simulate } from "./_helpers";

function e5Config(n: number, poolCount: number, advancePerPool: number, seed = 88): RrConfig {
  return {
    format: "poolsBracket",
    mode: "singles",
    entrants: entrants(n, true), // explicit seeds 1..n for deterministic snake
    courts: 4,
    scoring: SCORING,
    rngSeed: seed,
    pools: { poolCount, advancePerPool, elim: "single" },
  };
}

const allMatches = (rounds: RrRound[]): Match[] => rounds.flatMap((r) => r.matches);
const isPoolMatch = (m: Match): boolean => /^[A-Z]-/.test(m.id);

describe("E5 pools → bracket (§6.8)", () => {
  it("snake seeds entrants into balanced pools", () => {
    const { pools } = poolAssignment(e5Config(8, 2, 2));
    // seeds 1→P0, 2→P1, 3→P1, 4→P0, 5→P0, 6→P1, 7→P1, 8→P0
    expect(pools[0].map((e) => e.seed)).toEqual([1, 4, 5, 8]);
    expect(pools[1].map((e) => e.seed)).toEqual([2, 3, 6, 7]);
  });

  it("pool round robin is complete: every in-pool pair meets exactly once", () => {
    const cfg = e5Config(8, 2, 2);
    const { pools } = poolAssignment(cfg);
    const rounds = simulate(cfg, sideAWins);
    const poolMatches = allMatches(rounds).filter(isPoolMatch);

    pools.forEach((members, p) => {
      const letter = String.fromCharCode(65 + p);
      const pairs = new Map<string, number>();
      for (const m of poolMatches) {
        if (!m.id.startsWith(`${letter}-`)) continue;
        pairs.set(pairKey(m.sideA[0], m.sideB[0]), (pairs.get(pairKey(m.sideA[0], m.sideB[0])) ?? 0) + 1);
      }
      expect(pairs.size).toBe((members.length * (members.length - 1)) / 2);
      for (const c of pairs.values()) expect(c).toBe(1);
    });
  });

  it("bracket advances winners correctly via winnerTo linkage; champion emerges", () => {
    const cfg = e5Config(8, 2, 2);
    const rounds = simulate(cfg, sideAWins);
    const byId = new Map(allMatches(rounds).map((m) => [m.id, m]));

    for (const m of allMatches(rounds)) {
      if (!m.winnerTo) continue;
      // With sideAWins the winner is sideA[0].
      const winner = m.sideA[0];
      const target = byId.get(m.winnerTo.matchId);
      expect(target).toBeDefined();
      const slotSide = m.winnerTo.slot === "A" ? target!.sideA : target!.sideB;
      expect(slotSide).toContain(winner);
    }

    expect(isComplete(cfg, rounds)).toBe(true);
    expect(champion(cfg, rounds)).not.toBeNull();
  });

  it("labels the knockout stage (Semifinals / Final / 3rd place)", () => {
    const cfg = e5Config(8, 2, 2);
    const labels = new Set(allMatches(simulate(cfg, sideAWins)).map((m) => m.label));
    expect(labels.has("SF")).toBe(true);
    expect(labels.has("Final")).toBe(true);
    expect(labels.has("3rd place")).toBe(true);
  });

  it("pads a non-power-of-two qualifier count with byes and still crowns a champion", () => {
    // 3 pools × advance 1 = 3 qualifiers → bracket padded to 4 with one bye.
    const cfg = e5Config(9, 3, 1);
    const rounds = simulate(cfg, sideAWins);
    expect(champion(cfg, rounds)).not.toBeNull();
    // The Final exists and is decided.
    expect(allMatches(rounds).some((m) => m.id === "Final")).toBe(true);
  });

  it("generateSchedule returns only the (static) pool rounds, dynamic=true", () => {
    const cfg = e5Config(8, 2, 2);
    const sched = generateSchedule(cfg);
    expect(sched.dynamic).toBe(true);
    expect(sched.rounds.every((r) => r.matches.every(isPoolMatch))).toBe(true);
  });

  it("determinism: schedule + first bracket round reproduce deep-equal", () => {
    const cfg = e5Config(8, 2, 2);
    expect(generateSchedule(cfg)).toEqual(generateSchedule(cfg));
    const poolScored = generateSchedule(cfg).rounds.map((r) => scoreRound(r, sideAWins));
    expect(nextRound(cfg, poolScored)).toEqual(nextRound(cfg, poolScored));
    expect(nextRound(cfg, poolScored)).not.toBeNull();
  });
});
