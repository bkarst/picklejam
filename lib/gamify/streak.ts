/**
 * streak.ts — the Play-Streak state machine (Gamification PRD §G8.2).
 *
 * Weeks, not days (matching real play cadence). Two PURE functions over ISO-week ids
 * — no I/O, no clock — form the property-test contract:
 *   • resolveStreak(state, nowWeek) — spend Rain Checks / break for whole missed weeks;
 *     runs BOTH lazily (before a play credit) and in the Sunday sweep. Lazy and
 *     scheduled evaluation MUST agree ("sweep lag is immaterial").
 *   • applyPlay(state, w) — after resolve, credit a played week (extend / repair / start).
 *
 * Milestones (E28) are reported here; "once ever per rung" is guaranteed by the E28
 * sourceKey in the data layer (a break-and-regrow re-reports rung 4, but never re-pays).
 */

import { prevWeek, weeksBetween, weeksStrictlyBetween } from "./time";

export const RAIN_CHECK_MAX = 2;
export const STREAK_MILESTONES = [4, 12, 26, 52] as const;
export type StreakMilestone = (typeof STREAK_MILESTONES)[number];
/** A Rain Check is earned every 4th consecutive played week. */
const RAIN_CHECK_EVERY = 4;
/** Repair may fire at most once per this rolling window (weeks). */
const REPAIR_COOLDOWN_WEEKS = 12;

/** Persisted streak fields (a slice of GamifyProfileItem, G8.1). */
export interface StreakState {
  /** Current chain — PLAYED weeks only. */
  streakWeeks: number;
  /** Best chain ever (monotonic). */
  streakBest: number;
  /** Chain length at the last break — what a repair restores. */
  streakPrev?: number;
  /** Newest played week. */
  lastPlayedWeek?: string;
  /** Newest week the chain is contiguous through (played OR Rain-Checked). */
  coveredWeek?: string;
  /** The week the chain last broke. */
  brokenAtWeek?: string;
  /** The week a repair last fired (rolling-12wk cooldown). */
  lastRepairWeek?: string;
  /** Banked Rain Checks, 0…RAIN_CHECK_MAX. */
  rainChecks: number;
}

/** A brand-new player's streak state. */
export function initialStreak(): StreakState {
  return { streakWeeks: 0, streakBest: 0, rainChecks: 0 };
}

/**
 * Resolve missed weeks up to (but not including) `nowWeek`. For each whole missed week
 * `w ∈ (coveredWeek, nowWeek)`, in order: spend a Rain Check (chain preserved, not
 * incremented) if any are banked, else BREAK. Idempotent — re-running with the same
 * `nowWeek` is a no-op (coveredWeek has advanced to `prevWeek(nowWeek)`).
 */
export function resolveStreak(state: StreakState, nowWeek: string): StreakState {
  if (!state.coveredWeek) return state; // never played ⇒ nothing to cover
  let next = { ...state };
  for (const w of weeksStrictlyBetween(state.coveredWeek, nowWeek)) {
    if (next.rainChecks > 0) {
      next = { ...next, rainChecks: next.rainChecks - 1, coveredWeek: w };
    } else {
      next = {
        ...next,
        streakPrev: next.streakWeeks,
        streakWeeks: 0,
        brokenAtWeek: w,
        coveredWeek: w,
      };
    }
  }
  return next;
}

export type PlayOutcome = "noop" | "extend" | "repair" | "start";

export interface ApplyPlayResult {
  state: StreakState;
  outcome: PlayOutcome;
  /** Milestone rung reached this play (E28), if any. */
  milestone?: StreakMilestone;
  /** A Rain Check was banked this play (every 4th played week). */
  earnedRainCheck: boolean;
}

/** Whether the chain is alive going into a play (positive chain, or the first-ever play). */
function chainAlive(s: StreakState): boolean {
  return s.streakWeeks > 0 || (s.lastPlayedWeek === undefined && s.brokenAtWeek === undefined);
}

/**
 * Whether a broken chain qualifies for repair on playing week `w`. Repair is the
 * grace for a SINGLE-week lapse (G8: "playing the week immediately after the miss").
 * `streakPrev > 0` is exactly that test: a lone break preserves the alive chain in
 * `streakPrev`, while cascaded breaks (a multi-week absence) zero it out — so a long
 * absence falls through to a fresh start rather than "repairing" to 1. This resolves
 * G8.2's under-specified multi-gap case in favor of the stated single-lapse intent.
 */
function canRepair(s: StreakState, w: string): boolean {
  if (s.streakWeeks > 0 || s.brokenAtWeek === undefined) return false;
  if ((s.streakPrev ?? 0) <= 0) return false; // only a single-week lapse is repairable
  if (s.brokenAtWeek !== prevWeek(w)) return false; // must play the week right after the miss
  if (s.lastRepairWeek === undefined) return true;
  return weeksBetween(s.lastRepairWeek, w) >= REPAIR_COOLDOWN_WEEKS;
}

/**
 * Credit a played week `w` (call AFTER {@link resolveStreak}). Idempotent within a week.
 * Extends an alive chain, repairs a just-broken one (grace, ≤1/12wk), or starts fresh.
 */
export function applyPlay(state: StreakState, w: string): ApplyPlayResult {
  // 1. idempotent within a week
  if (state.lastPlayedWeek === w) {
    return { state, outcome: "noop", earnedRainCheck: false };
  }

  let base: StreakState;
  let outcome: PlayOutcome;
  if (chainAlive(state)) {
    base = { ...state, streakWeeks: state.streakWeeks + 1 };
    outcome = "extend";
  } else if (canRepair(state, w)) {
    base = { ...state, streakWeeks: (state.streakPrev ?? 0) + 1, lastRepairWeek: w };
    outcome = "repair";
  } else {
    base = { ...state, streakWeeks: 1 };
    outcome = "start";
  }

  base.lastPlayedWeek = w;
  base.coveredWeek = w;
  base.brokenAtWeek = undefined;

  // Rain Check every 4th played week (bank ≤ RAIN_CHECK_MAX).
  const earnedRainCheck = base.streakWeeks % RAIN_CHECK_EVERY === 0;
  if (earnedRainCheck) base.rainChecks = Math.min(RAIN_CHECK_MAX, base.rainChecks + 1);

  base.streakBest = Math.max(base.streakBest, base.streakWeeks);

  const milestone = (STREAK_MILESTONES as readonly number[]).includes(base.streakWeeks)
    ? (base.streakWeeks as StreakMilestone)
    : undefined;

  return { state: base, outcome, milestone, earnedRainCheck };
}

/** Convenience: resolve then play in one step (the lazy award-time path). */
export function resolveAndPlay(state: StreakState, w: string): ApplyPlayResult {
  return applyPlay(resolveStreak(state, w), w);
}
