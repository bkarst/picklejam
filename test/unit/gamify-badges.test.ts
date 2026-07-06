/**
 * gamify-badges.test.ts — catalog integrity + the monotonic tier function (§G6).
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  BADGE_FAMILIES,
  BADGE_FAMILY_BY_ID,
  SPECIAL_BADGES,
  COUNTER_KEYS,
  TIER_NAMES,
  tierForCount,
  tierForFamily,
  evaluateBadgeUpgrades,
  emptySnapshot,
  type BadgeSnapshot,
} from "@/lib/gamify/badges";

describe("catalog", () => {
  it("has the 14 evergreen families with the documented tiers", () => {
    expect(BADGE_FAMILIES).toHaveLength(14);
    expect(BADGE_FAMILY_BY_ID.explorer.tiers).toEqual([3, 10, 25, 60]);
    expect(BADGE_FAMILY_BY_ID.helpful.tiers).toEqual([10, 50, 150, 400]);
    expect(BADGE_FAMILY_BY_ID.streaker.tiers).toEqual([4, 12, 26, 52]);
    expect(BADGE_FAMILY_BY_ID.streaker.counter).toBe("streakBest");
  });

  it("Founder has only Bronze/Silver", () => {
    expect(BADGE_FAMILY_BY_ID.founder.tiers).toEqual([1, 2]);
  });

  it("every family counter is a known snapshot source", () => {
    const sources = new Set<string>([...COUNTER_KEYS, "streakBest"]);
    for (const f of BADGE_FAMILIES) expect(sources.has(f.counter)).toBe(true);
  });

  it("has one-off specials, incl. a hidden one that never exposes criteria in its id", () => {
    const ids = SPECIAL_BADGES.map((b) => b.id);
    expect(ids).toContain("trailblazer");
    expect(ids).toContain("first-reviewer");
    expect(SPECIAL_BADGES.find((b) => b.id === "night-owl")?.hidden).toBe(true);
  });
});

describe("tierForCount — monotonic, highest-of-crossed", () => {
  it("returns 0 below Bronze and climbs at each threshold", () => {
    const t = [3, 10, 25, 60];
    expect(tierForCount(t, 0)).toBe(0);
    expect(tierForCount(t, 2)).toBe(0);
    expect(tierForCount(t, 3)).toBe(1);
    expect(tierForCount(t, 24)).toBe(2);
    expect(tierForCount(t, 25)).toBe(3);
    expect(tierForCount(t, 1000)).toBe(4);
  });

  it("a jump crossing multiple thresholds lands on the highest tier", () => {
    expect(tierForCount([1, 5, 15, 40], 16)).toBe(3); // 0 → 16 crosses Bronze+Silver+Gold
  });

  it("is monotonic non-decreasing in count (property)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 500 }), fc.integer({ min: 0, max: 500 }), (a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        expect(tierForCount([1, 5, 15, 40], hi)).toBeGreaterThanOrEqual(tierForCount([1, 5, 15, 40], lo));
      }),
    );
  });
});

describe("evaluateBadgeUpgrades", () => {
  const snap = (over: Partial<BadgeSnapshot>): BadgeSnapshot => ({ ...emptySnapshot(), ...over });

  it("reports Scout Bronze when reviews cross 1", () => {
    const ups = evaluateBadgeUpgrades(snap({ reviews: 0 }), snap({ reviews: 1 }));
    expect(ups).toHaveLength(1);
    expect(ups[0]).toMatchObject({ familyId: "scout", fromTier: 0, tier: 1, tierName: "Bronze" });
  });

  it("lands on the highest tier when a counter leaps", () => {
    const ups = evaluateBadgeUpgrades(snap({ reviews: 4 }), snap({ reviews: 16 }));
    expect(ups[0]).toMatchObject({ familyId: "scout", tier: 3, tierName: TIER_NAMES[3] });
  });

  it("streakBest drives the Streaker family", () => {
    const ups = evaluateBadgeUpgrades(snap({ streakBest: 3 }), snap({ streakBest: 12 }));
    expect(ups.map((u) => u.familyId)).toContain("streaker");
    expect(ups.find((u) => u.familyId === "streaker")?.tier).toBe(2);
  });

  it("a decrement never reports an upgrade (tiers are not confiscated here)", () => {
    expect(evaluateBadgeUpgrades(snap({ reviews: 10 }), snap({ reviews: 2 }))).toEqual([]);
  });

  it("no change ⇒ no upgrades", () => {
    expect(evaluateBadgeUpgrades(snap({ reviews: 5 }), snap({ reviews: 5 }))).toEqual([]);
  });

  it("tierForFamily reads the right snapshot field", () => {
    expect(tierForFamily(BADGE_FAMILY_BY_ID.explorer, snap({ courtsVisited: 25 }))).toBe(3);
    expect(tierForFamily(BADGE_FAMILY_BY_ID.homebody, snap({ bestCourtCheckins: 30 }))).toBe(2);
  });
});
