/**
 * reviews.ts — court reviews (PRD §6.4, §9.5 #4).
 *
 * ONE review per user per court, EDITABLE. We key each review at the STABLE
 * `courtKeys.reviewByUser` SK (`REVIEW#<uid>`) so a re-review overwrites the same
 * item instead of creating a duplicate row — a `GetItem` reads the caller's review
 * and a `Put` upserts it. Recency lives in a `createdAt` attribute (the SK is
 * uid-ordered, not time-ordered), so the read layer sorts:
 *   #4 a court's reviews → base table `COURT#id` / `begins_with(REVIEW#)`, sorted
 *   my reviews          → GSI1 `USER#uid` / `begins_with(REVIEW#)`, `createdTs`-ordered
 *
 * Writes emit INSERT/MODIFY/REMOVE so the §9.4 court aggregates (`reviewCount`,
 * `ratingSum` → `ratingAvg`) reconcile without this layer computing them.
 */

import { getItem, query, queryAll, putItem, putItemReturningOld, deleteItem } from "@/lib/db/client";
import { GSI } from "@/lib/db/table";
import { courtKeys, userKeys } from "@/lib/db/keys";
import { emitInsert, emitModify, emitRemove } from "@/lib/streams/inline";
import { getMyCheckins } from "@/lib/data/checkins";
import type { ReviewItem } from "@/lib/db/types";

export type ReviewSort = "recent" | "helpful";

function byRecent(a: ReviewItem, b: ReviewItem): number {
  return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
}

function byHelpful(a: ReviewItem, b: ReviewItem): number {
  return (b.helpfulCount ?? 0) - (a.helpfulCount ?? 0) || byRecent(a, b);
}

/**
 * #4 — a court's reviews, ordered in the read layer. `sort:"helpful"` ranks by
 * `helpfulCount` (ties broken by recency); default is newest-first.
 *
 * The review SK is `REVIEW#<uid>` (uid-lexicographic), NOT time-ordered — so a keyed
 * `limit` returns the lowest-uid reviews, and sorting THAT truncated page would make
 * the actual newest / most-helpful reviews (whose uids happen to sort high) permanently
 * invisible. Reviews per court are bounded, so read the FULL set, sort, THEN slice.
 */
export async function getCourtReviews(
  courtId: string,
  opts?: { sort?: ReviewSort; limit?: number },
): Promise<{ items: ReviewItem[] }> {
  const all = await queryAll<ReviewItem>({
    pk: courtKeys.meta(courtId).pk,
    skBeginsWith: courtKeys.reviewPrefix(),
  });
  all.sort(opts?.sort === "helpful" ? byHelpful : byRecent);
  return { items: opts?.limit ? all.slice(0, opts.limit) : all };
}

/** A user's reviews, newest-first (one Query on GSI1). */
export async function getMyReviews(uid: string): Promise<ReviewItem[]> {
  const { items } = await query<ReviewItem>({
    index: GSI.byOwner,
    pk: userKeys.profile(uid).pk,
    skBeginsWith: courtKeys.reviewPrefix(),
    ascending: false,
  });
  return items;
}

/** The caller's single review for a court (GetItem on the stable per-user key). */
export async function getUserReviewForCourt(
  uid: string,
  courtId: string,
): Promise<ReviewItem | undefined> {
  return getItem<ReviewItem>(courtKeys.reviewByUser(courtId, uid));
}

export interface UpsertReviewInput {
  courtId: string;
  uid: string;
  rating1to5: number;
  title?: string;
  body?: string;
  tags?: string[];
  photoUrl?: string;
}

/**
 * Create or edit the caller's review (one-per-user). Preserves the original
 * `createdAt` (and `helpfulCount`) across edits, recomputes `checkinVerified` from
 * the user's check-ins (§6.4 badge), and emits INSERT (first) / MODIFY (edit) so
 * `reviewCount`/`ratingAvg` reconcile.
 */
export async function upsertReview(input: UpsertReviewInput): Promise<ReviewItem> {
  const existing = await getUserReviewForCourt(input.uid, input.courtId);
  const now = new Date().toISOString();
  const createdAt = existing?.createdAt ?? now;

  const myCheckins = await getMyCheckins(input.uid);
  const checkinVerified = myCheckins.some((c) => c.courtId === input.courtId);

  const item: ReviewItem = {
    ...courtKeys.reviewByUser(input.courtId, input.uid, createdAt),
    entity: "REVIEW",
    courtId: input.courtId,
    uid: input.uid,
    rating1to5: input.rating1to5,
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.body !== undefined ? { body: input.body } : {}),
    ...(input.tags !== undefined ? { tags: input.tags } : {}),
    ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl } : {}),
    helpfulCount: existing?.helpfulCount ?? 0,
    checkinVerified,
    createdAt,
    updatedAt: now,
  };

  // Emit from the ATOMIC prior image, not the pre-read `existing` (L10). Two concurrent edits
  // both read rating 3 and both wrote rating 5 would each `emitModify(3→5)` → ratingSum +4 for
  // a single +2 change; two concurrent first-reviews would each `emitInsert` → reviewCount +2.
  // `ALL_OLD` returns the true committed prior (or undefined), so the winner emits the real
  // delta and the loser a no-op MODIFY(5→5) — exactly what real DynamoDB Streams would deliver.
  const prior = await putItemReturningOld(item as unknown as Record<string, unknown>);
  if (prior) {
    await emitModify(prior, item as unknown as Record<string, unknown>);
  } else {
    await emitInsert(item as unknown as Record<string, unknown>);
  }
  return item;
}

/** Delete the caller's review for a court (idempotent); emits REMOVE if one existed. */
export async function deleteReview(courtId: string, uid: string): Promise<void> {
  const existing = await getUserReviewForCourt(uid, courtId);
  if (!existing) return;
  await deleteItem(courtKeys.reviewByUser(courtId, uid));
  await emitRemove(existing as unknown as Record<string, unknown>);
}
