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

  it("M27: byes are shared fairly — the report's 6-player seed-42 case (was e4:4 / e1:0)", () => {
    const cfg = mixerConfig(6, { popcorn: true, rngSeed: 42 });
    const { rounds } = generateSchedule(cfg);
    const byes = new Map<string, number>(entrants(6).map((e) => [e.id, 0]));
    for (const r of rounds) for (const id of r.byes) byes.set(id, (byes.get(id) ?? 0) + 1);
    const counts = [...byes.values()];
    // Fair for 6 players over 5 rounds (2 bench-slots/round = 10) is 2,2,2,2,1,1 (spread 1).
    // Pre-fix the greedy leftover benched e4 four times and e1 never (spread 4).
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it("M27: no player is benched grossly above their fair share (across sizes/seeds)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 4, max: 16 }), fc.integer({ min: 1, max: 1_000_000 }), (n, seed) => {
        const cfg = mixerConfig(n, { rngSeed: seed, rounds: mixerFeasibleMax(n) });
        const { rounds } = generateSchedule(cfg);
        const byes = new Map<string, number>(entrants(n).map((e) => [e.id, 0]));
        let total = 0;
        for (const r of rounds) {
          for (const id of r.byes) {
            byes.set(id, (byes.get(id) ?? 0) + 1);
            total += 1;
          }
        }
        const fairShare = Math.ceil(total / n);
        // Nobody is benched more than 2 above their fair share. Pre-fix the greedy leftover
        // could bench a player 4+ above fair (one player 7 byes when fair was 3). The +2 slack
        // is the structural limit of a per-round greedy over a fixed partnership factorization.
        expect(Math.max(...byes.values())).toBeLessThanOrEqual(fairShare + 2);
      }),
      { numRuns: 80 },
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
