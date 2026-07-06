/**
 * gamify-earn-rules.test.ts — the RP economy oracle (§G4.2). Asserts every E-rule's
 * points + cap-family membership, the family day-budgets, the sub-caps, and — the
 * load-bearing check — the six worked-example totals reproduced EXACTLY.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  EARN_RULES,
  CAP_FAMILIES,
  CAP_FAMILY_OF,
  SUB_CAPS,
  PODIUM_RP,
  STREAK_MILESTONE_RP,
  capFamilyOf,
  isCapped,
  pointsFor,
  sumAwards,
  type EarnRule,
} from "@/lib/gamify/earn-rules";

const ALL_RULES = Object.keys(EARN_RULES) as EarnRule[];

describe("EARN_RULES table", () => {
  it("covers exactly E1–E28", () => {
    expect(ALL_RULES).toHaveLength(28);
    expect(ALL_RULES).toEqual(Array.from({ length: 28 }, (_, i) => `E${i + 1}`));
  });

  it("pins the fixed launch constants", () => {
    const p = (r: EarnRule) => EARN_RULES[r].points;
    expect([p("E1"), p("E2"), p("E3"), p("E4")]).toEqual([10, 5, 15, 25]);
    expect([p("E5"), p("E6"), p("E7"), p("E8"), p("E9")]).toEqual([50, 25, 10, 2, 10]);
    expect([p("E10"), p("E11"), p("E13"), p("E14"), p("E15"), p("E18")]).toEqual([100, 20, 150, 25, 200, 75]);
    expect([p("E19"), p("E20"), p("E21"), p("E22"), p("E23")]).toEqual([15, 40, 60, 50, 40]);
    expect([p("E24"), p("E25"), p("E27")]).toEqual([25, 25, 50]);
    expect(PODIUM_RP).toEqual({ 1: 150, 2: 100, 3: 50 });
    expect(STREAK_MILESTONE_RP).toEqual({ 4: 50, 12: 150, 26: 300, 52: 600 });
  });

  it("marks the four variable rules", () => {
    expect(ALL_RULES.filter((r) => EARN_RULES[r].variable)).toEqual(["E12", "E17", "E26", "E28"]);
  });
});

describe("cap families — every rule in exactly one, with the right budget", () => {
  it("partitions all 28 rules across the 5 families", () => {
    const flat = Object.values(CAP_FAMILIES).flatMap((f) => f.rules);
    expect(flat.slice().sort()).toEqual(ALL_RULES.slice().sort());
    expect(new Set(flat).size).toBe(28); // no rule in two families
  });

  it("has the exact daily budgets (presence 150 · contribution 200 · organizing 150 · competition/system uncapped)", () => {
    expect(CAP_FAMILIES.presence.dailyCap).toBe(150);
    expect(CAP_FAMILIES.contribution.dailyCap).toBe(200);
    expect(CAP_FAMILIES.organizing.dailyCap).toBe(150);
    expect(CAP_FAMILIES.competition.dailyCap).toBeNull();
    expect(CAP_FAMILIES.system.dailyCap).toBeNull();
  });

  it("assigns the exact membership (presence includes E19; competition is E10–E18)", () => {
    expect(capFamilyOf("E1")).toBe("presence");
    expect(capFamilyOf("E19")).toBe("presence");
    expect(capFamilyOf("E9")).toBe("contribution");
    expect(capFamilyOf("E20")).toBe("organizing");
    expect(capFamilyOf("E10")).toBe("competition");
    expect(capFamilyOf("E18")).toBe("competition");
    expect(capFamilyOf("E24")).toBe("system");
    expect(CAP_FAMILY_OF).toMatchObject({ E1: "presence", E5: "contribution", E23: "organizing" });
  });

  it("isCapped: presence/contribution/organizing yes, competition/system no", () => {
    expect((["E1", "E5", "E20"] as EarnRule[]).every(isCapped)).toBe(true);
    expect((["E10", "E17", "E24", "E28"] as EarnRule[]).some(isCapped)).toBe(false);
  });

  it("has the E8 and E17 weekly sub-caps", () => {
    expect(SUB_CAPS.E8).toEqual({ limit: 10, window: "week", per: "review" });
    expect(SUB_CAPS.E17).toEqual({ limit: 50, window: "week", per: "user" });
  });
});

describe("pointsFor — variable-rule arithmetic", () => {
  it("podium (E12) by place", () => {
    expect(pointsFor("E12", { podiumPlace: 1 })).toBe(150);
    expect(pointsFor("E12", { podiumPlace: 2 })).toBe(100);
    expect(pointsFor("E12", { podiumPlace: 3 })).toBe(50);
  });
  it("ladder rung climb (E17) is 10/rung", () => {
    expect(pointsFor("E17", { rungs: 1 })).toBe(10);
    expect(pointsFor("E17", { rungs: 3 })).toBe(30);
  });
  it("quest reward (E26) passes through", () => {
    expect(pointsFor("E26", { questRewardRp: 75 })).toBe(75);
    expect(pointsFor("E26")).toBe(0);
  });
  it("streak milestone (E28) by rung", () => {
    expect(pointsFor("E28", { streakMilestone: 4 })).toBe(50);
    expect(pointsFor("E28", { streakMilestone: 52 })).toBe(600);
  });
  it("fixed rules ignore context", () => {
    fc.assert(
      fc.property(fc.constantFrom<EarnRule>("E1", "E5", "E10", "E24"), (r) => {
        expect(pointsFor(r, { podiumPlace: 3, rungs: 9 })).toBe(EARN_RULES[r].points);
      }),
    );
  });
});

describe("worked-example totals reproduced EXACTLY (§G4.2)", () => {
  it("plain authed check-in = 10", () => {
    expect(sumAwards([{ rule: "E1" }])).toBe(10);
  });
  it("check-in + note, at a court new to you = 30", () => {
    expect(sumAwards([{ rule: "E1" }, { rule: "E2" }, { rule: "E3" }])).toBe(30);
  });
  it("platform-first (Trailblazer) with a note = 55", () => {
    expect(sumAwards([{ rule: "E1" }, { rule: "E2" }, { rule: "E3" }, { rule: "E4" }])).toBe(55);
  });
  it("full-quality verified review = 85", () => {
    expect(sumAwards([{ rule: "E5" }, { rule: "E6" }, { rule: "E7" }])).toBe(85);
  });
  it("tournament: register + 4 matches + win the bracket = 330", () => {
    const total = sumAwards([
      { rule: "E10" },
      { rule: "E11" }, { rule: "E11" }, { rule: "E11" }, { rule: "E11" },
      { rule: "E12", ctx: { podiumPlace: 1 } },
    ]);
    expect(total).toBe(330);
  });
  it("league season: register + 8 fixtures + season complete = 550, then +re-register = 625", () => {
    const season = sumAwards([
      { rule: "E13" },
      ...Array.from({ length: 8 }, () => ({ rule: "E14" as const })),
      { rule: "E15" },
    ]);
    expect(season).toBe(550);
    expect(season + sumAwards([{ rule: "E18" }])).toBe(625);
  });
});
