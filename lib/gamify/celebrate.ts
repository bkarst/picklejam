/**
 * celebrate.ts — classify an award block into an "elaborate" celebration moment
 * (Gamification PRD §G12.18 / §G7.3). Client-safe, pure (no I/O, unit-testable).
 *
 * Two-tier reward feedback:
 *  • EVERY earn → a quick RP toast flourish (handled in GamifyToaster).
 *  • First-times + milestones → the elaborate {@link RewardCelebration} overlay.
 *
 * A block is "elaborate" when it carries a level-up, a badge, a completed quest, or a
 * once-ever first-time award. Priority (one celebration per moment): level > badge >
 * first-time > quest.
 */

import type { GamifyBlock } from "./block";

/**
 * Earn rules that mark a once-ever / first-time milestone (see lib/gamify/earn-rules):
 *  E4 Trailblazer (platform-first check-in), E5 first review, E24 welcome bonus,
 *  E25 starter step (first check-in / profile / follow). Routine earns (E1, E2, …) don't.
 */
const FIRST_TIME_RULES: Record<string, { title: string; subtitle: string }> = {
  E4: { title: "Trailblazer!", subtitle: "First-ever check-in at this court" },
  E5: { title: "First review!", subtitle: "Thanks for helping the community" },
  E24: { title: "Welcome!", subtitle: "Your PickleLoko journey begins" },
  E25: { title: "First check-in!", subtitle: "You're on the board" },
};

export type CelebrationKind = "level" | "badge" | "first" | "quest";

export interface Celebration {
  kind: CelebrationKind;
  title: string;
  subtitle: string;
  /** RP awarded in this moment — powers the count-up. */
  rp: number;
  /** Level-up art. */
  level?: number;
  /** Badge art. */
  badge?: { familyId: string; tier: number; name: string };
}

/**
 * The single most significant elaborate celebration in a block, or `null` for a routine
 * earn (which gets only the quick toast). One moment ⇒ one celebration.
 */
export function elaborateCelebration(block: GamifyBlock): Celebration | null {
  if (block.levelUp) {
    return {
      kind: "level",
      title: `Level ${block.levelUp.level}`,
      subtitle: `${block.levelUp.name}!`,
      rp: block.total,
      level: block.levelUp.level,
    };
  }
  const badge = block.badges?.[0];
  if (badge) {
    return {
      kind: "badge",
      title: badge.name,
      subtitle: `Tier ${badge.tier} unlocked`,
      rp: block.total,
      badge,
    };
  }
  const firstAward = block.awards.find((a) => a.rule in FIRST_TIME_RULES);
  if (firstAward) {
    const copy = FIRST_TIME_RULES[firstAward.rule];
    return { kind: "first", title: copy.title, subtitle: copy.subtitle, rp: block.total };
  }
  const quest = block.quests?.find((q) => q.completed);
  if (quest) {
    return { kind: "quest", title: "Quest complete!", subtitle: quest.title, rp: quest.rewardRp };
  }
  return null;
}
