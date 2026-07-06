/**
 * prefs.ts — gamification preference defaults + holdout (client-safe).
 *
 * `DEFAULT_PREFS` is the shape used when no profile exists yet; it lives here (not in
 * the server-only data layer) so both the client view and the server can import it.
 */

import { hashString } from "@/lib/roundrobin/engine/shared";
import type { GamifyPrefs } from "@/lib/db/types";

/** Defaults (§G12.12): everything on except streak reminders (opt-in, §G8). */
export const DEFAULT_PREFS: GamifyPrefs = {
  enabled: true,
  streakReminders: false,
  digest: false,
  leaderboards: "public",
};

/** Share of users held out of gamification for the G18 retention read. */
export const HOLDOUT_PERCENT = 10;

/**
 * Whether a user is in the G18 retention holdout (sees no surfaces; RP accrues silently).
 * Resolved SERVER-side. A deterministic, stable per-uid 10% bucket — OFF by default
 * (`GAMIFY_HOLDOUT_ENABLED` unset) since the app is pre-release (§G13.8: no cohort yet).
 * When the retention experiment launches, set `GAMIFY_HOLDOUT_ENABLED=1`; the bucketing
 * can later be swapped for a PostHog-managed flag without changing callers.
 */
export function resolveHoldout(uid: string): boolean {
  if (process.env.GAMIFY_HOLDOUT_ENABLED !== "1") return false;
  return hashString(uid) % 100 < HOLDOUT_PERCENT;
}
