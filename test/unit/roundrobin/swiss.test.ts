import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { generateSchedule, nextRound } from "@/lib/roundrobin/engine";
import type { RrConfig } from "@/lib/roundrobin/types";
import { entrants, pairKey, SCORING, scoreRound, sideAWins, simulate } from "./_helpers";

function swissConfig(n: number, rounds: number, seed = 2024): RrConfig {
  return {
    format: "swiss",
    mode: "singles",
    entrants: entrants(n),
    courts: 4,
    rounds,
    scoring: SCORING,
    rngSeed: seed,
  };
}

describe("E4 swiss — nearest-record pairing (§6.8)", () => {
  it("bye ≤ 1 per player; no entrant appears twice in a round", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 4, max: 11 }),
        fc.integer({ min: 2, max: 4 }),
        fc.integer({ min: 1, max: 1_000_000 }),
        (n, rounds, seed) => {
          const cfg = swissConfig(n, rounds, seed);
          const played = simulate(cfg, sideAWins);
          const byeCount = new Map<string, number>();
          for (const r of played) {
            const seen = new Set<string>();
            for (const m of r.matches) for (const id of [...m.sideA, ...m.sideB]) {
              expect(seen.has(id)).toBe(false);
              seen.add(id);
            }
            for (const id of r.byes) {
              byeCount.set(id, (byeCount.get(id) ?? 0) + 1);
              expect(seen.has(id)).toBe(false);
              seen.add(id);
            }
          }
          for (const c of byeCount.values()) expect(c).toBeLessThanOrEqual(1);
          expect(played.length).toBe(rounds);
        },
      ),
      { numRuns: 60 },
    );
  });

  it("no rematch while avoidable (8 players, 3 rounds)", () => {
    const cfg = swissConfig(8, 3, 55);
    const seen = new Set<string>();
    for (const r of simulate(cfg, sideAWins)) {
      for (const m of r.matches) {
        const key = pairKey(m.sideA[0], m.sideB[0]);
        expect(seen.has(key)).toBe(false); // rematch would be unavoidable only with more rounds
        seen.add(key);
      }
    }
  });

  it("dynamic determinism: same (config, completed) ⇒ identical next round", () => {
    const cfg = swissConfig(9, 4, 321);
    const r1 = generateSchedule(cfg).rounds.map((r) => scoreRound(r, sideAWins));
    expect(nextRound(cfg, r1)).toEqual(nextRound(cfg, r1));
  });

  it("generateSchedule returns round 1 and is marked dynamic", () => {
    const cfg = swissConfig(6, 3);
    const sched = generateSchedule(cfg);
    expect(sched.dynamic).toBe(true);
    expect(sched.rounds).toHaveLength(1);
    expect(sched.rounds[0].matches).toHaveLength(3);
  });
});
