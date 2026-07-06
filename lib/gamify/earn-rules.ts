/**
 * earn-rules.ts — the Rally-Points earn table (Gamification PRD §G4.2), as typed
 * config. Every RP number the UI shows is COMPUTED from this table (never a literal),
 * and the six G4.2 worked-example totals are reproduced by {@link pointsFor} — the
 * arithmetic oracle for toasts, the check-in sheet, and the G19 tests.
 *
 * Pure, no I/O. Cap ENFORCEMENT lives in the data layer (`awardXp` conditions the
 * profile update on the family's user-tz day counter); this module owns the constants
 * and the per-rule → cap-family assignment those conditions read.
 */

export type EarnRule =
  | "E1" | "E2" | "E3" | "E4" | "E5" | "E6" | "E7" | "E8" | "E9" | "E10"
  | "E11" | "E12" | "E13" | "E14" | "E15" | "E16" | "E17" | "E18" | "E19" | "E20"
  | "E21" | "E22" | "E23" | "E24" | "E25" | "E26" | "E27" | "E28";

export type CapFamily = "presence" | "contribution" | "organizing" | "competition" | "system";

/** Which target behavior (G1.1) a rule serves; `system` = onboarding/streak/quest plumbing. */
export type Behavior = "B1" | "B2" | "B3" | "B4" | "system";

export interface EarnRuleDef {
  family: CapFamily;
  behavior: Behavior;
  /**
   * The flat RP this rule pays. For the four VARIABLE rules the awarded amount is
   * computed at award time from context (see {@link pointsFor}); `points` then holds a
   * nominal/base value and `variable` is set:
   *   E12 podium → {@link PODIUM_RP}, E17 per-rung → ×rungs, E26 quest → the quest's
   *   rewardRp, E28 milestone → {@link STREAK_MILESTONE_RP}.
   */
  points: number;
  variable?: boolean;
  /** Human-readable cap/structural note (enforced at the call site or in awardXp). */
  note?: string;
}

/** The complete E1–E28 table. Values are exact launch constants (G4.2). */
export const EARN_RULES: Record<EarnRule, EarnRuleDef> = {
  // — B1: check-ins (presence) —
  E1: { family: "presence", behavior: "B1", points: 10, note: "1×/court/court-local-day; max 2 courts/day earn" },
  E2: { family: "presence", behavior: "B1", points: 5, note: "note ≥20 chars or lookingToPlay; once/day" },
  E3: { family: "presence", behavior: "B1", points: 15, note: "Explorer: first-ever check-in at a court new to you; uncapped" },
  E4: { family: "presence", behavior: "B1", points: 25, note: "Trailblazer: first check-in at a court new to the platform; once ever" },
  // — B2: reviews (contribution) —
  E5: { family: "contribution", behavior: "B2", points: 50, note: "first publish only; edits pay 0" },
  E6: { family: "contribution", behavior: "B2", points: 25, note: "quality: body ≥100 words AND ≥1 photo; once per review" },
  E7: { family: "contribution", behavior: "B2", points: 10, note: "verified via check-in; once per review" },
  E8: { family: "contribution", behavior: "B2", points: 2, note: "helpful vote received; voter Level ≥2; ≤10 RP/review/week" },
  E9: { family: "contribution", behavior: "B2", points: 10, note: "court photo outside a review; ≤3 photo earns/court" },
  // — B3: competition (uncapped daily; money- or handshake-backed) —
  E10: { family: "competition", behavior: "B3", points: 100, note: "tournament registration confirmed (webhook); per division" },
  E11: { family: "competition", behavior: "B3", points: 20, note: "tournament bracket match played; per match" },
  E12: { family: "competition", behavior: "B3", points: 150, variable: true, note: "podium 150/100/50 (1st/2nd/3rd); + Medalist badge" },
  E13: { family: "competition", behavior: "B3", points: 150, note: "league registration confirmed (webhook); per season" },
  E14: { family: "competition", behavior: "B3", points: 25, note: "league weekly match confirmed (two-party); both players earn" },
  E15: { family: "competition", behavior: "B3", points: 200, note: "league season completed (played ≥75% of fixtures)" },
  E16: { family: "competition", behavior: "B3", points: 25, note: "ladder challenge completed (both-confirmed); both earn" },
  E17: { family: "competition", behavior: "B3", points: 10, variable: true, note: "ladder rung climbed; 10/rung; ≤50 RP/week" },
  E18: { family: "competition", behavior: "B3", points: 75, note: "re-registration for a consecutive league season" },
  // — B4: social & organizing —
  E19: { family: "presence", behavior: "B4", points: 15, note: "RSVP 'going' to an outing that occurs; ≤3 outings/week" },
  E20: { family: "organizing", behavior: "B4", points: 40, note: "host an outing where ≥4 players were going; ≤2/week" },
  E21: { family: "organizing", behavior: "B4", points: 60, note: "round robin created and completed (≥6 entrants, ≥1 full round scored)" },
  E22: { family: "organizing", behavior: "B4", points: 50, note: "group you created reaches 5 active members; once/group; ≤2 groups" },
  E23: { family: "organizing", behavior: "B4", points: 40, note: "group meet-up hosted (hostType=GROUP); shares the E20 cap" },
  // — onboarding & system (uncapped daily; each structurally bounded) —
  E24: { family: "system", behavior: "system", points: 25, note: "welcome bonus (account created); once ever" },
  E25: { family: "system", behavior: "system", points: 25, note: "starter quest step (profile / first check-in / follow a court)" },
  E26: { family: "system", behavior: "system", points: 0, variable: true, note: "weekly quest completed; pays the quest's rewardRp" },
  E27: { family: "system", behavior: "system", points: 50, note: "community quest goal met; all ≥3-action contributors" },
  E28: { family: "system", behavior: "system", points: 50, variable: true, note: "Play Streak milestone 50/150/300/600 at 4/12/26/52 weeks" },
};

/** Podium RP by finishing place (E12). */
export const PODIUM_RP: Record<1 | 2 | 3, number> = { 1: 150, 2: 100, 3: 50 };

/** Play-Streak milestone RP by rung, once ever per rung (E28). */
export const STREAK_MILESTONE_RP: Record<4 | 12 | 26 | 52, number> = {
  4: 50,
  12: 150,
  26: 300,
  52: 600,
};

export interface CapFamilyDef {
  rules: readonly EarnRule[];
  /** RP budget per user-local day (G13.0); `null` = uncapped (structurally bounded). */
  dailyCap: number | null;
}

/** Cap families — every rule belongs to exactly one (G4.2), enforced per user-local day. */
export const CAP_FAMILIES: Record<CapFamily, CapFamilyDef> = {
  presence: { rules: ["E1", "E2", "E3", "E4", "E19"], dailyCap: 150 },
  contribution: { rules: ["E5", "E6", "E7", "E8", "E9"], dailyCap: 200 },
  organizing: { rules: ["E20", "E21", "E22", "E23"], dailyCap: 150 },
  competition: { rules: ["E10", "E11", "E12", "E13", "E14", "E15", "E16", "E17", "E18"], dailyCap: null },
  system: { rules: ["E24", "E25", "E26", "E27", "E28"], dailyCap: null },
};

/** Per-rule weekly sub-caps, orthogonal to the family day-cap (G4.2). */
export const SUB_CAPS: Partial<Record<EarnRule, { limit: number; window: "week"; per: "review" | "user" }>> = {
  E8: { limit: 10, window: "week", per: "review" },
  E17: { limit: 50, window: "week", per: "user" },
};

export const CAP_FAMILY_OF: Record<EarnRule, CapFamily> = Object.fromEntries(
  (Object.entries(CAP_FAMILIES) as [CapFamily, CapFamilyDef][]).flatMap(([family, def]) =>
    def.rules.map((rule) => [rule, family]),
  ),
) as Record<EarnRule, CapFamily>;

/** The cap family a rule belongs to (the day-counter target in awardXp). */
export function capFamilyOf(rule: EarnRule): CapFamily {
  return CAP_FAMILY_OF[rule];
}

/** Whether a rule's family has a daily RP budget (vs. uncapped competition/system). */
export function isCapped(rule: EarnRule): boolean {
  return CAP_FAMILIES[capFamilyOf(rule)].dailyCap !== null;
}

/** Variable inputs some rules need to compute their exact RP. */
export interface EarnContext {
  podiumPlace?: 1 | 2 | 3;
  /** Net rungs climbed in one re-rank apply (E17). */
  rungs?: number;
  /** The completed quest's configured reward (E26). */
  questRewardRp?: number;
  /** The streak milestone rung reached (E28). */
  streakMilestone?: 4 | 12 | 26 | 52;
}

/**
 * Exact RP for one triggered rule. Fixed rules read their `points`; the four variable
 * rules compute from `ctx`. This is the single arithmetic oracle — the G4.2 worked
 * examples (10 · 30 · 55 · 85 · 330 · 550/625) are `Σ pointsFor(...)` over their rules.
 */
export function pointsFor(rule: EarnRule, ctx: EarnContext = {}): number {
  switch (rule) {
    case "E12":
      return PODIUM_RP[ctx.podiumPlace ?? 1];
    case "E17":
      return EARN_RULES.E17.points * Math.max(0, ctx.rungs ?? 1);
    case "E26":
      return Math.max(0, ctx.questRewardRp ?? 0);
    case "E28":
      return ctx.streakMilestone ? STREAK_MILESTONE_RP[ctx.streakMilestone] : 0;
    default:
      return EARN_RULES[rule].points;
  }
}

/** Sum a set of triggered rules (each with its own context) — a full award total. */
export function sumAwards(awards: { rule: EarnRule; ctx?: EarnContext }[]): number {
  return awards.reduce((total, a) => total + pointsFor(a.rule, a.ctx), 0);
}
