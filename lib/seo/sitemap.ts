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
import { siteUrl, brand } from "@/brand.config";
import { getCountries, getStatesInCountry, getCitiesInState } from "@/lib/data/geo";
import { getCourtsInCity } from "@/lib/data/courts";
import { getCityGames } from "@/lib/data/outings";
import { getTournamentsInCity } from "@/lib/data/tournaments";
import { getLeaguesInCity } from "@/lib/data/leagues";
import { getLaddersInCity } from "@/lib/data/ladders";
import { getGroupsInCity } from "@/lib/data/groups";
import {
  getContentByCategory,
  getAuthor,
  listCategories,
  getNewsFeed,
  listNewsTopics,
} from "@/lib/data/content";
import { parseCityKey } from "@/lib/db/keys";
import {
  countryUrl,
  stateUrl,
  cityUrl,
  courtUrl,
  outingPath,
  tournamentPath,
  tournamentsCityPath,
  leaguePath,
  leaguesCityPath,
  ladderPath,
  laddersCityPath,
  groupPath,
  groupsCityPath,
  blogCategoryPath,
  articlePath,
  authorPath,
  newsArticlePath,
  newsTopicPath,
  pricingPath,
  aboutPath,
  contactPath,
  legalPath,
} from "@/lib/urls";
import { LEGAL_DOC_SLUGS } from "@/lib/legal/docs";
import type { StateItem, CityItem } from "@/lib/db/types";

/** The §3.7 sitemap segment ids (+ `outings` Stage 4, `marketing`/`legal` Stage 10). */
export type SitemapSegmentId =
  | "courts"
  | "cities"
  | "states"
  | "countries"
  | "tournaments"
  | "leagues"
  | "ladders"
  | "groups"
  | "content"
  | "news"
  | "outings"
  | "marketing"
  | "legal";

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
      // Published leagues + the city finder pages that list them. Bounded
      // traversal: one GSI2 Query per city (§9.5 #20), fanned out with Promise.all.
      // Register/console/organize surfaces are noindex → NEVER in the sitemap.
      //
      // !! SCALE CAVEAT !! O(#cities) Queries — fine at seed scale behind a
      // scheduled regeneration (same caveat as the `tournaments` segment).
      const cities = await allCities();
      const perCity = await Promise.all(
        cities.map(async (city) => ({ city, leagues: await getLeaguesInCity(city.cityKey) })),
      );
      const seen = new Set<string>();
      const out: MetadataRoute.Sitemap = [];
      for (const { city, leagues } of perCity) {
        if (leagues.length === 0) continue;
        const { country, state, city: citySlug } = parseCityKey(city.cityKey);
        out.push(directoryEntry(leaguesCityPath(country, state, citySlug), undefined, "daily", 0.6));
        for (const l of leagues) {
          if (seen.has(l.lid)) continue;
          seen.add(l.lid);
          out.push(directoryEntry(leaguePath(l.lid), lastmodOf({ updatedAt: l.updatedAt }), "daily", 0.7));
        }
      }
      return out;
    },
  },
  ladders: {
    id: "ladders",
    entries: async () => {
      // Published ladders + their city finder pages (§9.5 #20 / #22). Same bounded
      // per-city traversal + scale caveat as the `leagues` segment above.
      const cities = await allCities();
      const perCity = await Promise.all(
        cities.map(async (city) => ({ city, ladders: await getLaddersInCity(city.cityKey) })),
      );
      const seen = new Set<string>();
      const out: MetadataRoute.Sitemap = [];
      for (const { city, ladders } of perCity) {
        if (ladders.length === 0) continue;
        const { country, state, city: citySlug } = parseCityKey(city.cityKey);
        out.push(directoryEntry(laddersCityPath(country, state, citySlug), undefined, "daily", 0.5));
        for (const l of ladders) {
          if (seen.has(l.lid)) continue;
          seen.add(l.lid);
          out.push(directoryEntry(ladderPath(l.lid), lastmodOf({ updatedAt: l.updatedAt }), "daily", 0.6));
        }
      }
      return out;
    },
  },
  groups: {
    id: "groups",
    entries: async () => {
      // PUBLIC groups + the city group-finder pages that list them (§9.5 #28).
      // `getGroupsInCity` returns PUBLIC groups only, so private/unlisted groups
      // (which the detail page renders `noindex`) never reach the sitemap. Bounded
      // traversal: one GSI Query per city, fanned out with Promise.all.
      //
      // !! SCALE CAVEAT !! O(#cities) Queries — fine at seed scale behind a
      // scheduled regeneration (same caveat as the `leagues`/`ladders` segments).
      const cities = await allCities();
      const perCity = await Promise.all(
        cities.map(async (city) => ({ city, groups: await getGroupsInCity(city.cityKey) })),
      );
      const seen = new Set<string>();
      const out: MetadataRoute.Sitemap = [];
      for (const { city, groups } of perCity) {
        if (groups.length === 0) continue;
        const { country, state, city: citySlug } = parseCityKey(city.cityKey);
        out.push(directoryEntry(groupsCityPath(country, state, citySlug), undefined, "weekly", 0.5));
        for (const g of groups) {
          if (seen.has(g.groupId)) continue;
          seen.add(g.groupId);
          out.push(
            directoryEntry(groupPath(g.groupId), lastmodOf({ updatedAt: g.updatedAt }), "weekly", 0.5),
          );
        }
      }
      return out;
    },
  },
  content: {
    id: "content",
    entries: async () => {
      // The Content Hub (§6.5): every category feed + published article + author
      // page. Walk categories → articles (pattern 14, one GSI2 Query per
      // category), deduping and collecting the distinct author ids for their
      // ProfilePages. Only PUBLISHED articles reach the sitemap.
      const categories = await listCategories();
      const perCategory = await Promise.all(
        categories.map(async (c) => ({ c, items: await getContentByCategory(c.category) })),
      );

      const out: MetadataRoute.Sitemap = [];
      const seen = new Set<string>();
      const authorIds = new Set<string>();
      for (const { c, items } of perCategory) {
        const published = items.filter((i) => i.status === "published");
        // The category landing (omitted when it has no published content).
        if (published.length > 0) {
          out.push(directoryEntry(blogCategoryPath(c.category), undefined, "weekly", 0.6));
        }
        for (const item of published) {
          if (seen.has(item.id)) continue;
          seen.add(item.id);
          if (item.authorId) authorIds.add(item.authorId);
          out.push(
            directoryEntry(
              articlePath(item.category, item.slug),
              lastmodOf({ updatedAt: item.updatedAt }),
              "monthly",
              0.7,
            ),
          );
        }
      }

      // Author ProfilePages (E-E-A-T) — resolve each distinct id to its slug.
      const authors = await Promise.all([...authorIds].map((id) => getAuthor(id)));
      for (const a of authors) {
        if (!a) continue;
        out.push(
          directoryEntry(authorPath(a.slug), lastmodOf({ updatedAt: a.updatedAt }), "monthly", 0.4),
        );
      }
      return out;
    },
  },
  news: {
    id: "news",
    entries: async () => {
      // News (§6.6): every published news article + topic feed. `getNewsFeed`
      // returns the recency-ordered GSI2 `NEWS#ALL` feed (pattern 15). The
      // separate Google-News sitemap (last-48h only) lives at `/news-sitemap.xml`
      // via {@link newsGoogleSitemapXml}; this segment is the FULL crawl index.
      const [feed, topics] = await Promise.all([getNewsFeed(1000), listNewsTopics()]);
      const out: MetadataRoute.Sitemap = [];
      for (const t of topics) {
        out.push(directoryEntry(newsTopicPath(t.topic), undefined, "daily", 0.5));
      }
      const seen = new Set<string>();
      for (const n of feed) {
        if (n.status !== "published" || seen.has(n.id)) continue;
        seen.add(n.id);
        out.push(
          directoryEntry(newsArticlePath(n.slug), lastmodOf({ updatedAt: n.updatedAt }), "daily", 0.6),
        );
      }
      return out;
    },
  },
  marketing: {
    id: "marketing",
    // The system / marketing pages (§16): pricing, about, contact. Static content
    // with no per-entity churn, so `lastmod` is omitted (same rule as the `static`
    // segment) to avoid bumping the sitewide signal on every deploy (§3.7).
    entries: async () => [
      directoryEntry(pricingPath(), undefined, "monthly", 0.6),
      directoryEntry(aboutPath(), undefined, "monthly", 0.5),
      directoryEntry(contactPath(), undefined, "monthly", 0.4),
    ],
  },
  legal: {
    id: "legal",
    // The six legal documents (§16). Indexable, static boilerplate — `lastmod`
    // omitted for the same reason as the `marketing` segment.
    entries: async () =>
      LEGAL_DOC_SLUGS.map((slug) => directoryEntry(legalPath(slug), undefined, "yearly", 0.3)),
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
  { path: "/blog", priority: 0.7, changeFrequency: "weekly" },
  { path: "/news", priority: 0.7, changeFrequency: "daily" },
  { path: "/round-robin", priority: 0.8, changeFrequency: "monthly" },
  { path: "/tournaments", priority: 0.8, changeFrequency: "weekly" },
  { path: "/leagues", priority: 0.8, changeFrequency: "weekly" },
  { path: "/ladders", priority: 0.7, changeFrequency: "weekly" },
  { path: "/groups", priority: 0.7, changeFrequency: "weekly" },
  // pricing / about / contact live in the `marketing` sitemap segment (§16), and
  // the six legal docs in the `legal` segment — not duplicated here.
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
 * Absolute URLs of every generated SEGMENT sitemap (each `/sitemap/<id>.xml`,
 * including the `static` segment). This is the exact set the sitemap INDEX lists.
 *
 * `app/sitemap.ts` uses `generateSitemaps`, so Next 16 emits each segment at
 * `/sitemap/<id>.xml` and does NOT itself produce an index. We fill that gap with
 * a hand-built index ({@link sitemapIndexXml}) served at {@link SITEMAP_INDEX_PATH}
 * so there is ONE submittable entry point. (It can't live at the conventional
 * `/sitemap.xml` — Next reserves that path for the metadata convention, so a route
 * handler there is a build-time "Conflicting route and metadata" error.)
 *
 * Deliberately EXCLUDES the Google-News sitemap ({@link NEWS_SITEMAP_PATH}): it's
 * a distinct `<news:news>` feed (48h window, submitted to Google News on its own),
 * not a general-crawl sitemap, so it does not belong in the crawl index.
 */
export function segmentSitemapUrls(): string[] {
  const ids = [...Object.keys(sitemapSegments), "static"];
  return ids.map((id) => `${siteUrl}/sitemap/${id}.xml`);
}

/** Public path of the single sitemap INDEX — the one submittable entry point. */
export const SITEMAP_INDEX_PATH = "/sitemap-index.xml";

/** Absolute URL of the sitemap index — what `robots.txt` advertises (§3.7). */
export function sitemapIndexUrl(): string {
  return `${siteUrl}${SITEMAP_INDEX_PATH}`;
}

/**
 * Build the sitemap INDEX document: a `<sitemapindex>` listing every segment
 * sitemap ({@link segmentSitemapUrls}). `<lastmod>` is intentionally omitted —
 * the segments have no single natural mod time, and a build-timestamp would churn
 * the sitewide signal on every deploy (same rule as the static/marketing entries).
 */
export function sitemapIndexXml(): string {
  const entries = segmentSitemapUrls()
    .map((loc) => `  <sitemap>\n    <loc>${xmlEscape(loc)}</loc>\n  </sitemap>`)
    .join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    "</sitemapindex>",
    "",
  ].join("\n");
}

// ── Google News sitemap (§6.6) ───────────────────────────────────────────────
//
// A DISTINCT sitemap from the `news` crawl segment above. Google News requires a
// `<news:news>` block with a `<news:publication>` and only accepts articles
// published in the LAST 48 HOURS (per the Google News sitemap spec — older items
// must be dropped or Search Console flags them). We therefore emit a hand-built
// XML document (the `MetadataRoute.Sitemap` type has no `news:` extension) served
// at `/news-sitemap.xml` by `app/news-sitemap.xml/route.ts`.

/** Public path of the Google-News sitemap. */
export const NEWS_SITEMAP_PATH = "/news-sitemap.xml";

/** The Google-News freshness window: 48h (2 days), per the Google News spec. */
export const NEWS_SITEMAP_WINDOW_MS = 48 * 60 * 60 * 1000;

/** Minimal XML entity-escaping for text nodes (loc/title/name). */
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Build the Google-News sitemap XML: every PUBLISHED news item from the last
 * {@link NEWS_SITEMAP_WINDOW_MS} (48h), newest first. `now` is injectable for
 * deterministic tests (§14.1). Returns a complete `<urlset>` document string.
 */
export async function newsGoogleSitemapXml(now: Date = new Date()): Promise<string> {
  const cutoff = now.getTime() - NEWS_SITEMAP_WINDOW_MS;
  const feed = await getNewsFeed(1000);
  const fresh = feed
    .filter((n) => n.status === "published" && new Date(n.publishedAt).getTime() >= cutoff)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  const urls = fresh
    .map((n) => {
      const loc = xmlEscape(`${siteUrl}${newsArticlePath(n.slug)}`);
      return [
        "  <url>",
        `    <loc>${loc}</loc>`,
        "    <news:news>",
        "      <news:publication>",
        `        <news:name>${xmlEscape(brand.identity.name)}</news:name>`,
        "        <news:language>en</news:language>",
        "      </news:publication>",
        `      <news:publication_date>${xmlEscape(new Date(n.publishedAt).toISOString())}</news:publication_date>`,
        `      <news:title>${xmlEscape(n.title)}</news:title>`,
        "    </news:news>",
        "  </url>",
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">',
    urls,
    "</urlset>",
    "",
  ]
    .filter((line) => line !== "")
    .join("\n");
}
