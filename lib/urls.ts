/**
 * urls.ts — canonical internal URL builders (PRD §3.2 taxonomy, §12 linking graph).
 *
 * The ONE place that constructs directory paths, so pages, cards, breadcrumbs,
 * sitemaps, and JSON-LD all agree. Paths mirror the strict geo hierarchy:
 *   /courts/<country>/<state>/<city>/<court-slug>
 */

import { parseCityKey } from "@/lib/db/keys";
import type { CourtItem, CityItem, StateItem, CountryItem } from "@/lib/db/types";

export const countryPath = (country: string): string => `/courts/${country}`;
export const statePath = (country: string, state: string): string => `/courts/${country}/${state}`;
export const cityPath = (country: string, state: string, city: string): string =>
  `/courts/${country}/${state}/${city}`;
export const courtPath = (country: string, state: string, city: string, slug: string): string =>
  `/courts/${country}/${state}/${city}/${slug}`;

/** Build a court's canonical URL from its item (cityKey + slug). */
export function courtUrl(court: Pick<CourtItem, "cityKey" | "slug">): string {
  const { country, state, city } = parseCityKey(court.cityKey);
  return courtPath(country, state, city, court.slug);
}

/** Build a city's canonical URL from its item. */
export function cityUrl(city: Pick<CityItem, "country" | "state" | "slug">): string {
  return cityPath(city.country, city.state, city.slug);
}

/** Build a city URL from a bare cityKey (for nearby-city interlinks). */
export function cityUrlFromKey(cityKey: string): string {
  const { country, state, city } = parseCityKey(cityKey);
  return cityPath(country, state, city);
}

export function stateUrl(state: Pick<StateItem, "country" | "code">): string {
  return statePath(state.country, state.code);
}

export function countryUrl(country: Pick<CountryItem, "code">): string {
  return countryPath(country.code);
}

/** Type / amenity landings (§6.1). */
export const courtTypePath = (type: string): string => `/courts/types/${type}`;
export const amenityPath = (amenity: string): string => `/courts/amenities/${amenity}`;

/** Meters → miles, rounded to one decimal (card distance display). */
export function metersToMiles(m: number): number {
  return Math.round((m / 1609.344) * 10) / 10;
}
