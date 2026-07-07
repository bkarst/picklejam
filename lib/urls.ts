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

/** City leaderboard path (§G12.9) — reuses the geo trail under `/leaderboards`. */
export const cityLeaderboardPath = (country: string, state: string, city: string): string =>
  `/leaderboards/${country}/${state}/${city}`;

/** Build a city's leaderboard URL from its item. */
export function cityLeaderboardUrl(city: Pick<CityItem, "country" | "state" | "slug">): string {
  return cityLeaderboardPath(city.country, city.state, city.slug);
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

// ── leagues (Stage 7, §7.2/§7.3) ─────────────────────────────────────────────

/** The public leagues hub (marketing + how-it-works). Indexable. */
export const leaguesHub = (): string => "/leagues";

/**
 * City league finder ("Pickleball Leagues in {City}, {ST}"). Indexable.
 * Note the static `/in/` segment: `/leagues/[id]` (detail) and a bare
 * `/leagues/[country]/...` finder would collide as two dynamic segments at the
 * same level (`next start` throws), so the city finder is namespaced under `/in`.
 */
export const leaguesCityPath = (country: string, state: string, city: string): string =>
  `/leagues/in/${country}/${state}/${city}`;

/** Build the city league-finder URL from a bare cityKey (for interlinks). */
export function leaguesCityPathFromKey(cityKey: string): string {
  const { country, state, city } = parseCityKey(cityKey);
  return leaguesCityPath(country, state, city);
}

/** Public league detail page (Event + Offer). Indexable. */
export const leaguePath = (id: string): string => `/leagues/${id}`;

/**
 * League registration + checkout (§10). A payment surface — noindex, NO ads. An
 * optional `division` (flight) preselects it on arrival (deep-linked "Register").
 */
export const leagueRegisterPath = (id: string, division?: string): string =>
  division ? `/leagues/${id}/register?division=${division}` : `/leagues/${id}/register`;

/** Public league standings + weekly schedule + playoff bracket. Indexable. */
export const leagueStandingsPath = (id: string): string => `/leagues/${id}/standings`;

/** The participant console (this-week matchup, scores, availability). noindex, NO ads. */
export const leagueMyTeamPath = (id: string): string => `/leagues/${id}/my-team`;

// ── ladders (Stage 7, §7.4) ──────────────────────────────────────────────────

/** The public ladders hub (marketing + how-it-works). Indexable. */
export const laddersHub = (): string => "/ladders";

/** City ladder finder ("Pickleball Ladders in {City}, {ST}"). Indexable (static `/in/`). */
export const laddersCityPath = (country: string, state: string, city: string): string =>
  `/ladders/in/${country}/${state}/${city}`;

/** Build the city ladder-finder URL from a bare cityKey (for interlinks). */
export function laddersCityPathFromKey(cityKey: string): string {
  const { country, state, city } = parseCityKey(cityKey);
  return laddersCityPath(country, state, city);
}

/** Public ladder board (ranked RUNG# table + movement). Indexable. */
export const ladderPath = (id: string): string => `/ladders/${id}`;

/** The player's challenge console (issue/respond/report). noindex, NO ads. */
export const ladderChallengesPath = (id: string): string => `/ladders/${id}/challenges`;

/** Ladder registration + checkout (§10). A payment surface — noindex, NO ads. */
export const ladderRegisterPath = (id: string): string => `/ladders/${id}/register`;

// ── organizer (leagues + ladders share one create wizard, §7.2/§7.4) ─────────

/** The organizer create wizard (league OR ladder — a format toggle). noindex. */
export const organizeLeagueNew = (): string => "/organize/leagues/new";

/** The organizer dashboard for a single league/ladder. noindex, NO ads. */
export const organizeLeaguePath = (id: string): string => `/organize/leagues/${id}`;

// ── groups & clubs (Stage 8, §6.9) ───────────────────────────────────────────

/** The public groups hub (what groups are + create/find CTA). Indexable. */
export const groupsHub = (): string => "/groups";

/** The create-a-group form. noindex (an authoring surface). Static, so it sits
 *  safely beside the `/groups/[id]` detail segment. */
export const groupNewPath = (): string => "/groups/new";

/** Public group detail page. `noindex` unless the group is public (page-level). */
export const groupPath = (id: string): string => `/groups/${id}`;

/** The owner/admin manage console (roster, approvals, invites, settings). noindex. */
export const groupManagePath = (id: string): string => `/groups/${id}/manage`;

/**
 * City group finder ("Pickleball Groups & Clubs in {City}, {ST}"). Indexable —
 * PUBLIC groups only. Note the static `/in/` segment: `/groups/[id]` (detail) and a
 * bare `/groups/[country]/...` finder would collide as two dynamic segments at the
 * same level (`next start` throws), so the city finder is namespaced under `/in`.
 */
export const groupsCityPath = (country: string, state: string, city: string): string =>
  `/groups/in/${country}/${state}/${city}`;

/** Build the city group-finder URL from a bare cityKey (for interlinks). */
export function groupsCityPathFromKey(cityKey: string): string {
  const { country, state, city } = parseCityKey(cityKey);
  return groupsCityPath(country, state, city);
}

// ── unified "near me" finder (§6.9/§7.x) ─────────────────────────────────────

/**
 * The unified finder for groups / leagues / ladders / tournaments near you. A
 * personalized JS utility → NOINDEX (canonical discovery is the per-city finder
 * pages); the descriptive slug is for humans sharing the link. Optional `type`
 * deep-links a tab.
 */
export const discoverPath = (type?: "groups" | "leagues" | "ladders" | "tournaments"): string =>
  type ? `/discover-pickleball-near-me?type=${type}` : "/discover-pickleball-near-me";

// ── Content Hub /learn + News /news (Stage 9, §6.5/§6.6) ─────────────────────
//
// Route-collision note (next-conventions.md): `/learn/authors` and
// `/news/topics` are STATIC segments that sit beside their dynamic siblings
// (`/learn/[category]`, `/news/[slug]`). A static segment always wins over a
// sibling dynamic one, so this is allowed — only TWO different dynamic names at
// the same level would conflict.

/** The Content Hub index ("Learn Pickleball"). Indexable. */
export const learnHub = (): string => "/learn";

/** A category feed ("How to Play", "Rules", "Gear"…). Indexable. */
export const learnCategoryPath = (category: string): string => `/learn/${category}`;

/** An evergreen article detail page (ISR 86400). Indexable. */
export const articlePath = (category: string, slug: string): string =>
  `/learn/${category}/${slug}`;

/** An author profile (E-E-A-T). Static `/learn/authors/` segment. Indexable. */
export const authorPath = (slug: string): string => `/learn/authors/${slug}`;

/** The News index ("Pickleball News", ISR 900). Indexable. */
export const newsHub = (): string => "/news";

/** A news topic feed. Static `/news/topics/` segment. Indexable. */
export const newsTopicPath = (topic: string): string => `/news/topics/${topic}`;

/** A dated news article detail page. Indexable. */
export const newsArticlePath = (slug: string): string => `/news/${slug}`;

// ── system / marketing + legal pages (Stage 10, §16) ─────────────────────────

/** The pricing / how-it-works page (free tools vs paid events). Indexable. */
export const pricingPath = (): string => "/pricing";

/** The about / mission page (E-E-A-T). Indexable. */
export const aboutPath = (): string => "/about";

/** The contact page (support email + socials + form). Indexable. */
export const contactPath = (): string => "/contact";

/** A legal document page (terms, privacy, cookies, …). Indexable. */
export const legalPath = (doc: string): string => `/legal/${doc}`;
