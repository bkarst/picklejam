/**
 * fixture.ts — the small, deterministic seed fixture (PRD §14.8).
 *
 * A minimal slice of the graph shared by integration + E2E. It lives in a
 * SYNTHETIC keyspace (country "zz" / state "testland") so it can never collide
 * with the real seed data (`us#…`) when tests share one DynamoDB Local table.
 * Deterministic ids/values (no clocks/RNG) → reproducible. Later stages extend it.
 */

import { putItem } from "@/lib/db/client";
import { geoKeys, courtKeys, userKeys, cityKeyOf } from "@/lib/db/keys";
import { encodeGeohash } from "@/lib/geo/geohash";
import type { CountryItem, StateItem, CityItem, CourtItem, UserProfileItem } from "@/lib/db/types";

const NOW = "2026-06-30T00:00:00.000Z";

export const COUNTRY = "zz";
export const STATE = "testland";
const alpha = cityKeyOf(COUNTRY, STATE, "alpha");
const beta = cityKeyOf(COUNTRY, STATE, "beta");

interface FixtureCourt {
  courtId: string;
  name: string;
  slug: string;
  cityKey: string;
  lat: number;
  lng: number;
  indoorCourts: number;
  outdoorCourts: number;
}

export const fixtureCourts: FixtureCourt[] = [
  { courtId: "court-ateam", name: "A-team Sports", slug: "a-team-sports", cityKey: alpha, lat: 38.9728725, lng: -95.2903846, indoorCourts: 1, outdoorCourts: 0 },
  { courtId: "court-riverside", name: "Riverside Pickleball Courts", slug: "riverside-pickleball-courts", cityKey: alpha, lat: 38.96, lng: -95.26, indoorCourts: 0, outdoorCourts: 4 },
  { courtId: "court-beta-rec", name: "Beta Rec Center", slug: "beta-rec-center", cityKey: beta, lat: 38.9536, lng: -94.7336, indoorCourts: 2, outdoorCourts: 2 },
];

function courtItem(c: FixtureCourt): CourtItem {
  const geohash = encodeGeohash(c.lat, c.lng, 9);
  return {
    ...courtKeys.meta(c.courtId),
    ...courtKeys.inCity(c.courtId, c.cityKey),
    ...courtKeys.bySlug(c.cityKey, c.slug),
    ...courtKeys.geo(c.courtId, geohash),
    entity: "COURT",
    courtId: c.courtId,
    name: c.name,
    slug: c.slug,
    cityKey: c.cityKey,
    lat: c.lat,
    lng: c.lng,
    geohash,
    indoorCourts: c.indoorCourts,
    outdoorCourts: c.outdoorCourts,
    totalCourts: c.indoorCourts + c.outdoorCourts,
    hasPickleball: true,
    hidden: false,
    deleted: false,
    indexable: true,
    popularityRank: 1,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

export const fixture = {
  country: { ...geoKeys.country(COUNTRY), entity: "COUNTRY", code: COUNTRY, name: "Testlandia", createdAt: NOW } satisfies CountryItem,
  state: { ...geoKeys.state(COUNTRY, STATE), entity: "STATE", country: COUNTRY, code: STATE, name: "Testland", slug: STATE, createdAt: NOW } satisfies StateItem,
  cities: [
    { ...geoKeys.city(COUNTRY, STATE, "alpha"), entity: "CITY", cityKey: alpha, name: "Alpha", slug: "alpha", country: COUNTRY, state: STATE, createdAt: NOW } satisfies CityItem,
    { ...geoKeys.city(COUNTRY, STATE, "beta"), entity: "CITY", cityKey: beta, name: "Beta", slug: "beta", country: COUNTRY, state: STATE, createdAt: NOW } satisfies CityItem,
  ],
  courts: fixtureCourts.map(courtItem),
  user: {
    ...userKeys.profile("user-ben"),
    ...userKeys.bySlug("benk"),
    entity: "USER",
    uid: "user-ben",
    username: "benk",
    displayName: "Ben K",
    visibility: "public",
    createdAt: NOW,
  } satisfies UserProfileItem,
};

/** Write the whole fixture into the active table (DynamoDB Local). */
export async function loadFixture(): Promise<void> {
  await putItem(fixture.country as unknown as Record<string, unknown>);
  await putItem(fixture.state as unknown as Record<string, unknown>);
  for (const c of fixture.cities) await putItem(c as unknown as Record<string, unknown>);
  for (const c of fixture.courts) await putItem(c as unknown as Record<string, unknown>);
  await putItem(fixture.user as unknown as Record<string, unknown>);
}
