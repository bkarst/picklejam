/**
 * gamify-digest.test.ts — the pure streak-at-risk gate (§G14). The reminder is opt-in
 * (streakReminders), needs an active streak, and only fires when this week is unplayed.
 */
import { describe, it, expect } from "vitest";
import { isStreakAtRisk } from "@/lib/data/gamify-digest";
import { isoWeekOf } from "@/lib/gamify/time";
import type { GamifyProfileItem } from "@/lib/db/types";

const NOW = Date.parse("2026-01-08T12:00:00Z"); // Thursday, 2026-W02
const thisWeek = isoWeekOf("UTC", NOW);

function profile(over: Partial<GamifyProfileItem>): GamifyProfileItem {
  return {
    pk: "USER#u", sk: "GAMIFY#META", entity: "GAMIFY", uid: "u",
    rp: 0, rpLifetime: 0, rpLevelWatermark: 0, level: 1,
    streakWeeks: 3, streakBest: 3, rainChecks: 0,
    counters: {} as GamifyProfileItem["counters"],
    prefs: { enabled: true, streakReminders: true, digest: false, leaderboards: "public" },
    createdAt: "", updatedAt: "",
    ...over,
  };
}

describe("isStreakAtRisk", () => {
  it("fires when opted-in, streak > 0, and this week is unplayed", () => {
    expect(isStreakAtRisk(profile({ lastPlayedWeek: "2026-W01" }), NOW)).toBe(true);
  });
  it("does not fire when the reminder is off (default)", () => {
    expect(isStreakAtRisk(profile({ lastPlayedWeek: "2026-W01", prefs: { enabled: true, streakReminders: false, digest: false, leaderboards: "public" } }), NOW)).toBe(false);
  });
  it("does not fire when there's no streak to protect", () => {
    expect(isStreakAtRisk(profile({ streakWeeks: 0, lastPlayedWeek: "2026-W01" }), NOW)).toBe(false);
  });
  it("does not fire once the user has already played this week", () => {
    expect(isStreakAtRisk(profile({ lastPlayedWeek: thisWeek }), NOW)).toBe(false);
  });
  it("does not fire when gamification is disabled", () => {
    expect(isStreakAtRisk(profile({ lastPlayedWeek: "2026-W01", prefs: { enabled: false, streakReminders: true, digest: false, leaderboards: "public" } }), NOW)).toBe(false);
  });
});
