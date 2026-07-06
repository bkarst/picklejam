/**
 * view.ts — the `GET /api/gamify/me` view model (Gamification PRD §G12.0).
 *
 * Client-safe (pure): the server projects a `GamifyProfileItem` into a compact view the
 * `useMyGamify` hook consumes (level math resolved once, server-side). `enabled` folds
 * the prefs master switch AND the G18 holdout, so a suppressed viewer sees no surfaces.
 */

import type { GamifyProfileItem, GamifyPrefs } from "@/lib/db/types";
import { levelInfo } from "./levels";
import { DEFAULT_PREFS } from "./prefs";

export interface GamifyProfileView {
  rp: number;
  rpLifetime: number;
  level: number;
  levelName: string;
  /** 0–1 progress toward the next level (the ring source). */
  progress: number;
  rpToNext: number | null;
  nextThreshold: number | null;
  isMaxLevel: boolean;
  streakWeeks: number;
  streakBest: number;
  rainChecks: number;
  monthRp: number;
  showcase: string[];
}

/** A weekly quest with the caller's progress (§G9). */
export interface ActiveQuest {
  questId: string;
  slug: string;
  title: string;
  count: number;
  target: number;
  rewardRp: number;
  completed: boolean;
}

export interface GamifyMeView {
  /** Effective visibility — `prefs.enabled && !holdout`. When false, hide every surface. */
  enabled: boolean;
  holdout: boolean;
  prefs: GamifyPrefs;
  /** Null when the user has no gamify profile yet (never earned). */
  profile: GamifyProfileView | null;
  /** This week's quests (P2) — absent until a profile exists. */
  quests?: ActiveQuest[];
}

/** Project a stored profile into the compact client view. */
export function toProfileView(p: GamifyProfileItem): GamifyProfileView {
  const info = levelInfo(p.rpLevelWatermark);
  return {
    rp: Math.max(0, p.rp), // display floor (§G4.3)
    rpLifetime: p.rpLifetime,
    level: p.level,
    levelName: info.name,
    progress: info.progress,
    rpToNext: info.rpToNext,
    nextThreshold: info.nextThreshold,
    isMaxLevel: info.isMax,
    streakWeeks: p.streakWeeks,
    streakBest: p.streakBest,
    rainChecks: p.rainChecks,
    monthRp: p.monthEarn?.rp ?? 0,
    showcase: p.showcase ?? [],
  };
}

/** One badge family in the collection / trophy case (§G6.3). */
export interface BadgeCollectionEntry {
  familyId: string;
  name: string;
  behavior: string;
  flavor: string;
  /** Current tier (0 = not earned). */
  tier: number;
  tierName: string;
  awardedAt?: string;
  /** Progress toward the next tier (absent at max tier). */
  progress?: { count: number; nextThreshold: number };
}

export interface MyBadgesView {
  entries: BadgeCollectionEntry[];
  /** Pinned showcase familyIds (≤ 3). */
  showcase: string[];
  earnedCount: number;
}

/** Build the full `/me` view from an (optional) profile + holdout state. */
export function toMeView(p: GamifyProfileItem | undefined, holdout: boolean): GamifyMeView {
  const prefs = p?.prefs ?? DEFAULT_PREFS;
  return {
    enabled: prefs.enabled && !holdout,
    holdout,
    prefs,
    profile: p ? toProfileView(p) : null,
  };
}
