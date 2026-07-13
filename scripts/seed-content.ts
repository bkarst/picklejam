#!/usr/bin/env tsx
/**
 * seed-content.ts — deterministic Content Hub + News seed (Stage 9, PRD §6.5/§6.6).
 *
 * Seeds one author (Jamie Green) + two PUBLISHED news items with topics + source
 * attribution. Deterministic ids + slugs and idempotent (putItem = last-write-wins),
 * so it drives dev AND the E2E gate and can be re-run safely.
 *
 * NOTE: the evergreen pillar article (Pickleball Court Dimensions, by Jamie Green)
 * is published by the companion scripts/publish-court-dimensions.ts, not here.
 *
 * Usage:
 *   DYNAMODB_ENDPOINT=http://localhost:8000 APP_ENV=Development \
 *     AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local npx tsx scripts/seed-content.ts
 */

import { createNews, upsertAuthor } from "@/lib/data/content";

// Single canonical author for the hub. Also (idempotently) upserted by
// scripts/publish-court-dimensions.ts — keep the two definitions in sync.
const AUTHOR_ID = "a-jamie-green";

const MLP_BODY = `Major League Pickleball confirmed an expanded 2026 season, adding two new host cities and a mid-season showcase event.

## What's new

The league grows to sixteen teams and moves several stops to larger arenas. Organizers cited record 2025 attendance as the driver.

## Why it matters

A bigger pro calendar means more nationally televised pickleball and more qualifying pathways for amateur players hoping to break through.
`;

const RULEBOOK_BODY = `USA Pickleball published its 2026 rulebook update, clarifying the spin serve and refreshing equipment standards.

## The headline changes

- Continued prohibition of the pre-spin ("chainsaw") serve.
- Updated paddle testing for surface roughness and deflection.
- Clearer language on the two-bounce rule for officials.

## What players should do

Recreational players won't notice most of this, but tournament competitors should re-check that their paddle appears on the approved equipment list before registering.
`;

async function main(): Promise<void> {
  await upsertAuthor({
    authorId: AUTHOR_ID,
    name: "Jamie Green",
    slug: "jamie-green",
    avatarUrl: "/jamie-profile.png",
    credentials: "Courtside Columnist, PickleJam",
    bio: "Jamie Green writes about the people, the courts, and the small joys of local pickleball.",
  });

  await createNews({
    id: "n-mlp-2026-season",
    slug: "mlp-announces-expanded-2026-season",
    title: "MLP Announces Expanded 2026 Season",
    excerpt:
      "Major League Pickleball grows to sixteen teams, adds two host cities, and introduces a mid-season showcase.",
    body: MLP_BODY,
    topics: ["pro-tour", "events"],
    source: { name: "Major League Pickleball", url: "https://www.majorleaguepickleball.net" },
    // News is time-relative; stamp recent so it lands in the 48h Google-News window.
    publishedAt: new Date(Date.now() - 4 * 3600e3).toISOString(),
  });

  await createNews({
    id: "n-usap-2026-rulebook",
    slug: "usa-pickleball-updates-2026-rulebook",
    title: "USA Pickleball Updates the 2026 Rulebook",
    excerpt:
      "The 2026 rulebook clarifies the spin serve and refreshes paddle equipment standards ahead of the tournament season.",
    body: RULEBOOK_BODY,
    topics: ["rules", "equipment"],
    source: { name: "USA Pickleball", url: "https://usapickleball.org" },
    publishedAt: new Date(Date.now() - 28 * 3600e3).toISOString(),
  });

  console.log(
    "Seeded content: 1 author (jamie-green), 2 published news items (pro-tour/events, rules/equipment).",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
