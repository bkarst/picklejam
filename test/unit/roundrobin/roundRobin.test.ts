import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { generateSchedule } from "@/lib/roundrobin/engine";
import type { RrConfig } from "@/lib/roundrobin/types";
import { entrants, matchIds, pairKey, SCORING } from "./_helpers";

function rrConfig(n: number, opts: Partial<RrConfig> = {}): RrConfig {
  return {
    format: "roundRobin",
    mode: "singles",
    entrants: entrants(n),
    courts: 2,
    scoring: SCORING,
    rngSeed: 12345,
    ...opts,
  };
}

describe("E1 round robin — circle method (§6.8)", () => {
  it("every unordered pair meets exactly once; everyone plays n-1; one bye/round when odd", () => {
    fc.assert(
      fc.property(fc.integer({ min: 3, max: 16 }), fc.integer({ min: 1, max: 1_000_000 }), (n, seed) => {
        const cfg = rrConfig(n, { rngSeed: seed });
        const { rounds, dynamic } = generateSchedule(cfg);
        expect(dynamic).toBe(false);

        // Pair coverage: exactly once each.
        const pairCount = new Map<string, number>();
        const plays = new Map<string, number>();
        for (const r of rounds) {
          const seen = new Set<string>();
          for (const m of r.matches) {
            const [a] = m.sideA;
            const [b] = m.sideB;
            const key = pairKey(a, b);
            pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
            for (const id of matchIds(m)) {
              plays.set(id, (plays.get(id) ?? 0) + 1);
              // No entrant appears twice in one round.
              expect(seen.has(id)).toBe(false);
              seen.add(id);
            }
          }
          for (const id of r.byes) {
            expect(seen.has(id)).toBe(false);
            seen.add(id);
          }
        }

        // C(n,2) distinct pairs, each exactly once.
        expect(pairCount.size).toBe((n * (n - 1)) / 2);
        for (const c of pairCount.values()) expect(c).toBe(1);

        // Everyone plays n-1 games.
        for (const e of cfg.entrants) expect(plays.get(e.id)).toBe(n - 1);

        // Bye fairness ≤ 1; odd n ⇒ exactly one bye per round.
        const byeCount = new Map<string, number>();
        for (const r of rounds) {
          if (n % 2 === 1) expect(r.byes.length).toBe(1);
          else expect(r.byes.length).toBe(0);
          for (const id of r.byes) byeCount.set(id, (byeCount.get(id) ?? 0) + 1);
        }
        const byes = cfg.entrants.map((e) => byeCount.get(e.id) ?? 0);
        expect(Math.max(...byes) - Math.min(...byes)).toBeLessThanOrEqual(1);
      }),
      { numRuns: 60 },
    );
  });

  it("playEveryoneTwice ⇒ every pair meets exactly twice; everyone plays 2(n-1)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 3, max: 12 }), (n) => {
        const cfg = rrConfig(n, { playEveryoneTwice: true });
        const { rounds } = generateSchedule(cfg);
        const pairCount = new Map<string, number>();
        const plays = new Map<string, number>();
        for (const r of rounds) {
          for (const m of r.matches) {
            pairCount.set(pairKey(m.sideA[0], m.sideB[0]), (pairCount.get(pairKey(m.sideA[0], m.sideB[0])) ?? 0) + 1);
            for (const id of matchIds(m)) plays.set(id, (plays.get(id) ?? 0) + 1);
          }
        }
        expect(pairCount.size).toBe((n * (n - 1)) / 2);
        for (const c of pairCount.values()) expect(c).toBe(2);
        for (const e of cfg.entrants) expect(plays.get(e.id)).toBe(2 * (n - 1));
      }),
      { numRuns: 40 },
    );
  });

  it("assigns matches to courts within 1..courts", () => {
    const cfg = rrConfig(8, { courts: 3 });
    for (const r of generateSchedule(cfg).rounds) {
      for (const m of r.matches) {
        expect(m.court).toBeGreaterThanOrEqual(1);
        expect(m.court).toBeLessThanOrEqual(3);
      }
    }
  });
});
