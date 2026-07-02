/**
 * follows.ts — court follows (PRD §6.1, §9.4 fan-out).
 *
 * A follow is a single row `USER#uid` / `FOLLOW#COURT#<courtId>` whose GSI1
 * projection (`COURT#courtId` / `FOLLOWER#<uid>`) lets us list a court's followers
 * for Stage 4 notification fan-out. Two reads, one Query each:
 *   my followed courts → base table `USER#uid` / `begins_with(FOLLOW#COURT#)`
 *   a court's followers → GSI1 `COURT#courtId` / `begins_with(FOLLOWER#)`
 *
 * Follows are idempotent (double-follow is a no-op) and copy nothing sensitive.
 */

import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { getItem, query, putNew, deleteItem } from "@/lib/db/client";
import { GSI } from "@/lib/db/table";
import { SEP, userKeys } from "@/lib/db/keys";
import type { FollowItem } from "@/lib/db/types";

/** Follow a court (idempotent: a repeat follow succeeds without duplicating). */
export async function followCourt(uid: string, courtId: string): Promise<FollowItem> {
  const item: FollowItem = {
    ...userKeys.followCourt(uid, courtId),
    entity: "FOLLOW",
    uid,
    courtId,
    createdAt: new Date().toISOString(),
  };
  try {
    await putNew(item as unknown as Record<string, unknown>);
  } catch (err) {
    // Already following — treat as success (idempotent).
    if (!(err instanceof ConditionalCheckFailedException)) throw err;
  }
  return item;
}

/** Unfollow a court (idempotent). */
export async function unfollowCourt(uid: string, courtId: string): Promise<void> {
  await deleteItem(userKeys.followCourt(uid, courtId));
}

/** Whether the user currently follows the court (GetItem). */
export async function isFollowing(uid: string, courtId: string): Promise<boolean> {
  return Boolean(await getItem<FollowItem>(userKeys.followCourt(uid, courtId)));
}

/** The courts a user follows (one Query on the base table). */
export async function getFollowedCourts(uid: string): Promise<FollowItem[]> {
  const { items } = await query<FollowItem>({
    pk: userKeys.profile(uid).pk,
    skBeginsWith: `FOLLOW${SEP}COURT${SEP}`,
  });
  return items;
}

/** A court's follower uids (one Query on GSI1) — Stage 4 notification fan-out. */
export async function getCourtFollowers(courtId: string): Promise<string[]> {
  const { items } = await query<FollowItem>({
    index: GSI.byOwner,
    pk: `COURT${SEP}${courtId}`,
    skBeginsWith: `FOLLOWER${SEP}`,
  });
  return items.map((f) => f.uid);
}
