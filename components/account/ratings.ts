/**
 * ratings.ts — pure rating helpers shared by the public profile page (server) and
 * the account editor (client). No server imports, so it is safe in both contexts.
 *
 * A player carries up to one rating per system (§9.3). DUPR is verified via the
 * read-only DUPR connection (no score submit); the other systems are self-entered.
 */

import type { RatingItem, RatingSystem } from "@/lib/db/types";

/** The five rating systems, in default-preference order (verified DUPR first). */
export const ALL_RATING_SYSTEMS: readonly RatingSystem[] = [
  "DUPR",
  "UTRP",
  "WPR",
  "CTPR",
  "SELF",
];

/** Systems a player can self-enter (DUPR is connect-only). */
export const SELF_ENTERABLE_SYSTEMS: readonly RatingSystem[] = ["UTRP", "WPR", "CTPR", "SELF"];

/** Human labels for each system (DUPR/UTR-P/WPR/CTPR/Self). */
export const RATING_LABELS: Record<RatingSystem, string> = {
  DUPR: "DUPR",
  UTRP: "UTR-P",
  WPR: "WPR",
  CTPR: "CTPR",
  SELF: "Self",
};

/** A short description of what each system is, for the ratings panel. */
export const RATING_BLURBS: Record<RatingSystem, string> = {
  DUPR: "Dynamic Universal Pickleball Rating",
  UTRP: "Universal Tennis Pickleball Rating",
  WPR: "World Pickleball Rating",
  CTPR: "Club / self-tracked rating",
  SELF: "Your own honest estimate",
};

/** Format a rating value for display (e.g. 3.74 → "3.74", 5.2 → "5.2", 3 → "3.0"). */
export function formatRatingValue(value: number): string {
  return Number.isInteger(value) ? value.toFixed(1) : String(value);
}

/**
 * A 1.0-wide skill band label for a rating value (design 6.1: "3.0 – 3.99").
 * Returns `undefined` when there is no value to band.
 */
export function skillBand(value: number | undefined): string | undefined {
  if (value === undefined || Number.isNaN(value)) return undefined;
  const lo = Math.floor(value);
  return `${lo.toFixed(1)} – ${(lo + 0.99).toFixed(2)}`;
}

/**
 * Pick the rating that should headline a profile: the user's default source if
 * present, else the first verified rating, else the first rating.
 */
export function primaryRating(
  ratings: RatingItem[],
  defaultSource?: RatingSystem,
): RatingItem | undefined {
  if (ratings.length === 0) return undefined;
  if (defaultSource) {
    const match = ratings.find((r) => r.system === defaultSource);
    if (match) return match;
  }
  return ratings.find((r) => r.verified) ?? ratings[0];
}

/** Order a set of ratings by the canonical system order for display. */
export function sortRatings(ratings: RatingItem[]): RatingItem[] {
  return [...ratings].sort(
    (a, b) => ALL_RATING_SYSTEMS.indexOf(a.system) - ALL_RATING_SYSTEMS.indexOf(b.system),
  );
}

/** Validate a self-entered rating value (positive, within a sane pickleball range). */
export function isValidRatingValue(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= 8;
}
