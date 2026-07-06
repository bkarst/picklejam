/**
 * gamify-award-plan.test.ts — the pure award planner (§G4/§G13.2). Cap-family sums,
 * counter deltas, watermark/level movement, and revocation semantics — the unit oracle
 * for the awardXp transaction, testable without DynamoDB.
 */
import { describe, it, expect } from "vitest";
import { planAward } from "@/lib/gamify/award";

const snap = (rpLifetime: number, rpLevelWatermark = rpLifetime) => ({ rpLifetime, rpLevelWatermark });

describe("planAward — points & families", () => {
  it("sums a check-in award and buckets points under the presence family", () => {
    const plan = planAward(snap(0), [{ rule: "E1" }, { rule: "E2" }, { rule: "E3" }]);
    expect(plan.total).toBe(30);
    expect(plan.cappedFamilyPoints).toEqual({ presence: 30 });
    expect(plan.counterDeltas).toEqual({ checkins: 1, courtsVisited: 1 });
  });

  it("does not bucket uncapped (competition/system) rules under any cap family", () => {
    const plan = planAward(snap(0), [{ rule: "E10" }, { rule: "E11" }, { rule: "E24" }]);
    expect(plan.cappedFamilyPoints).toEqual({});
    expect(plan.total).toBe(145);
  });

  it("scales the E17 counter by rungs and reads variable points", () => {
    const plan = planAward(snap(0), [{ rule: "E17", ctx: { rungs: 3 } }]);
    expect(plan.total).toBe(30);
    expect(plan.counterDeltas).toEqual({ rungsClimbed: 3 });
  });

  it("reads the podium place for E12", () => {
    expect(planAward(snap(0), [{ rule: "E12", ctx: { podiumPlace: 2 } }]).total).toBe(100);
  });
});

describe("planAward — levels", () => {
  it("moves the watermark and reports the level-up when a threshold is crossed", () => {
    const plan = planAward(snap(90), [{ rule: "E13" }]); // +150 → 240, crosses Level 2 (100)
    expect(plan.newLifetime).toBe(240);
    expect(plan.newWatermark).toBe(240);
    expect(plan.newLevel).toBe(2); // 240 ∈ [100, 300)
    expect(plan.levelUp).toBe(2);
  });

  it("lands on the correct level and fires one level-up across multiple thresholds", () => {
    const plan = planAward(snap(50), [{ rule: "E13" }, { rule: "E15" }]); // +150+200 = +350 → 400
    expect(plan.newLifetime).toBe(400);
    expect(plan.newLevel).toBe(3); // 400 ∈ [300,700)
    expect(plan.levelUp).toBe(3); // higher wins, one event
  });

  it("no level-up when staying within a level", () => {
    const plan = planAward(snap(100), [{ rule: "E1" }]); // 100 → 110, still Level 2
    expect(plan.levelUp).toBeNull();
  });
});

describe("planAward — revocations", () => {
  it("negates points and counters but freezes the watermark/level", () => {
    const plan = planAward(snap(200, 200), [{ rule: "E10" }], { revoke: true });
    expect(plan.total).toBe(-100);
    expect(plan.newLifetime).toBe(100);
    expect(plan.newWatermark).toBeNull(); // watermark unchanged (levels never regress)
    expect(plan.newLevel).toBeNull();
    expect(plan.levelUp).toBeNull();
    expect(plan.isRevocation).toBe(true);
  });

  it("does not add revoked earns to any cap family", () => {
    const plan = planAward(snap(100), [{ rule: "E1" }], { revoke: true });
    expect(plan.cappedFamilyPoints).toEqual({});
    expect(plan.counterDeltas).toEqual({ checkins: -1 });
  });
});
