/**
 * sitemap.ts — the segmented-sitemap FRAMEWORK (PRD §3.7).
 *
 * §3.7 names nine segments: courts, cities, states, countries, tournaments,
 * leagues, groups, content, news. Each is REGISTERED here now (Stage 0) with an
 * async `entries()` that returns `[]`; each stage fills in its own segment (see
 * the `// TODO(Stage N)` markers). `app/sitemap.ts` emits one sitemap per
 * registered segment (plus a `static` segment) via `generateSitemaps`.
 *
 * Also provides:
 *   - `lastmodOf(...)` — the §3.7 court `lastmod` rule as a pure function.
 *   - `staticRoutes()` — the known static pages as sitemap entries.
 */

import type { MetadataRoute } from "next";
import { siteUrl } from "@/brand.config";
import { getCountries, getStatesInCountry, getCitiesInState } from "@/lib/data/geo";
import { getCourtsInCity } from "@/lib/data/courts";
import { getCityGames } from "@/lib/data/outings";
import { getTournamentsInCity } from "@/lib/data/tournaments";
import { parseCityKey } from "@/lib/db/keys";
import {
  countryUrl,
  stateUrl,
  cityUrl,
  courtUrl,
  outingPath,
  tournamentPath,
  tournamentsCityPath,
} from "@/lib/urls";
import type { StateItem, CityItem } from "@/lib/db/types";

/** The §3.7 sitemap segment ids (+ `outings`, added Stage 4). */
export type SitemapSegmentId =
  | "courts"
  | "cities"
  | "states"
  | "countries"
  | "tournaments"
  | "leagues"
  | "groups"
  | "content"
  | "news"
  | "outings";

export interface SitemapSegment {
  id: SitemapSegmentId;
  /** Sitemap entries for this segment. Stage 0: `[]` (registered but empty). */
  entries: () => Promise<MetadataRoute.Sitemap>;
}

// ── directory-segment traversal (Stage 1) ────────────────────────────────────
//
// The countries/states/cities/courts segments are built by walking the geo graph
// through the read repositories (one Query per node — NEVER a scan):
//   getCountries → getStatesInCountry → getCitiesInState → getCourtsInCity.
//
// !! SCALE CAVEAT !! This is O(#cities) DynamoDB Queries for the `courts`
// segment (one per city), fanned out with Promise.all. That is fine for a
// SCHEDULED sitemap regeneration at seed scale (~9.7K cities / ~16K courts, §14).
// At full US scale it will (a) exceed the 50,000-URL-per-sitemap limit and (b)
// warrant a bounded/throttled fan-out. TODO(scale): split each segment across
// multiple `generateSitemaps` ids (id = page number, 50k URLs/page) and page the
// traversal, per next-conventions.md §9. The empty-DB case returns `[]` cleanly.

/** All states across every country, flattened (one Query per country). */
async function allStates(): Promise<StateItem[]> {
  const countries = await getCountries();
  const lists = await Promise.all(countries.map((c) => getStatesInCountry(c.code)));
  return lists.flat();
}

/** All cities across every state, flattened (one Query per state). */
async function allCities(): Promise<CityItem[]> {
  const states = await allStates();
  const lists = await Promise.all(states.map((s) => getCitiesInState(s.country, s.code)));
  return lists.flat();
}

/** Build one absolute-URL sitemap entry, omitting `lastModified` when unknown. */
function directoryEntry(
  path: string,
  lastModified: Date | undefined,
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>,
  priority: number,
): MetadataRoute.Sitemap[number] {
  return {
    url: `${siteUrl}${path}`,
    ...(lastModified ? { lastModified } : {}),
    changeFrequency,
    priority,
  };
}

/**
 * The segment registry. Every entry is wired up but empty until its stage
 * populates it. Populate rules (§3.7): only entities that clear the §14.4
 * content threshold, each with an accurate `<lastmod>` (courts use
 * {@link lastmodOf}; static/marketing pages omit `lastmod` to avoid rebuild churn).
 */
export const sitemapSegments: Record<SitemapSegmentId, SitemapSegment> = {
  courts: {
    id: "courts",
    entries: async () => {
      // Walk country→state→city→court. Only INDEXABLE courts (`indexable !== false`)
      // reach the sitemap — the §14.4 thin-content gate (getCourtsInCity has already
      // dropped hidden/deleted/non-pickleball). Per §3.7 the court `lastmod` uses
      // only updatedAt here (review/game timestamps land in a later stage).
      const cities = await allCities();
      const courtLists = await Promise.all(
        cities.map((city) => getCourtsInCity(city.country, city.state, city.slug)),
      );
      return courtLists
        .flat()
        .filter((court) => court.indexable !== false)
        .map((court) =>
          directoryEntry(
            courtUrl(court),
            lastmodOf({ updatedAt: court.updatedAt }),
            "weekly",
            0.8,
          ),
        );
    },
  },
  cities: {
    id: "cities",
    entries: async () => {
      const cities = await allCities();
      return cities.map((city) =>
        directoryEntry(cityUrl(city), lastmodOf({ updatedAt: city.updatedAt }), "weekly", 0.7),
      );
    },
  },
  states: {
    id: "states",
    entries: async () => {
      const states = await allStates();
      return states.map((state) =>
        directoryEntry(stateUrl(state), lastmodOf({ updatedAt: state.updatedAt }), "monthly", 0.5),
      );
    },
  },
  countries: {
    id: "countries",
    entries: async () => {
      const countries = await getCountries();
      return countries.map((country) =>
        directoryEntry(
          countryUrl(country),
          lastmodOf({ updatedAt: country.updatedAt }),
          "monthly",
          0.4,
        ),
      );
    },
  },
  tournaments: {
    id: "tournaments",
    entries: async () => {
      // Published tournaments + the city finder pages that list them. Bounded
      // traversal: one GSI2 Query per city (§9.5 #17), fanned out with Promise.all.
      //
      // !! SCALE CAVEAT !! O(#cities) Queries — fine at seed scale behind a
      // scheduled regeneration (same caveat as the `courts`/`outings` segments).
      // TODO(scale): back this with a dedicated upcoming-tournaments index and page
      // across `generateSitemaps` ids once tournaments grow past 50k URLs.
      const cities = await allCities();
      const perCity = await Promise.all(
        cities.map(async (city) => ({ city, tournaments: await getTournamentsInCity(city.cityKey) })),
      );
      const seen = new Set<string>();
      const out: MetadataRoute.Sitemap = [];
      for (const { city, tournaments } of perCity) {
        if (tournaments.length === 0) continue;
        // The city finder landing.
        const { country, state, city: citySlug } = parseCityKey(city.cityKey);
        out.push(
          directoryEntry(tournamentsCityPath(country, state, citySlug), undefined, "daily", 0.6),
        );
        // Each published tournament detail page (deduped across nearby-city lists).
        for (const t of tournaments) {
          if (seen.has(t.tid)) continue;
          seen.add(t.tid);
          out.push(
            directoryEntry(tournamentPath(t.tid), lastmodOf({ updatedAt: t.updatedAt }), "daily", 0.7),
          );
        }
      }
      return out;
    },
  },
  leagues: {
    id: "leagues",
    entries: async () => {
      // TODO(Stage 7): populate from LEAGUE/LADDER items + city/location finders.
      return [];
    },
  },
  groups: {
    id: "groups",
    entries: async () => {
      // TODO(Stage 8): populate from PUBLIC GROUP items + city group finders
      // (private/unlisted groups are excluded / noindex).
      return [];
    },
  },
  content: {
    id: "content",
    entries: async () => {
      // TODO(Stage 9): populate from CONTENT (learn) articles/categories/authors.
      return [];
    },
  },
  news: {
    id: "news",
    entries: async () => {
      // TODO(Stage 9): populate from NEWS articles/topics (+ Google News sitemap).
      return [];
    },
  },
  outings: {
    id: "outings",
    entries: async () => {
      // Public outings only. Bounded traversal: every city × the next ~7 days via
      // getCityGames (§9.5). Recurring/multi-day games surface once (dedup by id).
      //
      // !! SCALE CAVEAT !! O(#cities × 7) Queries — fine at seed scale behind a
      // scheduled regeneration, same caveat as the `courts` segment above.
      // TODO(scale): back this with a dedicated upcoming-outings GSI / precomputed
      // index and page across `generateSitemaps` ids once games grow past 50k URLs.
      const cities = await allCities();
      const days = nextDaysYyyymmdd(7);
      const perCity = await Promise.all(
        cities.map(async (city) => {
          const lists = await Promise.all(days.map((d) => getCityGames(city.cityKey, d)));
          return lists.flat();
        }),
      );
      const seen = new Set<string>();
      const out: MetadataRoute.Sitemap = [];
      for (const outing of perCity.flat()) {
        if (outing.visibility !== "public" || seen.has(outing.outingId)) continue;
        seen.add(outing.outingId);
        out.push(
          directoryEntry(
            outingPath(outing.outingId),
            lastmodOf({ updatedAt: outing.updatedAt }),
            "daily",
            0.6,
          ),
        );
      }
      return out;
    },
  },
};

/** yyyymmdd for today .. today+N-1 (UTC), for the bounded games traversal. */
function nextDaysYyyymmdd(count: number): string[] {
  const out: string[] = [];
  const base = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() + i);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    out.push(`${y}${m}${day}`);
  }
  return out;
}

/**
 * The §3.7 `lastmod` rule as a pure function:
 * `lastmod = max(META.updatedAt, last review create/edit/delete, last game/outing added)`.
 * Deliberately EXCLUDES the high-churn ephemeral counters (§3.6): the daily
 * "checked-in today" tally and review "helpful"-vote ticks — bumping `lastmod`
 * on those would erode the sitewide signal (Google trusts `lastmod` all-or-nothing).
 *
 * Returns the latest valid date, or `undefined` if none were provided.
 */
export function lastmodOf(input: {
  updatedAt?: string | Date | null;
  lastReviewAt?: string | Date | null;
  lastGameAt?: string | Date | null;
}): Date | undefined {
  const toDate = (v: string | Date | null | undefined): Date | undefined => {
    if (!v) return undefined;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d;
  };

  const dates = [input.updatedAt, input.lastReviewAt, input.lastGameAt]
    .map(toDate)
    .filter((d): d is Date => d !== undefined);

  if (dates.length === 0) return undefined;
  return dates.reduce((a, b) => (b.getTime() > a.getTime() ? b : a));
}

/**
 * Static / marketing pages that are always present (home + top-level hubs).
 * `lastModified` is intentionally omitted: these pages change with deploys, and
 * a build-timestamp `lastmod` would churn the sitewide signal (§3.7).
 */
const STATIC_ROUTES: ReadonlyArray<{
  path: string;
  priority: number;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
}> = [
  { path: "/", priority: 1.0, changeFrequency: "daily" },
  { path: "/courts", priority: 0.9, changeFrequency: "weekly" },
  { path: "/learn", priority: 0.7, changeFrequency: "weekly" },
  { path: "/news", priority: 0.7, changeFrequency: "daily" },
  { path: "/round-robin", priority: 0.8, changeFrequency: "monthly" },
  { path: "/tournaments", priority: 0.8, changeFrequency: "weekly" },
  { path: "/leagues", priority: 0.8, changeFrequency: "weekly" },
  { path: "/ladders", priority: 0.7, changeFrequency: "weekly" },
  { path: "/groups", priority: 0.7, changeFrequency: "weekly" },
  { path: "/pricing", priority: 0.6, changeFrequency: "monthly" },
  { path: "/about", priority: 0.5, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.4, changeFrequency: "monthly" },
];

/** The static pages as absolute-URL sitemap entries. */
export function staticRoutes(): MetadataRoute.Sitemap {
  return STATIC_ROUTES.map((r) => ({
    url: `${siteUrl}${r.path === "/" ? "" : r.path}`,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}

/**
 * Absolute URLs of every generated segment sitemap (+ the `static` segment).
 *
 * `app/sitemap.ts` uses `generateSitemaps`, so Next 16 emits each segment at
 * `/sitemap/<id>.xml` and does NOT produce a `/sitemap.xml` index (and reserves
 * that path). `robots.txt` (§3.7) therefore enumerates these directly — the
 * sitemaps protocol + Google both support multiple `Sitemap:` entries.
 */
export function sitemapUrls(): string[] {
  const ids = [...Object.keys(sitemapSegments), "static"];
  return ids.map((id) => `${siteUrl}/sitemap/${id}.xml`);
}
