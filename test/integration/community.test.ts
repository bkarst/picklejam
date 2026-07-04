// Aggregates must apply inline (no real Streams over DynamoDB Local). Set before
// the data layer runs any emit* (inline.ts reads this env at call time).
process.env.STREAMS_INLINE = "1";

import { describe, it, expect, beforeAll, vi } from "vitest";
import { getItem, putItem } from "@/lib/db/client";
import { getDocClient } from "@/lib/db/table";
import { courtKeys, geoKeys } from "@/lib/db/keys";
import type { NextRequest } from "next/server";
import {
  createCheckin,
  buildCheckinItem,
  getCourtCheckinsToday,
  getMyCheckins,
} from "@/lib/data/checkins";
import { courtLocalDay } from "@/lib/directory/court-local-day";
import {
  POST as checkinRoute,
  MAX_ANON_CHECKINS_PER_COURT_PER_DAY,
} from "@/app/api/courts/[courtId]/checkin/route";
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

  it("L10: two concurrent review edits apply the rating delta ONCE (ratingSum not doubled)", async () => {
    const courtId = `court-l10-${RUN}`;
    const reviewer = `citest-${RUN}-l10`;
    await putItem({
      ...courtKeys.meta(courtId),
      entity: "COURT",
      courtId,
      name: "L10 Court",
      slug: courtId,
      cityKey: CITY_KEY,
      lat: 0,
      lng: 0,
      geohash: "000000000",
      totalCourts: 4,
      hasPickleball: true,
    });
    type CourtAgg = CourtItem & { ratingSum?: number; reviewCount?: number };
    const meta = () => getItem<CourtAgg>(courtKeys.meta(courtId));

    // Baseline review: rating 3 → ratingSum 3, reviewCount 1.
    await upsertReview({ courtId, uid: reviewer, rating1to5: 3 });
    const base = await meta();
    expect(base?.reviewCount).toBe(1);
    expect(base?.ratingSum).toBe(3);

    // Deterministically stage two concurrent EDITS to rating 5: intercept the first edit's
    // REVIEW write and, just before it commits, run the second edit to completion. Pre-fix both
    // edits `emitModify(3→5)` off their stale pre-read, so ratingSum takes the +2 delta twice.
    const client = getDocClient();
    const originalSend = client.send.bind(client);
    const rev = courtKeys.reviewByUser(courtId, reviewer);
    let injected = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sendSpy = vi.spyOn(client, "send").mockImplementation(async (command: any) => {
      const input = command?.input ?? {};
      const isReviewWrite =
        input.Item && input.Item.pk === rev.pk && input.Item.sk === rev.sk && input.Item.entity === "REVIEW";
      if (isReviewWrite && !injected) {
        injected = true;
        await upsertReview({ courtId, uid: reviewer, rating1to5: 5 }); // concurrent edit B: 3→5
        return originalSend(command);
      }
      return originalSend(command);
    });
    await upsertReview({ courtId, uid: reviewer, rating1to5: 5 }); // edit A: 3→5
    sendSpy.mockRestore();

    const after = await meta();
    expect(after?.reviewCount).toBe(1); // still one review
    expect(after?.ratingSum).toBe(5); // pre-fix: 7 (3 + 2 + 2 — the delta applied twice)
    expect(after?.ratingAvg).toBe(5); // pre-fix: 7 (a corrupt >5 average)
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

  it("L3: anonymous check-ins are capped per court per day (fresh-token Sybil ceiling)", async () => {
    const COURT = `court-l3-${RUN}`;
    await putItem({
      ...courtKeys.meta(COURT),
      entity: "COURT",
      courtId: COURT,
      name: "L3 Court",
      slug: `l3-${RUN}`,
      cityKey: CITY_KEY,
      lat: 0,
      lng: 0,
      geohash: "000000000",
      totalCourts: 1,
      hasPickleball: true,
    });
    const court = (await getItem<CourtItem>(courtKeys.meta(COURT)))!;
    const day = courtLocalDay(court);

    // Seed the court to its anonymous ceiling with token-anon rows (no uid) for today.
    await Promise.all(
      Array.from({ length: MAX_ANON_CHECKINS_PER_COURT_PER_DAY }, (_, i) =>
        putItem(
          buildCheckinItem(
            { courtId: COURT, uid: null, anonymous: true, day, id: `l3-seed-${i}` },
            CITY_KEY,
          ) as unknown as Record<string, unknown>,
        ),
      ),
    );

    // A FRESH anonymous check-in (no token → the old bypass) is now rejected once the court
    // has taken its daily anonymous allotment. Pre-fix: 200 (the fresh token skipped the cap).
    const req = new Request(`http://localhost/api/courts/${COURT}/checkin`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await checkinRoute(req as unknown as NextRequest, {
      params: Promise.resolve({ courtId: COURT }),
    });
    expect(res.status).toBe(429);
  });
});
