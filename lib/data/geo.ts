/**
 * geo.ts — read repository for the geo directory (PRD §9.5 #7).
 *
 * Every function is a single Query/GetItem (no scans). Directory pages are static
 * per slug (§9.7) — they never geo-query. Counts/centroids are denormalized on
 * the items (batch-rolled at ingest, reconciled by Streams later).
 */

import { unstable_cache } from "next/cache";
import { getItem, query, batchGet } from "@/lib/db/client";
import { GSI } from "@/lib/db/table";
import { geoKeys } from "@/lib/db/keys";
import type { CountryItem, StateItem, CityItem } from "@/lib/db/types";

export async function getCountry(country: string): Promise<CountryItem | undefined> {
  return getItem<CountryItem>(geoKeys.country(country));
}

export async function getState(country: string, state: string): Promise<StateItem | undefined> {
  return getItem<StateItem>(geoKeys.state(country, state));
}

export async function getCity(
  country: string,
  state: string,
  city: string,
): Promise<CityItem | undefined> {
  return getItem<CityItem>(geoKeys.city(country, state, city));
}

/** All countries with a directory (hub page). Small set — a single Query. */
export async function getCountries(): Promise<CountryItem[]> {
  // Countries live at PK=COUNTRY#<c>/SK=META; there's no parent to Query, so the
  // hub reads the known set by key (batchGet). v1 is US-only (§13 intl deferred).
  return (await batchGet<CountryItem>([geoKeys.country("us")])).filter(Boolean);
}

/** States in a country, GSI2 (§9.5 #7). */
export async function getStatesInCountry(country: string): Promise<StateItem[]> {
  const { items } = await query<StateItem>({
    index: GSI.byLocation,
    pk: geoKeys.statesInCountry(country),
    skBeginsWith: "STATE#",
  });
  return items.sort((a, b) => a.name.localeCompare(b.name));
}

/** Cities in a state, GSI2 (§9.5 #7). Ordered by venue count desc, then name. */
export async function getCitiesInState(country: string, state: string): Promise<CityItem[]> {
  const { items } = await query<CityItem>({
    index: GSI.byLocation,
    pk: geoKeys.citiesInState(country, state),
    skBeginsWith: "CITY#",
  });
  return items.sort(
    (a, b) => (b.counts?.locations ?? 0) - (a.counts?.locations ?? 0) || a.name.localeCompare(b.name),
  );
}

/**
 * All cities in a country (traversal), cached hourly. Backs geo-IP nearest-city
 * and the search typeahead — an in-memory list is fine at directory scale (v1;
 * revisit OpenSearch if it grows, §13 decision 5). Never a scan.
 */
export const getAllCities = unstable_cache(
  async (country: string): Promise<CityItem[]> => {
    const states = await getStatesInCountry(country);
    const perState = await Promise.all(states.map((s) => getCitiesInState(country, s.code)));
    return perState.flat();
  },
  ["all-cities"],
  { revalidate: 3600, tags: ["cities"] },
);

/** Top states in a country by venue count (homepage directory block). */
export async function getTopStates(country: string, limit = 8): Promise<StateItem[]> {
  const states = await getStatesInCountry(country);
  return [...states]
    .sort((a, b) => (b.counts?.locations ?? 0) - (a.counts?.locations ?? 0))
    .slice(0, limit);
}

/**
 * Top cities in a country by venue count (homepage "Explore places to play").
 * Traverses states → cities (no scans); bounded fan-out, run behind ISR.
 */
export async function getTopCities(country: string, limit = 8): Promise<CityItem[]> {
  const states = await getStatesInCountry(country);
  const perState = await Promise.all(states.map((s) => getCitiesInState(country, s.code)));
  return perState
    .flat()
    .sort((a, b) => (b.counts?.locations ?? 0) - (a.counts?.locations ?? 0))
    .slice(0, limit);
}

/** Resolve a set of cities by cityKey (for the "nearby cities" interlink grid). */
export async function getCitiesByKeys(cityKeys: string[]): Promise<CityItem[]> {
  if (cityKeys.length === 0) return [];
  const keys = cityKeys.map((ck) => {
    const [c, st, city] = ck.split("#");
    return geoKeys.city(c, st, city);
  });
  const items = await batchGet<CityItem>(keys);
  // Preserve the requested (distance) order.
  const order = new Map(cityKeys.map((k, i) => [k, i]));
  return items.sort((a, b) => (order.get(a.cityKey) ?? 0) - (order.get(b.cityKey) ?? 0));
}
