// Aggregates must apply inline (no real Streams over DynamoDB Local). Set before
// the data layer runs any emit* (inline.ts reads this env at call time).
process.env.STREAMS_INLINE = "1";

import { describe, it, expect, beforeAll } from "vitest";
import { getItem, putItem } from "@/lib/db/client";
import { courtKeys, geoKeys } from "@/lib/db/keys";
import {
  createCheckin,
  getCourtCheckinsToday,
  getMyCheckins,
} from "@/lib/data/checkins";
import {
  upsertReview,
  getCourtReviews,
  getUserReviewForCourt,
  getMyReviews,
} from "@/lib/data/reviews";
import {
  followCourt,
  unfollowCourt,
  isFollowing,
  getFollowedCourts,
  getCourtFollowers,
} from "@/lib/data/follows";
import { issueAnonToken, getAnonToken } from "@/lib/data/anon";
import type { CourtItem, CityDayItem } from "@/lib/db/types";

/**
 * Stage 3 community data + Streams wiring against DynamoDB Local (§6.2/§6.4/§9.5
 * #4/#5/#6). Skipped without DYNAMODB_ENDPOINT. Parallel-safe + re-runnable: a
 * synthetic court + per-run cityKey/uids isolate every counter, and putItem in
 * beforeAll overwrites the court so its aggregate attrs reset to 0 each run.
 */
const d = process.env.DYNAMODB_ENDPOINT ? describe : describe.skip;

const RUN = Math.random().toString(36).slice(2, 8);
const COURT_ID = `court-citest-${RUN}`;
const CITY_KEY = `zz#citest#${RUN}`;
const uid1 = `citest-${RUN}-1`;
const uid2 = `citest-${RUN}-2`;
const TODAY = "20260701";
const YESTERDAY = "20260630";

async function court(): Promise<(CourtItem & { ratingSum?: number }) | undefined> {
  return getItem<CourtItem & { ratingSum?: number }>(courtKeys.meta(COURT_ID));
}

d("community data + streams wiring (DynamoDB Local)", () => {
  beforeAll(async () => {
    await putItem({
      ...courtKeys.meta(COURT_ID),
      entity: "COURT",
      courtId: COURT_ID,
      name: "Community Test Court",
      slug: "community-test-court",
      cityKey: CITY_KEY,
      lat: 0,
      lng: 0,
      geohash: "000000000",
      totalCourts: 4,
      hasPickleball: true,
    });
  });

  it("#5/#6 check-in insert → court + CITYDAY + playerCount; one Query each", async () => {
    const ci = await createCheckin({ courtId: COURT_ID, uid: uid1, anonymous: false, day: TODAY });

    const c = await court();
    expect(c?.checkinsTodayCount).toBe(1);
    expect(c?.playerCount).toBe(1);

    const cd = await getItem<CityDayItem>(geoKeys.cityDay(CITY_KEY, TODAY));
    expect(cd?.checkinsCount).toBe(1);
    expect(cd?.playerCount).toBe(1);

    const today = await getCourtCheckinsToday(COURT_ID, TODAY); // #5
    expect(today.map((x) => x.sk)).toContain(ci.sk);

    const mine = await getMyCheckins(uid1); // #6
    expect(mine.map((x) => x.sk)).toContain(ci.sk);
  });

  it("anonymous check-in stores no uid; bumps check-ins but not playerCount", async () => {
    const anon = await createCheckin({ courtId: COURT_ID, uid: null, anonymous: true, day: TODAY });
    expect(anon.anonymous).toBe(true);
    expect("uid" in anon).toBe(false);
    expect(anon.gsi1pk).toBeUndefined();

    const c = await court();
    expect(c?.checkinsTodayCount).toBe(2); // both today's check-ins counted
    expect(c?.playerCount).toBe(1); // anon contributes no player
  });

  it("check-in recency: a prior-day check-in is absent from today but durable in my check-ins", async () => {
    const past = await createCheckin({
      courtId: COURT_ID,
      uid: uid1,
      anonymous: false,
      day: YESTERDAY,
    });

    const today = await getCourtCheckinsToday(COURT_ID, TODAY);
    expect(today.map((x) => x.sk)).not.toContain(past.sk); // filtered out of "today"
    expect(today.every((x) => x.checkinDay === TODAY)).toBe(true);

    const mine = await getMyCheckins(uid1);
    expect(mine.map((x) => x.sk)).toContain(past.sk); // still durable
  });

  it("#4 review insert → ratingAvg/reviewCount; one-per-user edit doesn't duplicate", async () => {
    await upsertReview({ courtId: COURT_ID, uid: uid2, rating1to5: 4 });

    let reviews = await getCourtReviews(COURT_ID); // #4
    expect(reviews.items).toHaveLength(1);
    let c = await court();
    expect(c?.reviewCount).toBe(1);
    expect(c?.ratingAvg).toBe(4);

    const first = await getUserReviewForCourt(uid2, COURT_ID);
    expect(first?.checkinVerified).toBe(false); // uid2 never checked in here

    // Edit (same user) → overwrites the same row, count unchanged, avg follows.
    await upsertReview({ courtId: COURT_ID, uid: uid2, rating1to5: 2 });
    reviews = await getCourtReviews(COURT_ID);
    expect(reviews.items).toHaveLength(1);
    c = await court();
    expect(c?.reviewCount).toBe(1);
    expect(c?.ratingAvg).toBe(2);

    expect((await getUserReviewForCourt(uid2, COURT_ID))?.rating1to5).toBe(2);
    expect((await getMyReviews(uid2)).map((r) => r.courtId)).toContain(COURT_ID);
  });

  it("M3: #4 returns the NEWEST reviews even when their uid sorts high (sort BEFORE limit)", async () => {
    const courtId = `court-m3-${RUN}`;
    // Oldest review, LOW-sorting uid → first by the `REVIEW#<uid>` sort key.
    await putItem({
      ...courtKeys.reviewByUser(courtId, "aaa", "2020-01-01T00:00:00.000Z"),
      entity: "REVIEW",
      courtId,
      uid: "aaa",
      rating1to5: 3,
      helpfulCount: 0,
      createdAt: "2020-01-01T00:00:00.000Z",
      updatedAt: "2020-01-01T00:00:00.000Z",
    });
    // NEWEST review, HIGH-sorting uid → LAST by sort key (the one the old bug dropped).
    await putItem({
      ...courtKeys.reviewByUser(courtId, "zzz", "2030-01-01T00:00:00.000Z"),
      entity: "REVIEW",
      courtId,
      uid: "zzz",
      rating1to5: 5,
      helpfulCount: 9,
      createdAt: "2030-01-01T00:00:00.000Z",
      updatedAt: "2030-01-01T00:00:00.000Z",
    });

    // Pre-fix: limit:1 queried the lowest-uid row ("aaa") then sorted → the newest
    // review ("zzz") was permanently invisible. Now the full set is sorted, then sliced.
    const recent = await getCourtReviews(courtId, { sort: "recent", limit: 1 });
    expect(recent.items.map((r) => r.uid)).toEqual(["zzz"]);

    // Same defect for helpful: "zzz" has the higher helpfulCount.
    const helpful = await getCourtReviews(courtId, { sort: "helpful", limit: 1 });
    expect(helpful.items.map((r) => r.uid)).toEqual(["zzz"]);
  });

  it("follow/unfollow is idempotent and exposes followers for fan-out", async () => {
    await followCourt(uid1, COURT_ID);
    await followCourt(uid1, COURT_ID); // idempotent
    expect(await isFollowing(uid1, COURT_ID)).toBe(true);
    expect((await getFollowedCourts(uid1)).map((f) => f.courtId)).toContain(COURT_ID);
    expect(await getCourtFollowers(COURT_ID)).toEqual([uid1]);

    await unfollowCourt(uid1, COURT_ID);
    expect(await isFollowing(uid1, COURT_ID)).toBe(false);
    expect(await getCourtFollowers(COURT_ID)).toEqual([]);
  });

  it("anon token persists with a TTL and NO PII", async () => {
    const token = await issueAnonToken();
    const item = await getAnonToken(token);
    expect(item?.entity).toBe("ANON");
    expect(item?.token).toBe(token);
    expect(item?.ttl).toBeGreaterThan(Math.floor(Date.now() / 1000));
    const keys = Object.keys(item ?? {});
    for (const forbidden of ["uid", "email", "name", "displayName"]) {
      expect(keys).not.toContain(forbidden);
    }
  });
});
