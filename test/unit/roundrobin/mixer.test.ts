import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { generateSchedule } from "@/lib/roundrobin/engine";
import { mixerFeasibleMax } from "@/lib/roundrobin/engine/mixer";
import type { RrConfig } from "@/lib/roundrobin/types";
import { entrants, pairKey, SCORING } from "./_helpers";

function mixerConfig(n: number, opts: Partial<RrConfig> = {}): RrConfig {
  return {
    format: "mixer",
    mode: "doubles",
    fixedPartners: false,
    entrants: entrants(n),
    courts: 3,
    scoring: SCORING,
    rngSeed: 777,
    ...opts,
  };
}

/** Count how many times each partner-pair recurs across the schedule. */
function partnerRepeats(rounds: ReturnType<typeof generateSchedule>["rounds"]): number {
  const count = new Map<string, number>();
  for (const r of rounds) {
    for (const m of r.matches) {
      for (const side of [m.sideA, m.sideB]) {
        expect(side.length).toBe(2); // doubles partnership
        count.set(pairKey(side[0], side[1]), (count.get(pairKey(side[0], side[1])) ?? 0) + 1);
      }
    }
  }
  let repeats = 0;
  for (const c of count.values()) if (c > 1) repeats += c - 1;
  return repeats;
}

describe("E2 mixer — rotating partners (§6.8)", () => {
  it("no player is on two sides in a round; every player accounted for exactly once", () => {
    fc.assert(
      fc.property(fc.integer({ min: 4, max: 16 }), fc.integer({ min: 1, max: 1_000_000 }), (n, seed) => {
        const cfg = mixerConfig(n, { rngSeed: seed });
        const { rounds } = generateSchedule(cfg);
        for (const r of rounds) {
          const seen = new Set<string>();
          for (const m of r.matches) {
            for (const id of [...m.sideA, ...m.sideB]) {
              expect(seen.has(id)).toBe(false);
              seen.add(id);
            }
          }
          for (const id of r.byes) {
            expect(seen.has(id)).toBe(false);
            seen.add(id);
          }
          // Every player appears once (playing or bye).
          expect(seen.size).toBe(n);
        }
      }),
      { numRuns: 60 },
    );
  });

  it("zero repeat partners within the feasible window (default full mixer)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 4, max: 16 }), (n) => {
        const cfg = mixerConfig(n, { rounds: mixerFeasibleMax(n) });
        expect(partnerRepeats(generateSchedule(cfg).rounds)).toBe(0);
      }),
      { numRuns: 40 },
    );
  });

  it("popcorn ⇒ zero repeat partners AND rounds clamped to the feasible max", () => {
    fc.assert(
      fc.property(fc.integer({ min: 4, max: 16 }), (n) => {
        // Request far more rounds than feasible; engine must clamp.
        const cfg = mixerConfig(n, { popcorn: true, rounds: 999 });
        const { rounds } = generateSchedule(cfg);
        expect(rounds.length).toBeLessThanOrEqual(mixerFeasibleMax(n));
        expect(rounds.length).toBe(mixerFeasibleMax(n));
        expect(partnerRepeats(rounds)).toBe(0);
      }),
      { numRuns: 40 },
    );
  });
});
