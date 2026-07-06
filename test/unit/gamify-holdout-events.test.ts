/**
 * gamify-holdout-events.test.ts — the G18 holdout, the §G15 analytics taxonomy, and the
 * §G16.8 guidelines clause.
 */
import { describe, it, expect, afterEach } from "vitest";
import { resolveHoldout, HOLDOUT_PERCENT } from "@/lib/gamify/prefs";
import { SERVER_EVENTS, CLIENT_EVENTS } from "@/lib/analytics/events";
import { getLegalDoc } from "@/lib/legal/docs";

describe("resolveHoldout (§G18)", () => {
  afterEach(() => {
    delete process.env.GAMIFY_HOLDOUT_ENABLED;
  });

  it("holds out nobody by default (pre-release)", () => {
    for (const uid of ["a", "b", "c", "user-123", "zzz"]) expect(resolveHoldout(uid)).toBe(false);
  });

  it("when enabled, buckets a deterministic, stable ~10% share", () => {
    process.env.GAMIFY_HOLDOUT_ENABLED = "1";
    const uids = Array.from({ length: 2000 }, (_, i) => `user-${i}`);
    const held = uids.filter(resolveHoldout);
    // Roughly 10% (allow generous slack for the hash distribution).
    expect(held.length).toBeGreaterThan(uids.length * 0.05);
    expect(held.length).toBeLessThan(uids.length * 0.16);
    expect(HOLDOUT_PERCENT).toBe(10);
    // Stable per uid.
    for (const uid of uids.slice(0, 50)) expect(resolveHoldout(uid)).toBe(resolveHoldout(uid));
  });
});

describe("analytics taxonomy (§G15)", () => {
  it("includes the gamification server ⚙ events", () => {
    for (const e of ["xp_awarded", "level_up", "badge_awarded", "quest_completed", "streak_extended", "elite_awarded"]) {
      expect(SERVER_EVENTS).toContain(e);
    }
  });
  it("includes the gamification client events", () => {
    for (const e of ["progress_viewed", "leaderboard_viewed", "badge_shared", "gamification_disabled", "gamification_enabled"]) {
      expect(CLIENT_EVENTS).toContain(e);
    }
  });
});

describe("community guidelines fair-play clause (§G16.8)", () => {
  it("adds a Rally-Points integrity section that names strikes", () => {
    const doc = getLegalDoc("community-guidelines");
    const section = doc?.sections.find((s) => /rally points/i.test(s.heading));
    expect(section).toBeDefined();
    const text = section!.body.join(" ");
    expect(text).toMatch(/fabricated check-ins|farming/i);
    expect(text).toMatch(/strike/i);
  });
});
