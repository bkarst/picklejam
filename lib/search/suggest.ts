/**
 * suggest.ts — global search typeahead (PRD §6.1): PLACES (cities) + COURTS.
 *
 * Matches by name against the in-process search index (lib/search/index-store),
 * so a query finds ANY city/court in the country — not just local ones — without
 * reloading the directory per request. When `coords` is supplied, court results
 * carry a distance and are tie-broken nearest-first. Read-only.
 */

import { getSearchIndex, type CourtSearchLite, type CitySearchLite } from "./index-store";
import { haversineMeters } from "@/lib/geo/geohash";
import { parseCityKey } from "@/lib/db/keys";
import { courtPath, cityUrlFromKey, metersToMiles } from "@/lib/urls";
import { stateAbbr } from "@/lib/geo/us-states";

export interface Suggestion {
  type: "city" | "court";
  label: string;
  sublabel?: string;
  url: string;
  /** Court id for `type:"court"` results (Stage 4 outing wizard court picker). */
  courtId?: string;
  /** `country#state#city` key for `type:"city"` results (league/ladder city picker). */
  cityKey?: string;
}

export interface Coords {
  lat: number;
  lng: number;
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** "overland-park" → "Overland Park". */
function titleCase(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Relevance of `name` to query `q` (already normalized): exact > prefix > token-prefix > substring. */
function scoreName(name: string, q: string): number {
  const n = norm(name);
  if (n === q) return 4;
  if (n.startsWith(q)) return 3;
  if (n.split(/[\s\-]+/).some((t) => t.startsWith(q))) return 2;
  if (n.includes(q)) return 1;
  return 0;
}

function cityToSuggestion(c: CitySearchLite): Suggestion {
  const { state } = parseCityKey(c.key);
  return {
    type: "city",
    label: `${c.name}, ${titleCase(state)}, United States`,
    url: cityUrlFromKey(c.key),
    cityKey: c.key,
  };
}

function courtToSuggestion(c: CourtSearchLite, distanceMeters?: number): Suggestion {
  const { country, state, city } = parseCityKey(c.cityKey);
  const where = `${titleCase(city)}, ${stateAbbr(state)}`;
  const sublabel =
    distanceMeters !== undefined
      ? `${metersToMiles(distanceMeters)} miles away · ${where}`
      : `${c.tc} court${c.tc === 1 ? "" : "s"} · ${where}`;
  return {
    type: "court",
    label: c.name,
    sublabel,
    url: courtPath(country, state, city, c.slug),
    courtId: c.id,
  };
}

export async function suggestSearch(
  rawQ: string,
  opts: { country?: string; coords?: Coords; cityLimit?: number; courtLimit?: number } = {},
): Promise<{ cities: Suggestion[]; courts: Suggestion[] }> {
  const country = opts.country ?? "us";
  const coords = opts.coords;
  const q = norm(rawQ);

  const { cities, courts } = await getSearchIndex(country);

  // Empty query → the location-aware "before you type" state: nearest courts +
  // the visitor's city, computed from the in-memory index (instant — no geohash
  // fan-out). Without coords there's nothing local to show.
  if (q.length < 2) {
    if (!coords) return { cities: [], courts: [] };
    const nearest = courts
      .map((c) => ({ c, d: haversineMeters(coords.lat, coords.lng, c.lat, c.lng) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, opts.courtLimit ?? 6);
    const nearestCityKey = nearest[0]?.c.cityKey;
    const cityLite = nearestCityKey ? cities.find((c) => c.key === nearestCityKey) : undefined;
    return {
      cities: cityLite ? [cityToSuggestion(cityLite)] : [],
      courts: nearest.map((x) => courtToSuggestion(x.c, x.d)),
    };
  }

  const cityHits = cities
    .map((c) => ({ c, s: scoreName(c.name, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || b.c.loc - a.c.loc || a.c.name.localeCompare(b.c.name))
    .slice(0, opts.cityLimit ?? 5)
    .map(({ c }) => cityToSuggestion(c));

  const courtScored = courts
    .map((c) => ({
      c,
      s: scoreName(c.name, q),
      d: coords ? haversineMeters(coords.lat, coords.lng, c.lat, c.lng) : undefined,
    }))
    .filter((x) => x.s > 0);
  courtScored.sort((a, b) => {
    if (b.s !== a.s) return b.s - a.s;
    if (a.d !== undefined && b.d !== undefined && a.d !== b.d) return a.d - b.d;
    return b.c.pop - a.c.pop;
  });
  const courtHits = courtScored
    .slice(0, opts.courtLimit ?? 8)
    .map((x) => courtToSuggestion(x.c, x.d));

  return { cities: cityHits, courts: courtHits };
}
