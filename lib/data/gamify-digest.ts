/**
 * gamify-digest.ts — the weekly digest assembly (§G12.19) + streak-at-risk reminder
 * (§G14). Both are driven by scheduled jobs (the Sunday sweep sends the digest per-tz
 * evening; a Thursday job fires the reminder) — those CRON DRIVERS are ops hooks, like
 * the P1 outing-completion sweep. This module owns the testable assembly + gating.
 *
 * The digest is deliberately NOT a NotificationType (§G14): it's a direct Resend send
 * gated by `prefs.digest` AND the email master toggle. The streak reminder IS a
 * NotificationType, gated by `prefs.streakReminders` (opt-in, default off).
 */

import "server-only";
import { query } from "@/lib/db/client";
import { GSI } from "@/lib/db/table";
import { gamifyKeys } from "@/lib/db/keys";
import { resolveUserTz, isoWeekOf, mondayOfWeek } from "@/lib/gamify/time";
import { levelName } from "@/lib/gamify/levels";
import { getGamifyProfile } from "./gamify";
import { getWeekQuests } from "./gamify-quests";
import type { GamifyProfileItem, XpLedgerItem } from "@/lib/db/types";

export interface WeeklyDigest {
  isoWeek: string;
  rpThisWeek: number;
  level: number;
  levelName: string;
  streakWeeks: number;
  rainChecks: number;
  questsCompleted: number;
  openQuests: { title: string; count: number; target: number }[];
}

/** Assemble the digest for a user's current week (null when there's a no gamify profile / disabled). */
export async function buildWeeklyDigest(uid: string, now: number = Date.now()): Promise<WeeklyDigest | null> {
  const profile = await getGamifyProfile(uid);
  if (!profile || !profile.prefs.enabled) return null;

  const tz = resolveUserTz(profile.tz, undefined);
  const isoWeek = isoWeekOf(tz, now);
  const start = mondayOfWeek(isoWeek);
  const prefix = gamifyKeys.ledgerTsPrefix();
  const { items } = await query<XpLedgerItem>({
    index: GSI.byOwner,
    pk: gamifyKeys.profile(uid).pk,
    skBetween: [`${prefix}${new Date(start).toISOString()}`, `${prefix}${new Date(start + 7 * 86_400_000).toISOString()}`],
  });
  const rpThisWeek = items.reduce((sum, e) => sum + e.points, 0);
  const { active } = await getWeekQuests(uid, isoWeek);

  return {
    isoWeek,
    rpThisWeek,
    level: profile.level,
    levelName: levelName(profile.level),
    streakWeeks: profile.streakWeeks,
    rainChecks: profile.rainChecks,
    questsCompleted: active.filter((q) => q.completed).length,
    openQuests: active.filter((q) => !q.completed).map((q) => ({ title: q.title, count: q.count, target: q.target })),
  };
}

/**
 * Whether a Thursday streak reminder should fire: the reminder is opted-in
 * (`streakReminders`), gamification is on, there's a streak to protect, and the user
 * hasn't played THIS week yet. Pure — the cron reads it per user. Never uses loss-aversion
 * copy (§G2.4) — it states the fact.
 */
export function isStreakAtRisk(profile: GamifyProfileItem, now: number = Date.now()): boolean {
  if (!profile.prefs.streakReminders || !profile.prefs.enabled) return false;
  if (profile.streakWeeks <= 0) return false;
  const week = isoWeekOf(resolveUserTz(profile.tz, undefined), now);
  return profile.lastPlayedWeek !== week;
}

/** Fire the streak-at-risk notification when eligible (§G14). Returns whether it fired. */
export async function notifyStreakAtRisk(uid: string, now: number = Date.now()): Promise<boolean> {
  const profile = await getGamifyProfile(uid);
  if (!profile || !isStreakAtRisk(profile, now)) return false;
  const { notify } = await import("@/lib/notify");
  await notify(uid, {
    type: "streak_at_risk",
    title: "Your Play Streak is still open this week",
    body: "You haven't played this week yet. A check-in or a match keeps your streak going.",
    entityRef: "/account/progress",
  });
  return true;
}
