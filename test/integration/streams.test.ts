import { describe, it, expect, beforeAll } from "vitest";
import { applyStreamRecord } from "@/lib/streams";
import { claimStripeEvent } from "@/lib/db/idempotency";
import { getItem, putItem, deleteItem } from "@/lib/db/client";
import { courtKeys, paymentKeys, userKeys, geoKeys, groupKeys, parseCityKey } from "@/lib/db/keys";
import type { CourtItem, Counts } from "@/lib/db/types";

/**
 * Streams aggregation + webhook idempotency against DynamoDB Local (§9.4/§9.5 #23).
 * Self-isolating: uses a DEDICATED court + evt id (not the shared fixture) and
 * resets them in beforeAll, so the test is correct even on a persistent table and
 * when other integration files run in parallel. Skipped without DYNAMODB_ENDPOINT.
 */
const d = process.env.DYNAMODB_ENDPOINT ? describe : describe.skip;

const COURT_ID = "court-agg-test";
const EVT_ID = "evt_agg_test";

d("Streams aggregation + idempotency (DynamoDB Local)", () => {
  beforeAll(async () => {
    // Fresh court (putItem overwrites → counters reset to 0 each run).
    await putItem({
      ...courtKeys.meta(COURT_ID),
      entity: "COURT",
      courtId: COURT_ID,
      name: "Aggregation Test Court",
      slug: "aggregation-test-court",
      cityKey: "zz#testland#alpha",
      lat: 0,
      lng: 0,
      geohash: "000000000",
      totalCourts: 2,
      hasPickleball: true,
    });
    // Clear the dedupe item so the idempotency test starts unclaimed.
    await deleteItem(paymentKeys.stripeEvent(EVT_ID));
  });

  it("REVIEW inserts materialize reviewCount + ratingSum + ratingAvg on the court", async () => {
    const review = (rating: number, uid: string) => ({
      eventName: "INSERT" as const,
      newImage: {
        ...courtKeys.review(COURT_ID, `20260701T${uid}`, uid),
        entity: "REVIEW",
        rating1to5: rating,
      },
    });

    await applyStreamRecord(review(4, "u1"));
    await applyStreamRecord(review(2, "u2"));

    const court = await getItem<CourtItem & { ratingSum?: number }>(courtKeys.meta(COURT_ID));
    expect(court?.reviewCount).toBe(2);
    expect(court?.ratingSum).toBe(6);
    expect(court?.ratingAvg).toBe(3);
  });

  it("Stripe webhook idempotency: first claim wins, replay is skipped", async () => {
    expect(await claimStripeEvent(EVT_ID, () => 1_700_000_000_000)).toBe(true);
    expect(await claimStripeEvent(EVT_ID, () => 1_700_000_000_000)).toBe(false);
  });

  it("M14: geo counts.players follows the profile's homeCityKey (city-less INSERT → set → move → remove)", async () => {
    const RUN = Math.random().toString(36).slice(2, 8);
    const u = `u-m14-${RUN}`;
    const CITY_A = `zz#m14land#a${RUN}`;
    const CITY_B = `zz#m14land#b${RUN}`;
    const profile = (homeCityKey?: string) => ({
      ...userKeys.profile(u),
      entity: "USERPROFILE",
      uid: u,
      username: `m14-${RUN}`,
      ...(homeCityKey ? { homeCityKey } : {}),
    });
    const playersOf = async (cityKey: string): Promise<number> => {
      const { country, state, city } = parseCityKey(cityKey);
      const item = await getItem<{ counts?: Counts }>(geoKeys.city(country, state, city));
      return item?.counts?.players ?? 0;
    };

    // The REAL signup shape: a profile is created WITHOUT a home city → no attribution yet.
    await applyStreamRecord({ eventName: "INSERT", newImage: profile() });
    expect(await playersOf(CITY_A)).toBe(0);

    // Onboarding sets the home city (MODIFY undefined→A) → +1 in A. Pre-fix the INSERT-only
    // handler skipped this MODIFY entirely, so counts.players stayed 0 forever.
    await applyStreamRecord({ eventName: "MODIFY", oldImage: profile(), newImage: profile(CITY_A) });
    expect(await playersOf(CITY_A)).toBe(1);

    // A home-city move (MODIFY A→B) RE-attributes: A drops to 0, B rises to 1.
    await applyStreamRecord({ eventName: "MODIFY", oldImage: profile(CITY_A), newImage: profile(CITY_B) });
    expect(await playersOf(CITY_A)).toBe(0);
    expect(await playersOf(CITY_B)).toBe(1);

    // Account deletion (REMOVE) → B drops to 0.
    await applyStreamRecord({ eventName: "REMOVE", oldImage: profile(CITY_B) });
    expect(await playersOf(CITY_B)).toBe(0);
  });

  it("M23: a MEMBER REMOVE for an ALREADY-DELETED group does NOT resurrect a ghost META", async () => {
    // A group cascade-delete removes its META + MEMBER# rows in one txn; in prod the real
    // Stream then delivers a REMOVE per member. The META no longer exists (fresh id here).
    const GID = `g-m23-${Math.random().toString(36).slice(2, 8)}`;
    expect(await getItem(groupKeys.meta(GID))).toBeUndefined();

    await applyStreamRecord({
      eventName: "REMOVE",
      oldImage: {
        ...groupKeys.member(GID, "u1"),
        entity: "GROUPMEMBER",
        groupId: GID,
        uid: "u1",
        status: "active", // an active seat → onMember computes delta -1
      },
    });

    // Pre-fix: `ADD memberCount :-1` on the missing META CREATED a ghost {memberCount:-1}
    // that getGroupMeta returns as truthy. Post-fix the attribute_exists(pk) guard no-ops it.
    expect(await getItem(groupKeys.meta(GID))).toBeUndefined();
  });
});
