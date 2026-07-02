/**
 * courts.ts — read repository for courts (PRD §9.5 #1, #2, #3).
 *
 * #1 court by slug (GSI3) and #2 courts in a city (GSI2) are single Queries.
 * #3 "near me" fans out one Query per geohash cover-cell (§9.7) — the documented
 * multi-partition exception — then filters by precise haversine distance. Popularity
 * ordering happens here in the read layer (rank is a non-key attribute, §9.3).
 */

import { unstable_cache } from "next/cache";
import { getItem, query } from "@/lib/db/client";
import { GSI } from "@/lib/db/table";
import { courtKeys, cityKeyOf } from "@/lib/db/keys";
import { coverSet, haversineMeters } from "@/lib/geo/geohash";
import { getStatesInCountry, getCitiesInState } from "@/lib/data/geo";
import type { CourtItem } from "@/lib/db/types";

/** Minimal court shape for the search typeahead + client map markers. */
export interface CourtLite {
  courtId: string;
  name: string;
  slug: string;
  cityKey: string;
  lat: number;
  lng: number;
  totalCourts: number;
  indoorCourts: number;
  outdoorCourts: number;
  lighted: boolean;
  dedicated: boolean;
  access: CourtItem["access"];
}

function toLite(c: CourtItem): CourtLite {
  return {
    courtId: c.courtId,
    name: c.name,
    slug: c.slug,
    cityKey: c.cityKey,
    lat: c.lat,
    lng: c.lng,
    totalCourts: c.totalCourts,
    indoorCourts: c.indoorCourts ?? 0,
    outdoorCourts: c.outdoorCourts ?? 0,
    lighted: Boolean(c.lighted),
    dedicated: Boolean(c.dedicated),
    access: c.access ?? null,
  };
}

export type CourtWithDistance = CourtItem & { distanceMeters: number };

/** Whether a court is renderable (never show hidden/deleted/non-pickleball). */
function isVisible(c: CourtItem): boolean {
  return !c.hidden && !c.deleted && c.hasPickleball !== false;
}

/** Highest popularity first, then most courts, then name. */
function byPopularity(a: CourtItem, b: CourtItem): number {
  return (
    (b.popularityRank ?? 0) - (a.popularityRank ?? 0) ||
    (b.totalCourts ?? 0) - (a.totalCourts ?? 0) ||
    a.name.localeCompare(b.name)
  );
}

/** #1 — court detail by URL slug (GSI3). */
export async function getCourtBySlug(
  country: string,
  state: string,
  city: string,
  slug: string,
): Promise<CourtItem | undefined> {
  const cityKey = cityKeyOf(country, state, city);
  const { items } = await query<CourtItem>({
    index: GSI.bySlug,
    pk: courtKeys.courtSlugPk(cityKey, slug),
    skEquals: "META",
    limit: 1,
  });
  const court = items[0];
  return court && isVisible(court) ? court : undefined;
}

/** Court by id (GetItem) — used for cross-references. */
export async function getCourt(courtId: string): Promise<CourtItem | undefined> {
  return getItem<CourtItem>(courtKeys.meta(courtId));
}

/** #2 — courts in a city (GSI2), popularity-ordered. */
export async function getCourtsInCity(
  country: string,
  state: string,
  city: string,
): Promise<CourtItem[]> {
  const cityKey = cityKeyOf(country, state, city);
  const { items } = await query<CourtItem>({
    index: GSI.byLocation,
    pk: courtKeys.cityCourtsPk(cityKey),
    skBeginsWith: "COURT#",
  });
  return items.filter(isVisible).sort(byPopularity);
}

/**
 * #3 — courts within `radiusMeters` of a point (GSI4 geohash cover-set, §9.7).
 * Fans out one Query per cover cell, filters by exact distance, sorts nearest-first.
 */
export async function getCourtsNear(
  lat: number,
  lng: number,
  radiusMeters: number,
  limit = 60,
): Promise<CourtWithDistance[]> {
  const cells = coverSet(lat, lng, radiusMeters, 6);
  const results = await Promise.all(
    cells.map((cell) => query<CourtItem>({ index: GSI.byGeo, pk: courtKeys.geoPk(cell) })),
  );
  const seen = new Set<string>();
  const out: CourtWithDistance[] = [];
  for (const { items } of results) {
    for (const c of items) {
      if (seen.has(c.courtId) || !isVisible(c)) continue;
      seen.add(c.courtId);
      const distanceMeters = haversineMeters(lat, lng, c.lat, c.lng);
      if (distanceMeters <= radiusMeters) out.push({ ...c, distanceMeters });
    }
  }
  return out.sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, limit);
}

/**
 * Courts across a country matching a predicate — backs the court-type / amenity
 * landings (§6.1). Traverses states → cities → courts (no scans), stops at
 * `limit`. Bounded fan-out behind ISR; at full US scale prefer a dedicated GSI
 * or a precomputed landing index (TODO scale).
 */
export async function getCourtsMatching(
  country: string,
  predicate: (c: CourtItem) => boolean,
  limit = 48,
): Promise<CourtItem[]> {
  const out: CourtItem[] = [];
  const states = await getStatesInCountry(country);
  for (const state of states) {
    const cities = await getCitiesInState(country, state.code);
    for (const city of cities) {
      const courts = await getCourtsInCity(country, state.code, city.slug);
      for (const c of courts) {
        if (c.indexable !== false && predicate(c)) out.push(c);
        if (out.length >= limit) return out.sort(byPopularity);
      }
    }
  }
  return out.sort(byPopularity);
}

/**
 * All indexable courts (lite), cached hourly — backs the search typeahead's
 * COURTS group. In-memory at directory scale (v1; OpenSearch later, §13). No scan.
 */
export const getAllCourtsLite = unstable_cache(
  async (country: string): Promise<CourtLite[]> => {
    const states = await getStatesInCountry(country);
    const out: CourtLite[] = [];
    for (const state of states) {
      const cities = await getCitiesInState(country, state.code);
      const perCity = await Promise.all(
        cities.map((c) => getCourtsInCity(country, state.code, c.slug)),
      );
      for (const courts of perCity)
        for (const c of courts) if (c.indexable !== false) out.push(toLite(c));
    }
    return out;
  },
  ["all-courts-lite"],
  { revalidate: 3600, tags: ["courts"] },
);

/** Nearby courts to a given court (excludes itself) — court-detail interlink. */
export async function getNearbyCourts(
  court: CourtItem,
  radiusMeters = 25_000,
  limit = 6,
): Promise<CourtWithDistance[]> {
  const near = await getCourtsNear(court.lat, court.lng, radiusMeters, limit + 1);
  return near.filter((c) => c.courtId !== court.courtId).slice(0, limit);
}
