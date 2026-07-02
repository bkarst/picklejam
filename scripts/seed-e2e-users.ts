#!/usr/bin/env tsx
/**
 * seed-e2e-users.ts — write a known PUBLIC + PRIVATE player profile for the
 * Stage 2 profile E2E (public → Person JSON-LD + indexable; private → noindex +
 * minimal card). Idempotent (putItem overwrites). Run against the E2E DB:
 *   APP_ENV=Test DYNAMODB_ENDPOINT=http://localhost:8000 npx tsx scripts/seed-e2e-users.ts
 */

import { putItem } from "@/lib/db/client";
import { userKeys, cityKeyOf } from "@/lib/db/keys";
import type { UserProfileItem, RatingItem } from "@/lib/db/types";

const NOW = "2026-06-30T00:00:00.000Z";
const HOME = cityKeyOf("us", "kansas", "lawrence");

function profile(uid: string, username: string, displayName: string, visibility: "public" | "private"): UserProfileItem {
  return {
    ...userKeys.profile(uid),
    ...userKeys.bySlug(username),
    entity: "USER",
    uid,
    username,
    displayName,
    homeCityKey: HOME,
    visibility,
    defaultRatingSource: "DUPR",
    onboarded: true,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function rating(uid: string): RatingItem {
  return {
    ...userKeys.rating(uid, "DUPR"),
    entity: "RATING",
    uid,
    system: "DUPR",
    value: 4.25,
    verified: true,
    source: "dupr",
  };
}

async function main() {
  const pub = profile("user-e2e-public", "e2euser", "E2E User", "public");
  const priv = profile("user-e2e-private", "privacyfan", "Privacy Fan", "private");
  await putItem(pub as unknown as Record<string, unknown>);
  await putItem(rating("user-e2e-public") as unknown as Record<string, unknown>);
  await putItem(priv as unknown as Record<string, unknown>);
  console.log("Seeded E2E users: e2euser (public), privacyfan (private).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
