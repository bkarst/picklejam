#!/usr/bin/env tsx
/**
 * seed-e2e-groups.ts — deterministic groups for the Stage 8 gate:
 *   • `e2egroup` — a PUBLIC, open-to-join group at the Lawrence court, with a
 *     scheduled group MEET-UP (an Outing hostType=GROUP, public, today) so it
 *     surfaces on the group detail, the court's "Groups that play here" rail, the
 *     city group finder, AND the city game finder;
 *   • `e2egroupx` — a PRIVATE, invite-only group at the same court (must stay
 *     noindex + out of every public rail).
 * Idempotent (skips if present). Run after ingest, against the E2E DB.
 */

import { getCourtBySlug } from "@/lib/data/courts";
import { createGroup, getGroup } from "@/lib/data/groups";
import { createOuting, getOutingMeta } from "@/lib/data/outings";
import { devUid } from "@/lib/auth/dev";

const SLUG = { country: "us", state: "kansas", city: "lawrence", slug: "sports-pavilion-at-rock-chalk-park" };

/** Today at 18:00 UTC (≈ midday in Lawrence → today's court-local day bucket). */
function todayAt(hourUtc: number): string {
  const d = new Date();
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d.toISOString();
}

async function main() {
  const court = await getCourtBySlug(SLUG.country, SLUG.state, SLUG.city, SLUG.slug);
  if (!court) throw new Error(`E2E group-seed court not found: ${SLUG.slug} (ingest Kansas first)`);
  const owner = devUid("gowner@dev.local");

  if (!(await getGroup("e2egroup"))) {
    await createGroup({
      groupId: "e2egroup",
      name: "Lawrence Dinkers Club",
      creatorId: owner,
      cityKey: court.cityKey,
      homeCourtId: court.courtId,
      visibility: "public",
      joinPolicy: "open",
      description: "A friendly public club that plays at Rock Chalk Park.",
    });
    // A public group meet-up (Outing hostType=GROUP) — renders on the group + city.
    if (!(await getOutingMeta("e2egroupmeet"))) {
      await createOuting({
        outingId: "e2egroupmeet",
        title: "Dinkers Club Open Play",
        courtId: court.courtId,
        organizerId: owner,
        startTs: todayAt(18),
        endTs: todayAt(20),
        type: "open",
        visibility: "public",
        hostType: "GROUP",
        groupId: "e2egroup",
        capacity: 12,
        waitlist: true,
      });
    }
  }

  if (!(await getGroup("e2egroupx"))) {
    await createGroup({
      groupId: "e2egroupx",
      name: "Secret Lawrence Ballers",
      creatorId: owner,
      cityKey: court.cityKey,
      homeCourtId: court.courtId,
      visibility: "private",
      joinPolicy: "invite",
    });
  }

  console.log("Seeded e2egroup (public + meet-up) + e2egroupx (private).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
