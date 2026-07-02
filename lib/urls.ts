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

// ── outings & city game finder (Stage 4, §6.7) ───────────────────────────────

/** Canonical outing/game detail URL. `/sessions/<id>` 301s here. */
export const outingPath = (id: string): string => `/outings/${id}`;

/** City game-finder ("Pickleball Games in {City}") landing (§6.7). */
export const cityGamesPath = (country: string, state: string, city: string): string =>
  `/play/${country}/${state}/${city}`;

/** Build a city game-finder URL from a bare cityKey (for interlinks). */
export function cityGamesPathFromKey(cityKey: string): string {
  const { country, state, city } = parseCityKey(cityKey);
  return cityGamesPath(country, state, city);
}

// ── round-robin free tool (Stage 5, §6.8) ────────────────────────────────────

/** The public round-robin landing (marketing + format gallery). Indexable. */
export const roundRobinLanding = (): string => "/round-robin";

/** The no-login create flow. noindex (an authoring surface). */
export const roundRobinNewPath = (): string => "/round-robin/new";

/** The format-picker quiz. */
export const roundRobinQuizPath = (): string => "/round-robin/quiz";

/** Public, shareable event page (standings, rounds, champion). Indexable. */
export const roundRobinPath = (id: string): string => `/round-robin/${id}`;

/** The organizer's live run console (fast score entry). noindex. */
export const roundRobinLivePath = (id: string): string => `/round-robin/${id}/live`;

// ── tournaments (Stage 6, §7.1) ──────────────────────────────────────────────

/** The public tournaments hub (marketing + upcoming). Indexable. */
export const tournamentsHub = (): string => "/tournaments";

/** City tournament finder ("Pickleball Tournaments in {City}, {ST}"). Indexable. */
// Note the `/in/` segment: `/tournaments/[id]` (detail) and a bare
// `/tournaments/[country]/...` finder would collide as two dynamic segments at
// the same path level, so the city finder is namespaced under `/tournaments/in/`.
export const tournamentsCityPath = (country: string, state: string, city: string): string =>
  `/tournaments/in/${country}/${state}/${city}`;

/** Build the city tournament-finder URL from a bare cityKey (for interlinks). */
export function tournamentsCityPathFromKey(cityKey: string): string {
  const { country, state, city } = parseCityKey(cityKey);
  return tournamentsCityPath(country, state, city);
}

/** Public tournament detail page. Indexable. */
export const tournamentPath = (id: string): string => `/tournaments/${id}`;

/**
 * Registration + checkout (§10). A payment surface — noindex, NO ads. An optional
 * `division` preselects a division on arrival (deep-linked "Register" CTA).
 */
export const tournamentRegisterPath = (id: string, division?: string): string =>
  division ? `/tournaments/${id}/register?division=${division}` : `/tournaments/${id}/register`;

/** Live bracket / results for a tournament. Indexable. */
export const tournamentBracketPath = (id: string, division?: string): string =>
  division ? `/tournaments/${id}/bracket?division=${division}` : `/tournaments/${id}/bracket`;

/** The organizer create wizard. noindex (an authoring + payment surface). */
export const organizeTournamentNew = (): string => "/organize/tournaments/new";

/** The organizer dashboard for a single tournament. noindex, NO ads. */
export const organizeTournamentPath = (id: string): string => `/organize/tournaments/${id}`;
