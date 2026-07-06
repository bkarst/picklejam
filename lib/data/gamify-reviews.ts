/**
 * gamify-reviews.ts — hydrate review-card author chips (§G12.16). Joins a court's review
 * uids to public profiles + gamify level + this-court Crew membership, so a public reviewer's
 * card shows their name · `LevelChip` · `Crew` pill (local B2 credibility). Non-public
 * reviewers stay anonymous ("Player", no chips). The Crew marker respects `checkinVisibility`
 * (it's check-in-derived, §G6.2) — a check-in-private user is never outed as Crew.
 */

import "server-only";
import { batchGet } from "@/lib/db/client";
import { userKeys, gamifyKeys } from "@/lib/db/keys";
import { getCrewUids } from "./gamify-crew";
import type { UserProfileItem, GamifyProfileItem, ReviewItem } from "@/lib/db/types";

export interface ReviewAuthorData {
  name?: string;
  avatarUrl?: string;
  level?: number;
  isCrew?: boolean;
  isElite?: boolean;
}

/** Author-chip data keyed by uid for a court's reviews (public reviewers only). */
export async function hydrateReviewAuthors(
  courtId: string,
  reviews: Pick<ReviewItem, "uid">[],
  month: string,
): Promise<Record<string, ReviewAuthorData>> {
  const uids = [...new Set(reviews.map((r) => r.uid).filter(Boolean))];
  if (uids.length === 0) return {};

  const [users, gamifies, crew] = await Promise.all([
    batchGet<UserProfileItem>(uids.map((u) => userKeys.profile(u))),
    batchGet<GamifyProfileItem>(uids.map((u) => gamifyKeys.profile(u))),
    getCrewUids(courtId, month),
  ]);
  const userBy = new Map(users.map((u) => [u.uid, u]));
  const gamifyBy = new Map(gamifies.map((g) => [g.uid, g]));

  const out: Record<string, ReviewAuthorData> = {};
  for (const uid of uids) {
    const u = userBy.get(uid);
    if (!u || u.visibility !== "public") continue; // stays "Player" — no name, no chips
    const g = gamifyBy.get(uid);
    out[uid] = {
      name: u.displayName,
      ...(u.avatarUrl ? { avatarUrl: u.avatarUrl } : {}),
      ...(g ? { level: g.level } : {}),
      isCrew: crew.has(uid) && u.checkinVisibility !== "private",
      isElite: (g?.eliteYears?.length ?? 0) > 0,
    };
  }
  return out;
}
