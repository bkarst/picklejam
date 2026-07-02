/**
 * noindex.ts — content-threshold / thin-content guard (PRD §14.4, §14.3-ingest).
 *
 * Organic search is goal 1, so the seeded long tail (~16K courts, ~9.7K cities)
 * MUST NOT ship doorway pages. A page below the content threshold emits
 * `noindex` until it is populated. This module is the single place that decides
 * "is this entity index-worthy?" so the court page, the `courts` sitemap
 * (`lib/seo/sitemap.ts`), and the ad-eligibility check (§2.2) all agree.
 */

import type { Metadata } from "next";
import type { CourtItem } from "@/lib/db/types";

/**
 * Minimum length of free-text description that counts as "substantive content".
 * A one-word blurb is not enough to lift a page over the threshold. // heuristic
 */
const MIN_DESCRIPTION_LENGTH = 40;

/**
 * Generic content-threshold input. Entity-specific helpers (e.g. {@link courtIsIndexable})
 * map their fields onto this shape so the heuristic lives in exactly one place.
 */
export interface ContentThresholdInput {
  /** Display name / title — a page with no name is never indexable. */
  name?: string | null;
  /** Physical courts at the venue (courts-specific; omit for non-court entities). */
  totalCourts?: number | null;
  /** A street address is a strong "this is a real place" signal. */
  address?: string | null;
  /** Free-text body copy. */
  description?: string | null;
  /** Number of attached photos. */
  photoCount?: number;
  /** Number of user reviews (UGC = content + AggregateRating rich result). */
  reviewCount?: number;
  /** Whether the entity carries a structured/free-text schedule (day-one content, N13). */
  hasSchedule?: boolean;
}

/**
 * Decide whether an entity clears the §14.4 content threshold (is index-worthy).
 *
 * Documented heuristic: the entity must have a non-empty name, at least one
 * physical court (when `totalCourts` is provided), AND at least one substantive
 * content signal — a street address, a description of {@link MIN_DESCRIPTION_LENGTH}+
 * chars, ≥1 photo, ≥1 review, or a published schedule. Otherwise it is a thin /
 * doorway page and should be `noindex` until populated.
 */
export function clearsContentThreshold(input: ContentThresholdInput): boolean {
  const name = (input.name ?? "").trim();
  if (!name) return false;

  // When a court count is supplied it must be ≥ 1 (a venue with zero courts is thin).
  if (input.totalCourts !== undefined && input.totalCourts !== null && input.totalCourts < 1) {
    return false;
  }

  const hasSubstance =
    Boolean((input.address ?? "").trim()) ||
    (input.description ?? "").trim().length >= MIN_DESCRIPTION_LENGTH ||
    (input.photoCount ?? 0) >= 1 ||
    (input.reviewCount ?? 0) >= 1 ||
    Boolean(input.hasSchedule);

  return hasSubstance;
}

/**
 * Whether a court should be indexed (and therefore appear in the `courts`
 * sitemap and be ad-eligible). Hard gates first (§3.7 / §14.3-ingest):
 * `hasPickleball && !hidden && !deleted`. If the ingest pipeline already
 * computed `indexable`, we trust it; otherwise fall back to the live heuristic.
 */
export function courtIsIndexable(court: CourtItem): boolean {
  if (!court.hasPickleball || court.hidden || court.deleted) return false;

  // Ingest may precompute the flag (§14.3-ingest); respect it when present.
  if (typeof court.indexable === "boolean") return court.indexable;

  return clearsContentThreshold({
    name: court.name,
    totalCourts: court.totalCourts,
    address: court.address,
    description: court.description,
    photoCount: court.photos?.length ?? court.photoKeys?.length ?? 0,
    reviewCount: court.reviewCount ?? 0,
    hasSchedule: (court.openPlay?.length ?? 0) > 0 || Boolean(court.scheduleDetails?.trim()),
  });
}

/**
 * The `Metadata.robots` object for a non-indexable (thin / private / utility)
 * page. Matches the shape `buildMetadata({ noindex: true })` produces.
 */
export function noindexRobots(): NonNullable<Metadata["robots"]> {
  return { index: false, follow: false };
}

/**
 * Whether a player profile is indexable (Stage 2, §6.3). Only `public` profiles
 * are crawlable; `private` and `unlisted` profiles emit `noindex` and must be
 * excluded from the players sitemap + `Person` JSON-LD.
 */
export function profileIsIndexable(user: import("@/lib/db/types").UserProfileItem): boolean {
  return user.visibility === "public";
}
