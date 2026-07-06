/**
 * gamify-streak.ts — Play-Streak crediting (Gamification PRD §G8, wiring the built G8.2
 * machine). `creditPlayedWeek` runs `resolveStreak` + `applyPlay` for the user's current
 * ISO week, persists the streak state RACE-SAFELY (a conditional write keyed on
 * `lastPlayedWeek`, so only the first play of a week credits), emits the streak analytics,
 * and pays the E28 milestone. Failure-isolated: it never throws.
 *
 * Called at play-confirmation points (check-in E1, confirmed match E11/E14/E16, attended
 * outing E19). The E28 award runs AFTER the streakBest write, so `awardXp`'s badge pass
 * sees the new `streakBest` and upgrades the Streaker family.
 */

import "server-only";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { updateItem } from "@/lib/db/client";
import { gamifyKeys } from "@/lib/db/keys";
import { trackServerEvent } from "@/lib/analytics/server";
import { resolveStreak, applyPlay, type StreakState } from "@/lib/gamify/streak";
import { resolveUserTz, isoWeekOf } from "@/lib/gamify/time";
import { getGamifyProfile, awardXpSafe } from "./gamify";
import type { StreakMilestone } from "@/lib/gamify/streak";

export interface StreakCreditResult {
  weeks: number;
  /** True only on the FIRST play of the current week (drives the check-in tick). */
  firstOfWeek: boolean;
  outcome: "noop" | "extend" | "repair" | "start";
  milestone?: StreakMilestone;
}

/** Persist the streak state — conditional on `lastPlayedWeek` so only the first play writes. */
async function writeStreakState(uid: string, s: StreakState, nowWeek: string): Promise<boolean> {
  const iso = new Date().toISOString();
  const sets = [
    "streakWeeks = :sw",
    "streakBest = :sb",
    "rainChecks = :rc",
    "lastPlayedWeek = :lpw",
    "coveredWeek = :cw",
    "updatedAt = :now",
  ];
  const removes: string[] = [];
  const values: Record<string, unknown> = {
    ":sw": s.streakWeeks,
    ":sb": s.streakBest,
    ":rc": s.rainChecks,
    ":lpw": s.lastPlayedWeek,
    ":cw": s.coveredWeek,
    ":now": iso,
    ":w": nowWeek,
  };
  const optional: [keyof StreakState, string, string][] = [
    ["streakPrev", "streakPrev = :sp", ":sp"],
    ["brokenAtWeek", "brokenAtWeek = :baw", ":baw"],
    ["lastRepairWeek", "lastRepairWeek = :lrw", ":lrw"],
  ];
  for (const [field, setExpr, valKey] of optional) {
    const v = s[field];
    if (v !== undefined) {
      sets.push(setExpr);
      values[valKey] = v;
    } else {
      removes.push(field);
    }
  }
  const update = `SET ${sets.join(", ")}${removes.length ? ` REMOVE ${removes.join(", ")}` : ""}`;
  try {
    await updateItem({
      key: gamifyKeys.profile(uid),
      update,
      condition: "attribute_not_exists(lastPlayedWeek) OR lastPlayedWeek <> :w",
      values,
    });
    return true;
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) return false; // concurrent play won
    throw err;
  }
}

/** Credit a played week for `uid`. Returns the streak info (for the piggyback) or null. */
export async function creditPlayedWeek(
  uid: string,
  now: number = Date.now(),
  homeCityTz?: string,
): Promise<StreakCreditResult | null> {
  try {
    const profile = await getGamifyProfile(uid);
    if (!profile) return null;
    const tz = resolveUserTz(profile.tz, homeCityTz);
    const nowWeek = isoWeekOf(tz, now);

    if (profile.lastPlayedWeek === nowWeek) {
      return { weeks: profile.streakWeeks, firstOfWeek: false, outcome: "noop" };
    }

    const state: StreakState = {
      streakWeeks: profile.streakWeeks,
      streakBest: profile.streakBest,
      streakPrev: profile.streakPrev,
      lastPlayedWeek: profile.lastPlayedWeek,
      coveredWeek: profile.coveredWeek,
      brokenAtWeek: profile.brokenAtWeek,
      lastRepairWeek: profile.lastRepairWeek,
      rainChecks: profile.rainChecks,
    };
    const resolved = resolveStreak(state, nowWeek);
    const broke = state.streakWeeks > 0 && resolved.streakWeeks === 0;
    const { state: next, outcome, milestone } = applyPlay(resolved, nowWeek);

    const written = await writeStreakState(uid, next, nowWeek);
    if (!written) {
      return { weeks: next.streakWeeks, firstOfWeek: false, outcome: "noop" };
    }

    // Analytics (§G15) — fire-and-forget.
    if (broke) trackServerEvent(uid, "streak_broken", {});
    if (outcome === "repair") trackServerEvent(uid, "streak_repaired", { weeks: next.streakWeeks });
    else trackServerEvent(uid, "streak_extended", { weeks: next.streakWeeks });

    // E28 milestone — once ever per rung (sourceKey); runs after the streakBest write so
    // the awardXp badge pass upgrades the Streaker family from the new streakBest.
    if (milestone) {
      await awardXpSafe({
        uid,
        earns: [
          {
            rule: "E28",
            source: { rule: "E28", milestone },
            ctx: { streakMilestone: milestone },
            label: `${milestone}-week Play Streak`,
          },
        ],
        now,
      });
    }

    return { weeks: next.streakWeeks, firstOfWeek: true, outcome, ...(milestone ? { milestone } : {}) };
  } catch (err) {
    console.error("[gamify] streak credit failed (isolated):", err);
    return null;
  }
}
