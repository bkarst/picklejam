/**
 * gamify-notify.ts — the post-commit analytics + notification effects for an award
 * (Gamification PRD §G14/§G15). Fire-and-forget and FAILURE-ISOLATED: it never throws,
 * so a broken analytics capture or notification write can't fail the awarding write.
 *
 * `notify` (Resend + user profile) is imported DYNAMICALLY to avoid a static import
 * cycle with the data layer, and only when a level-up actually fires.
 */

import { trackServerEvent } from "@/lib/analytics/server";
import { gamifyCopy } from "@/lib/gamify/copy";
import type { AwardXpResult } from "./gamify";

export async function fireGamifyAwardEffects(result: AwardXpResult): Promise<void> {
  try {
    const uid = result.profile.uid;

    // ⚙ ANALYTICS — always fire-and-forget, regardless of prefs (§G15).
    for (const a of result.awards) trackServerEvent(uid, "xp_awarded", { rule: a.rule, points: a.points });
    if (result.levelUp) trackServerEvent(uid, "level_up", { level: result.levelUp.level });
    for (const b of result.badges ?? []) trackServerEvent(uid, "badge_awarded", { familyId: b.familyId, tier: b.tier });

    // NOTIFICATIONS — silenced when the gamify master switch is off (§G14).
    const hasNotif = result.levelUp || (result.badges?.length ?? 0) > 0;
    if (result.profile.prefs.enabled && hasNotif) {
      const { notify } = await import("@/lib/notify");
      if (result.levelUp) {
        await notify(uid, {
          type: "level_up",
          title: gamifyCopy.levelUp(result.levelUp.level, result.levelUp.name),
          body: `You reached Level ${result.levelUp.level} — ${result.levelUp.name}. Keep playing to climb higher.`,
          entityRef: "/account/progress",
        });
      }
      for (const b of result.badges ?? []) {
        await notify(uid, {
          type: "badge_awarded",
          title: gamifyCopy.badgeToast(b.name, b.tierName),
          body: `You earned the ${b.name} — ${b.tierName} badge.`,
          entityRef: "/account/badges",
        });
      }
    }
  } catch (err) {
    console.error("[gamify] award effects failed (isolated — award unaffected):", err);
  }
}
