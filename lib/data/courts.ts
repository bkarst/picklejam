/**
 * courts.ts — read repository for courts (PRD §9.5 #1, #2, #3).
 *
 * #1 court by slug (GSI3) and #2 courts in a city (GSI2) are single Queries.
 * #3 "near me" fans out one Query per geohash cover-cell (§9.7) — the documented
 * multi-partition exception — then filters by precise haversine distance. Popularity
 * ordering happens here in the read layer (rank is a non-key attribute, §9.3).
 */

import { getItem, query } from "@/lib/db/client";
import { GSI } from "@/lib/db/table";
import { courtKeys, cityKeyOf } from "@/lib/db/keys";
import { coverSet, haversineMeters } from "@/lib/geo/geohash";
import { getStatesInCountry, getCitiesInState } from "@/lib/data/geo";
import type { CourtItem } from "@/lib/db/types";


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
/** All courts in one GSI4 geo partition, fully paginated (partitions are coarse). */
async function queryGeoCell(cell: string): Promise<CourtItem[]> {
  const out: CourtItem[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const { items, lastKey } = await query<CourtItem>({
      index: GSI.byGeo,
      pk: courtKeys.geoPk(cell),
      startKey,
    });
    out.push(...items);
    startKey = lastKey;
  } while (startKey);
  return out;
}

export async function getCourtsNear(
  lat: number,
  lng: number,
  radiusMeters: number,
  limit = 60,
): Promise<CourtWithDistance[]> {
  // coverSet defaults to GEO_PARTITION_PRECISION (4) → a ~15mi radius is a handful
  // of partitions, not thousands. Each partition can be large at this precision,
  // so paginate it fully (else a dense metro cell would silently drop courts).
  const cells = coverSet(lat, lng, radiusMeters);
  const results = await Promise.all(cells.map((cell) => queryGeoCell(cell)));
  const seen = new Set<string>();
  const out: CourtWithDistance[] = [];
  for (const items of results) {
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

/** Nearby courts to a given court (excludes itself) — court-detail interlink. */
export async function getNearbyCourts(
  court: CourtItem,
  radiusMeters = 25_000,
  limit = 6,
): Promise<CourtWithDistance[]> {
  const near = await getCourtsNear(court.lat, court.lng, radiusMeters, limit + 1);
  return near.filter((c) => c.courtId !== court.courtId).slice(0, limit);
}
