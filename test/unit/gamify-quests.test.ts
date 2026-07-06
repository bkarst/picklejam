/**
 * gamify-quests.test.ts — catalog, predicate matching, week-stamped ids, and the
 * DETERMINISTIC selection (§G9.1). Also cross-checks quest rewards against E26.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  WEEKLY_QUESTS,
  QUEST_BY_SLUG,
  FALLBACK_TRIO,
  weeklyQuestId,
  parseWeeklyQuestId,
  questPredicateMatches,
  selectWeeklyQuests,
} from "@/lib/gamify/quests";

describe("catalog", () => {
  it("has the 10 launch quests", () => {
    expect(WEEKLY_QUESTS).toHaveLength(10);
  });

  it("quest rewards match the E26 catalog values (§G4.2)", () => {
    const expected: Record<string, number> = {
      lookingtoplay: 15, follow1: 15, helpful1: 20, photo1: 25, checkin3: 30,
      rsvp1: 30, twocourts: 40, review1: 50, match1: 75, host1: 75,
    };
    for (const [slug, rp] of Object.entries(expected)) {
      expect(QUEST_BY_SLUG[slug].rewardRp).toBe(rp);
    }
  });

  it("the fallback trio is all-B1 and solo-achievable", () => {
    expect([...FALLBACK_TRIO]).toEqual(["checkin3", "twocourts", "lookingtoplay"]);
    for (const slug of FALLBACK_TRIO) expect(QUEST_BY_SLUG[slug].family).toBe("B1");
  });
});

describe("week-stamped ids", () => {
  it("build and parse round-trip", () => {
    const id = weeklyQuestId("2026-W28", "checkin3");
    expect(id).toBe("wq#2026-W28#checkin3");
    expect(parseWeeklyQuestId(id)).toEqual({ isoWeek: "2026-W28", slug: "checkin3" });
    expect(parseWeeklyQuestId("QUESTPROG#foo")).toBeNull();
  });
});

describe("questPredicateMatches", () => {
  it("E1 advances checkin3 and twocourts", () => {
    expect(questPredicateMatches(QUEST_BY_SLUG.checkin3, { rule: "E1", courtId: "c1" })).toBe(true);
    expect(questPredicateMatches(QUEST_BY_SLUG.twocourts, { rule: "E1", courtId: "c1" })).toBe(true);
  });
  it("lookingtoplay needs the lookingToPlay flag on E2", () => {
    expect(questPredicateMatches(QUEST_BY_SLUG.lookingtoplay, { rule: "E2", lookingToPlay: true })).toBe(true);
    expect(questPredicateMatches(QUEST_BY_SLUG.lookingtoplay, { rule: "E2", lookingToPlay: false })).toBe(false);
  });
  it("non-ledger ticks advance rsvp1 and follow1", () => {
    expect(questPredicateMatches(QUEST_BY_SLUG.rsvp1, { tick: "rsvp-going" })).toBe(true);
    expect(questPredicateMatches(QUEST_BY_SLUG.follow1, { tick: "court-follow" })).toBe(true);
  });
  it("match1 is the union E11 ∪ E14 ∪ E16", () => {
    for (const rule of ["E11", "E14", "E16"] as const) {
      expect(questPredicateMatches(QUEST_BY_SLUG.match1, { rule })).toBe(true);
    }
    expect(questPredicateMatches(QUEST_BY_SLUG.match1, { rule: "E1" })).toBe(false);
  });
});

describe("selectWeeklyQuests — deterministic (§G9.1)", () => {
  const fullElig = { unreviewedCourt: true, activeRegistration: true, priorHosting: true };

  it("no history ⇒ the fallback trio", () => {
    expect(selectWeeklyQuests("u1", "2026-W28", {})).toEqual([...FALLBACK_TRIO]);
    expect(selectWeeklyQuests("u1", "2026-W28", { familyUsage: {} })).toEqual([...FALLBACK_TRIO]);
  });

  it("same (uid, isoWeek) ⇒ same trio; is order-stable and distinct", () => {
    const ctx = { familyUsage: { B1: 5, B2: 2, B3: 0, B4: 1 }, eligibility: fullElig };
    const a = selectWeeklyQuests("user-42", "2026-W28", ctx);
    const b = selectWeeklyQuests("user-42", "2026-W28", ctx);
    expect(a).toEqual(b);
    expect(a).toHaveLength(3);
    expect(new Set(a).size).toBe(3); // distinct
    for (const slug of a) expect(QUEST_BY_SLUG[slug]).toBeDefined();
  });

  it("different weeks generally rotate the trio", () => {
    const ctx = { familyUsage: { B1: 5, B2: 2, B3: 1, B4: 3 }, eligibility: fullElig };
    const weeks = ["2026-W28", "2026-W29", "2026-W30", "2026-W31"].map((w) =>
      selectWeeklyQuests("user-42", w, ctx).join(","),
    );
    expect(new Set(weeks).size).toBeGreaterThan(1);
  });

  it("never offers a guarded quest when its precondition is unmet", () => {
    const ctx = { familyUsage: { B1: 1, B2: 1, B3: 9, B4: 1 }, eligibility: { unreviewedCourt: false, activeRegistration: false, priorHosting: false } };
    // B3 is dominant but match1 (its only quest) requires an active registration → excluded.
    fc.assert(
      fc.property(fc.constantFrom("2026-W01", "2026-W15", "2026-W40", "2026-W52"), (week) => {
        const trio = selectWeeklyQuests("grinder", week, ctx);
        expect(trio).not.toContain("match1");
        expect(trio).not.toContain("review1");
        expect(trio).not.toContain("host1");
        expect(trio).toHaveLength(3);
      }),
    );
  });

  it("selection is a pure function of its inputs (property)", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.constantFrom("2026-W01", "2026-W28", "2026-W52"),
        (uid, week) => {
          const ctx = { familyUsage: { B1: 3, B2: 2, B3: 1, B4: 4 }, eligibility: fullElig };
          expect(selectWeeklyQuests(uid, week, ctx)).toEqual(selectWeeklyQuests(uid, week, ctx));
        },
      ),
    );
  });
});
