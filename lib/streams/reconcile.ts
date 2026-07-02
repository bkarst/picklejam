/**
 * reconcile.ts — the periodic reconcile / repair sweep (PRD §9.1, Stage 0.5).
 *
 * The Streams aggregator (`aggregator.ts`) keeps §9.4 aggregates hot with atomic
 * counter deltas, which converge but are NOT exactly-once (a duplicated or dropped
 * record leaves residual drift). This module is the ground-truth corrector: each
 * function RECOMPUTES an aggregate from its SOURCE items and overwrites the stored
 * value. Every recompute is a SINGLE-PARTITION `Query` (pk + `begins_with(sk, …)`)
 * — never a scan (§9.6) — and is fully idempotent (running it twice is a no-op).
 *
 * Run it on a schedule and/or after a suspected stream outage. It is safe to run
 * concurrently with live traffic: it does a last-writer-wins SET, so it may briefly
 * lag a racing write, but the next sweep re-converges.
 */

import "server-only";
import { query, updateItem } from "@/lib/db/client";
import { courtKeys, groupKeys } from "@/lib/db/keys";

// ── COURT reviews: reviewCount + ratingSum + ratingAvg ───────────────────────

interface ReviewRow {
  rating1to5?: number;
}

export interface CourtReviewAggregate {
  reviewCount: number;
  ratingSum: number;
  ratingAvg: number;
}

/**
 * Recompute a court's review aggregates from all its `REVIEW#` items and write the
 * corrected `reviewCount` / `ratingSum` / `ratingAvg` onto `COURT#<id>/META`.
 */
export async function reconcileCourtReviews(courtId: string): Promise<CourtReviewAggregate> {
  const { pk } = courtKeys.meta(courtId);
  let startKey: Record<string, unknown> | undefined;
  let reviewCount = 0;
  let ratingSum = 0;
  do {
    const res = await query<ReviewRow>({
      pk,
      skBeginsWith: courtKeys.reviewPrefix(),
      startKey,
    });
    for (const r of res.items) {
      if (typeof r.rating1to5 === "number") {
        reviewCount += 1;
        ratingSum += r.rating1to5;
      }
    }
    startKey = res.lastKey;
  } while (startKey);

  const ratingAvg = reviewCount > 0 ? ratingSum / reviewCount : 0;
  await updateItem({
    key: courtKeys.meta(courtId),
    update: "SET reviewCount = :c, ratingSum = :s, ratingAvg = :a",
    values: { ":c": reviewCount, ":s": ratingSum, ":a": ratingAvg },
  });
  return { reviewCount, ratingSum, ratingAvg };
}

// ── GROUP membership: memberCount ────────────────────────────────────────────

interface MemberRow {
  status?: string;
}

/**
 * Recompute a group's `memberCount` from its `MEMBER#` items and write it onto
 * `GROUP#<id>/META`. Counts EVERY membership row, matching the aggregator's
 * insert/remove ±1 semantics. If a future stage decides `memberCount` should track
 * only `status === 'active'` members, BOTH this recompute and the aggregator's
 * MEMBER handler must adopt the same filter so the sweep doesn't fight the stream.
 */
export async function reconcileGroupMemberCount(groupId: string): Promise<number> {
  const { pk } = groupKeys.meta(groupId);
  let startKey: Record<string, unknown> | undefined;
  let memberCount = 0;
  do {
    const res = await query<MemberRow>({
      pk,
      skBeginsWith: groupKeys.memberPrefix(),
      startKey,
    });
    memberCount += res.items.length;
    startKey = res.lastKey;
  } while (startKey);

  await updateItem({
    key: groupKeys.meta(groupId),
    update: "SET memberCount = :c",
    values: { ":c": memberCount },
  });
  return memberCount;
}

// ── Orphaned composite-write heal (STUB) ─────────────────────────────────────

export interface OrphanHealReport {
  /** How many candidate partitions the sweep inspected. */
  scanned: number;
  /** How many orphaned references it repaired. */
  healed: number;
  /** Human-readable notes on what was fixed (one per heal). */
  details: string[];
}

/**
 * STUB — the composite-write orphan-heal sweep (§9.1, N15).
 *
 * Multi-item creates are written with `TransactWriteItems` so they're all-or-nothing
 * (outing + `OUTINGREF` [+ `SERIES`/`MEETUP`]; group + creator `MEMBER` + `COURT#→GROUP#`
 * pointers; registration + `Payment` + counter). A partial failure or an out-of-band
 * delete can still leave a dangling reference — e.g. an `OUTING#/META` whose
 * `COURT#/OUTING#…` pointer is missing (so the outing never shows under "games at a
 * court", §9.5 #9), or a `MEMBER#` whose reciprocal `GSI1 GROUPMEMBER#` projection
 * drifted. The real sweep will walk each entity's expected companion items and
 * re-create or delete to restore the invariant (asserted in §14.6).
 *
 * Left as a typed placeholder: the full implementation lands in Stage 4 (outings)
 * and Stage 8 (integrity hardening). Returns an empty, no-op report today.
 */
export async function reconcileOrphans(): Promise<OrphanHealReport> {
  // Intentionally a no-op until Stage 4/8. Must remain query-based (never a scan)
  // when implemented — walk each source partition and repair its companion items.
  return { scanned: 0, healed: 0, details: [] };
}
