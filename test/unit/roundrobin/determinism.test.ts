import { describe, it, expect } from "vitest";
import { generateSchedule, nextRound } from "@/lib/roundrobin/engine";
import type { RrConfig } from "@/lib/roundrobin/types";
import { entrants, SCORING, scoreRound, sideAWins } from "./_helpers";

const base = (over: Partial<RrConfig>): RrConfig => ({
  format: "roundRobin",
  mode: "singles",
  entrants: entrants(8, true),
  courts: 2,
  scoring: SCORING,
  rngSeed: 424242,
  ...over,
});

const configs: Record<string, RrConfig> = {
  roundRobin: base({ format: "roundRobin", playEveryoneTwice: true }),
  mixer: base({ format: "mixer", mode: "doubles", fixedPartners: false, rounds: 5 }),
  movementUpDown: base({ format: "movement", movement: "upDown", courts: 4, rounds: 4 }),
  movementKing: base({ format: "movement", movement: "king", courts: 4, rounds: 4 }),
  swiss: base({ format: "swiss", rounds: 4 }),
  poolsBracket: base({ format: "poolsBracket", pools: { poolCount: 2, advancePerPool: 2, elim: "single" } }),
};

describe("reproducibility — same seed ⇒ identical output for every viewer (§14.1)", () => {
  for (const [name, cfg] of Object.entries(configs)) {
    it(`${name}: generateSchedule is deterministic`, () => {
      expect(generateSchedule(cfg)).toEqual(generateSchedule(cfg));
    });

    it(`${name}: nextRound(config, completed) is deterministic`, () => {
      const completed = generateSchedule(cfg).rounds.map((r) => scoreRound(r, sideAWins));
      expect(nextRound(cfg, completed)).toEqual(nextRound(cfg, completed));
    });
  }

  it("static formats return null from nextRound", () => {
    expect(nextRound(configs.roundRobin, generateSchedule(configs.roundRobin).rounds)).toBeNull();
    expect(nextRound(configs.mixer, generateSchedule(configs.mixer).rounds)).toBeNull();
  });

  it("a different seed generally yields a different round-robin ordering", () => {
    const a = JSON.stringify(generateSchedule(base({ rngSeed: 1 })));
    const b = JSON.stringify(generateSchedule(base({ rngSeed: 2 })));
    expect(a).not.toBe(b);
  });
});
