/**
 * build-index.ts — live-traversal fallback for the search index (PRD §6.1).
 *
 * Only used when the precomputed chunks (scripts/ingest.ts → writeSearchIndex)
 * are missing. Loaded via dynamic import from index-store so the data layer
 * (and next/cache) stays out of that module's static graph and the ingest CLI.
 * Same traversal the old `getAllCourtsLite` did — states → cities → courts, no
 * scan — but the result lands in an in-process cache, not `unstable_cache`.
 */

import { getStatesInCountry, getCitiesInState } from "@/lib/data/geo";
import { getCourtsInCity } from "@/lib/data/courts";
import {
  courtToLite,
  cityToLite,
  type CourtSearchLite,
  type CitySearchLite,
  type SearchIndex,
} from "./index-store";

export async function buildSearchIndex(country: string): Promise<SearchIndex> {
  const states = await getStatesInCountry(country);
  const courts: CourtSearchLite[] = [];
  const cities: CitySearchLite[] = [];
  for (const state of states) {
    const stateCities = await getCitiesInState(country, state.code);
    for (const c of stateCities) cities.push(cityToLite(c));
    const perCity = await Promise.all(
      stateCities.map((c) => getCourtsInCity(country, state.code, c.slug)),
    );
    for (const list of perCity)
      for (const ct of list) if (ct.indexable !== false) courts.push(courtToLite(ct));
  }
  return { courts, cities };
}
