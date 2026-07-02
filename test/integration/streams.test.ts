import { describe, it, expect, beforeAll } from "vitest";
import { applyStreamRecord } from "@/lib/streams";
import { claimStripeEvent } from "@/lib/db/idempotency";
import { getItem, putItem, deleteItem } from "@/lib/db/client";
import { courtKeys, paymentKeys } from "@/lib/db/keys";
import type { CourtItem } from "@/lib/db/types";

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
});
