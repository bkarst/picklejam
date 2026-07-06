/**
 * copy.ts — canonical gamification strings (Gamification PRD §G12.22).
 *
 * One import site, no scattered literals (EN-only at launch). Voice: playful but not
 * childish; celebrate the PLAYER, never the app; state facts, never guilt (a lapse is
 * "streak ended", not "you lost your streak"); a number always names what earned it.
 */

export const gamifyCopy = {
  /** `+{n} RP · {label}`. */
  xpToast: (n: number, label: string): string => `+${n} RP · ${label}`,
  /** Coalesced form: `+{n} RP · {firstLabel} +{k} more`. */
  xpToastCoalesced: (n: number, firstLabel: string, more: number): string =>
    `+${n} RP · ${firstLabel} +${more} more`,
  capReached: "Daily Rally Point limit reached — this check-in still counts.",
  streakTick: (n: number): string => `Week ${n} of your play streak ✓`,
  rainCheckSpent: "Rain Check used — streak safe 🌧",
  streakEnded: (n: number): string => `Streak ended at ${n} weeks. Play this week to repair it.`,
  streakRepaired: (n: number): string => `Streak repaired — back to ${n} weeks 💪`,
  levelUp: (n: number, name: string): string => `Level ${n} — ${name}!`,
  badgeToast: (family: string, tier: string): string => `🏅 ${family} — ${tier}`,
  crewProgress: (x: number): string => `${x} of 4 check-ins this month`,
  crewEmpty: "No Crew yet — 4 check-ins in a month makes you Crew of this court.",
  boardEmpty: "Be the first on the board — check in.",
  questsAllDone: "All quests done — new ones Monday 🎉",
  groupBoardEmpty: "No Rally Points yet this month — first outing wins it.",
  rsvpExpectation: "Rally Points land after the game happens.",
  gamificationOffHelper:
    "Hides points, badges, quests, and streaks everywhere. You'll keep earning silently, so nothing is lost if you turn it back on.",
} as const;

export type GamifyCopy = typeof gamifyCopy;
