#!/usr/bin/env tsx
/**
 * seed-e2e-outings.ts — seed a deterministic FULL, waitlist-enabled outing for the
 * Stage 4 gate (J3, waitlist branch). Creates one public capacity-1 game at a known
 * court (fixed outingId → stable URL /outings/e2ewait) and fills its single spot
 * with the organizer's `going` RSVP, so the E2E's second player is placed on the
 * waitlist (capacity enforced, never oversold — §6.7). Also seeds a plain FUTURE
 * public game (e2eshow) so the court's Upcoming Games grid has a deterministic row.
 * Idempotent-ish: createOuting is create-only guarded, so re-runs no-op on the
 * OUTING rows. Run after ingest, against the E2E DB.
 */

import { getCourtBySlug } from "@/lib/data/courts";
import { createOuting, rsvp, getOutingMeta } from "@/lib/data/outings";
import { devUid } from "@/lib/auth/dev";

const SLUG = { country: "us", state: "kansas", city: "lawrence", slug: "sports-pavilion-at-rock-chalk-park" };

/** Tomorrow at 18:00 UTC — safely "upcoming" regardless of when the suite runs. */
function tomorrowAt(hourUtc: number): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d.toISOString();
}

async function main() {
  const court = await getCourtBySlug(SLUG.country, SLUG.state, SLUG.city, SLUG.slug);
  if (!court) throw new Error(`E2E outing-seed court not found: ${SLUG.slug} (ingest Kansas first)`);

  const organizerId = devUid("organizer@dev.local");

  // A full, waitlist-enabled game (capacity 1, organizer already going).
  if (!(await getOutingMeta("e2ewait"))) {
    await createOuting({
      outingId: "e2ewait",
      title: "Sunset Singles (full)",
      courtId: court.courtId,
      organizerId,
      startTs: tomorrowAt(1),
      endTs: tomorrowAt(3),
      type: "open",
      visibility: "public",
      capacity: 1,
      waitlist: true,
      skillMin: 3,
      skillMax: 4,
      description: "A deterministic full game for the waitlist gate.",
    });
    await rsvp("e2ewait", organizerId, "going");
  }

  // A plain future public game so the court's Upcoming Games grid is non-empty.
  if (!(await getOutingMeta("e2eshow"))) {
    await createOuting({
      outingId: "e2eshow",
      title: "Morning Open Play",
      courtId: court.courtId,
      organizerId,
      startTs: tomorrowAt(15),
      endTs: tomorrowAt(17),
      type: "open",
      visibility: "public",
      capacity: 8,
      waitlist: true,
      skillMin: 2.5,
      skillMax: 4,
    });
  }

  console.log(`Seeded E2E outings on ${court.name}: e2ewait (full/waitlist), e2eshow (upcoming).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
