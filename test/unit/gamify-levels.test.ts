/**
 * gamify-levels.test.ts — PROPERTY tests for the level ladder (§G5).
 * The threshold table is the oracle; levels must be monotonic, never regress under
 * the watermark, and fire exactly one `level_up` (higher wins) on a multi-cross.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  LEVELS,
  MAX_LEVEL,
  levelForWatermark,
  levelInfo,
  levelName,
  levelUpCrossed,
  thresholdFor,
} from "@/lib/gamify/levels";

describe("LEVELS table (exact G5 constants)", () => {
  it("has 10 levels with the exact thresholds and names", () => {
    expect(LEVELS.map((l) => l.threshold)).toEqual([
      0, 100, 300, 700, 1_400, 2_500, 4_200, 6_800, 10_500, 16_000,
    ]);
    expect(LEVELS.map((l) => l.name)).toEqual([
      "Paddle Rookie", "Dinker", "Rally Regular", "Kitchen Veteran", "Spin Doctor",
      "Drop-Shot Artist", "Smash Specialist", "Bracket Boss", "Titan", "Legend",
    ]);
    expect(MAX_LEVEL).toBe(10);
  });

  it("thresholds are strictly increasing (small early gaps, large late gaps)", () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].threshold).toBeGreaterThan(LEVELS[i - 1].threshold);
    }
  });
});

describe("levelForWatermark — Level N iff watermark ∈ [thr(N), thr(N+1))", () => {
  it("matches the table at and around every threshold", () => {
    for (const { level, threshold } of LEVELS) {
      expect(levelForWatermark(threshold)).toBe(level);
      if (level < MAX_LEVEL) expect(levelForWatermark(thresholdFor(level + 1) - 1)).toBe(level);
    }
  });

  it("is monotonic non-decreasing in the watermark", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 30_000 }), fc.integer({ min: 0, max: 30_000 }), (a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        expect(levelForWatermark(hi)).toBeGreaterThanOrEqual(levelForWatermark(lo));
      }),
    );
  });

  it("clamps below 0 to Level 1 and huge values to Level 10", () => {
    expect(levelForWatermark(-500)).toBe(1);
    expect(levelForWatermark(0)).toBe(1);
    expect(levelForWatermark(1_000_000)).toBe(10);
  });
});

describe("levelInfo — ring / endowed progress", () => {
  it("25 RP ⇒ Level 1, 25% toward Level 2 (endowed-progress start, G2.2)", () => {
    const info = levelInfo(25);
    expect(info.level).toBe(1);
    expect(info.progress).toBeCloseTo(0.25, 6);
    expect(info.rpToNext).toBe(75);
    expect(info.nextThreshold).toBe(100);
  });

  it("at max level progress is 1 and rpToNext is null", () => {
    const info = levelInfo(20_000);
    expect(info.level).toBe(10);
    expect(info.isMax).toBe(true);
    expect(info.progress).toBe(1);
    expect(info.rpToNext).toBeNull();
    expect(info.nextThreshold).toBeNull();
  });

  it("progress always lands in [0,1]", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 30_000 }), (w) => {
        const p = levelInfo(w).progress;
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
      }),
    );
  });
});

describe("levelUpCrossed — highest wins, one event", () => {
  it("returns null when the level is unchanged", () => {
    expect(levelUpCrossed(0, 50)).toBeNull();
    expect(levelUpCrossed(100, 150)).toBeNull();
  });

  it("returns the final (highest) level when one award crosses multiple thresholds", () => {
    // 50 → 800 crosses Level 2 (100), 3 (300), 4 (700): the higher (4) wins.
    expect(levelUpCrossed(50, 800)).toBe(4);
  });

  it("never reports a level-up when the watermark decreases", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 20_000 }), fc.integer({ min: 0, max: 20_000 }), (a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        expect(levelUpCrossed(hi, lo)).toBeNull(); // watermark only ever grows in practice
      }),
    );
  });

  it("levelName is stable and clamps out-of-range", () => {
    expect(levelName(5)).toBe("Spin Doctor");
    expect(levelName(0)).toBe("Paddle Rookie");
    expect(levelName(99)).toBe("Legend");
  });
});
