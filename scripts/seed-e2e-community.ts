#!/usr/bin/env tsx
/**
 * seed-e2e-community.ts — seed one court REVIEW (by e2euser) and bump that court's
 * aggregates, so the Stage 3 J9 render assertion is deterministic (court page emits
 * Review JSON-LD + a populated AggregateRating). Idempotent. Run after ingest +
 * seed-e2e-users, against the E2E DB.
 */

import { getCourtBySlug } from "@/lib/data/courts";
import { putItem, updateItem } from "@/lib/db/client";
import { courtKeys } from "@/lib/db/keys";
import type { ReviewItem } from "@/lib/db/types";

const SLUG = { country: "us", state: "kansas", city: "lawrence", slug: "sports-pavilion-at-rock-chalk-park" };

async function main() {
  const court = await getCourtBySlug(SLUG.country, SLUG.state, SLUG.city, SLUG.slug);
  if (!court) throw new Error(`E2E review-seed court not found: ${SLUG.slug} (ingest Kansas first)`);

  const review: ReviewItem = {
    ...courtKeys.reviewByUser(court.courtId, "user-e2e-public"),
    entity: "REVIEW",
    courtId: court.courtId,
    uid: "user-e2e-public",
    rating1to5: 5,
    title: "Fantastic courts",
    body: "Immaculate indoor courts, great lighting, and always a friendly crowd for open play.",
    tags: ["great-courts", "well-maintained"],
    helpfulCount: 3,
    checkinVerified: true,
    createdAt: "2026-06-25T12:00:00.000Z",
    updatedAt: "2026-06-25T12:00:00.000Z",
  };
  await putItem(review as unknown as Record<string, unknown>);

  // Bump the court aggregates directly (deterministic; mirrors the Streams result).
  await updateItem({
    key: courtKeys.meta(court.courtId),
    update: "SET reviewCount = :c, ratingSum = :s, ratingAvg = :a",
    values: { ":c": 1, ":s": 5, ":a": 5 },
  });

  console.log(`Seeded a review + aggregates on ${court.name} (${court.courtId}).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
