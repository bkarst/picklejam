/**
 * gamify-earn-isolation.test.ts — FAILURE ISOLATION (§G13.2, the layer's most
 * important behavior). The earn orchestrators must never throw, so the core write
 * (check-in / review route) always commits even when gamification errors.
 */
import { describe, it, expect, vi } from "vitest";

// Force the data layer to throw at every entry point.
vi.mock("@/lib/data/gamify", () => ({
  awardXpSafe: vi.fn(async () => {
    throw new Error("boom: awardXp exploded");
  }),
  hasEarn: vi.fn(async () => {
    throw new Error("boom: hasEarn exploded");
  }),
  toGamifyBlock: vi.fn(() => undefined),
}));

import { earnCheckin, earnReview } from "@/lib/data/gamify-earn";

describe("earn orchestration is failure-isolated", () => {
  it("earnCheckin resolves to undefined instead of throwing", async () => {
    await expect(
      earnCheckin({ uid: "u1", courtId: "c1", day: "20260705", note: "a note long enough to qualify here" }),
    ).resolves.toBeUndefined();
  });

  it("earnReview resolves to undefined instead of throwing", async () => {
    await expect(
      earnReview({ uid: "u1", courtId: "c1", body: "body", hasPhoto: true, checkinVerified: true }),
    ).resolves.toBeUndefined();
  });
});
