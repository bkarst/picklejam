/**
 * gamify-elite.test.ts — the config-driven Elite criteria evaluator (§G11). A threshold
 * change needs no code change; a single strike vetoes; the public copy renders the live config.
 */
import { describe, it, expect } from "vitest";
import {
  ELITE_CRITERIA,
  evaluateElite,
  eliteCriteriaCopy,
  medianOf,
  eliteBadgeId,
  type EliteStats,
} from "@/lib/gamify/elite";

const passing: EliteStats = {
  reviews: 12,
  medianReviewWords: 80,
  verifiedPct: 0.6,
  checkins: 40,
  competitions: 1,
  hostedEvents: 0,
  strikes: 0,
};

describe("evaluateElite (§G11)", () => {
  it("a fully-qualifying user is eligible; every check passes", () => {
    const r = evaluateElite(passing);
    expect(r.eligible).toBe(true);
    expect(r.checks.every((c) => c.met)).toBe(true);
  });

  it("the hosted alternative satisfies participation without a competition entry", () => {
    const r = evaluateElite({ ...passing, competitions: 0, hostedEvents: 6 });
    expect(r.eligible).toBe(true);
    expect(r.checks.find((c) => c.key === "participation")?.met).toBe(true);
  });

  it("falls short below any single threshold", () => {
    expect(evaluateElite({ ...passing, reviews: 11 }).eligible).toBe(false);
    expect(evaluateElite({ ...passing, medianReviewWords: 79 }).eligible).toBe(false);
    expect(evaluateElite({ ...passing, verifiedPct: 0.59 }).eligible).toBe(false);
    expect(evaluateElite({ ...passing, checkins: 39 }).eligible).toBe(false);
    expect(evaluateElite({ ...passing, competitions: 0, hostedEvents: 5 }).eligible).toBe(false);
  });

  it("a single moderation strike vetoes eligibility", () => {
    const r = evaluateElite({ ...passing, strikes: 1 });
    expect(r.eligible).toBe(false);
    expect(r.checks.find((c) => c.key === "strikes")?.met).toBe(false);
  });

  it("median words only counts when the review floor is also met", () => {
    // Long reviews but too few of them ⇒ the medianWords check is not credited.
    const r = evaluateElite({ ...passing, reviews: 3, medianReviewWords: 200 });
    expect(r.checks.find((c) => c.key === "medianWords")?.met).toBe(false);
  });

  it("is config-driven — a threshold change needs no code change", () => {
    const looser = { ...ELITE_CRITERIA, minReviews: 3, minCheckins: 5 };
    const stats: EliteStats = { ...passing, reviews: 3, checkins: 5 };
    expect(evaluateElite(stats).eligible).toBe(false); // fails default config
    expect(evaluateElite(stats, looser).eligible).toBe(true); // passes looser config
  });
});

describe("eliteCriteriaCopy renders the live config", () => {
  it("mentions each threshold value from the config", () => {
    const copy = eliteCriteriaCopy().join(" ");
    expect(copy).toContain(`${ELITE_CRITERIA.minReviews}+`);
    expect(copy).toContain(`${ELITE_CRITERIA.minMedianWords}+ words`);
    expect(copy).toContain(`${ELITE_CRITERIA.minCheckins}+`);
    expect(copy).toContain("60%");
    expect(copy.toLowerCase()).toContain("no moderation strikes");
  });
});

describe("helpers", () => {
  it("medianOf handles odd, even, and empty lists", () => {
    expect(medianOf([90])).toBe(90);
    expect(medianOf([80, 100])).toBe(90);
    expect(medianOf([10, 90, 50])).toBe(50);
    expect(medianOf([])).toBe(0);
  });

  it("eliteBadgeId is year-stamped", () => {
    expect(eliteBadgeId("2026")).toBe("elite-2026");
  });
});
