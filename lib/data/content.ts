/**
 * content.ts — Content Hub + News data layer (PRD §6.5/§6.6, §9.5 patterns 14/15).
 *
 * Evergreen guides/gear (CONTENT#) + dated news (NEWS#) are DB-stored with a
 * trusted MARKDOWN body and structured fields (key-takeaways / FAQ / related-city
 * CTA / source attribution). Reads are SEO/SSG surfaces — no auth. Every §9.5 read
 * is a SINGLE keyed Query/GetItem (a BatchGet hydration is allowed — not a scan):
 *
 *   Pattern 14 (content):
 *     #getContentBySlug   → GSI3 `CONTENTSLUG#<category>#<slug>`  (one Query)
 *     #getContentByCategory→ GSI2 `CONTENTCAT#<category>` recency-desc, PUBLISHED
 *     #getContentByAuthor  → GSI1 `AUTHOR#<id>` recency-desc
 *     #getAuthor / BySlug  → base GetItem / GSI3 `AUTHORSLUG#<slug>`
 *   Pattern 15 (news):
 *     #getNewsBySlug   → GSI3 `NEWSSLUG#<slug>` (one Query)
 *     #getNewsFeed     → GSI2 `NEWS#ALL` recency-desc, PUBLISHED
 *     #getNewsByTopic  → GSI2 `NEWSTOPIC#<topic>` recency-desc (topic-pointer fan-out)
 *
 * ── related-local CTA is never orphaned (§12 rule 4) ─────────────────────────
 * `createContent` VALIDATES `relatedCityKey` resolves to a REAL city via
 * {@link getCity}; an orphan key is DROPPED (+ warned) so the rendered "pickleball
 * in <City>" CTA can only ever point at a live city page.
 *
 * ── news topic fan-out (pattern 15) ──────────────────────────────────────────
 * `createNews` writes the NEWS META (GSI2 all-feed + GSI3 slug) AND one lightweight
 * `NewsTopicPointerItem` per topic (each carrying the GSI2 `NEWSTOPIC#<topic>` key),
 * so one news item joins many per-topic feeds without duplicating the body.
 *
 * `listCategories` / `listNewsTopics` need a distinct-with-counts rollup that DynamoDB
 * can't express as a single keyed Query. Rather than scan, they traverse the KNOWN
 * category/topic vocabulary (small, curated) with one keyed Query each — documented
 * as a bounded fan-out (mirrors geo.ts#getTopCities); swap for a cached index if the
 * vocabulary ever grows large (§13).
 */

import { getItem, query, putItem, batchGet } from "@/lib/db/client";
import { GSI } from "@/lib/db/table";
import { contentKeys, newsKeys, parseCityKey } from "@/lib/db/keys";
import { slugify } from "@/lib/util/slug";
import { getCity } from "@/lib/data/geo";
import { readMinutes } from "@/lib/content/render";
import type {
  ContentItem,
  AuthorItem,
  NewsItem,
  NewsTopicPointerItem,
  FaqEntry,
  PublishStatus,
} from "@/lib/db/types";

const asItem = (o: object): Record<string, unknown> => o as unknown as Record<string, unknown>;

/**
 * The curated content categories + news topics. DynamoDB has no "SELECT DISTINCT",
 * so the distinct-with-counts listers iterate these known buckets (one keyed Query
 * each — never a scan). Seed/admin writes are expected to use these values.
 */
export const CONTENT_CATEGORIES = [
  "how-to-play",
  "for-beginners",
  "rules",
  "strategy",
  "gear",
  "guides",
] as const;
export const NEWS_TOPICS = ["pro-tour", "rules", "equipment", "events", "community"] as const;

// ── content reads (pattern 14) ────────────────────────────────────────────────

/** One GSI3 Query for a published article at `CONTENTSLUG#<category>#<slug>`. */
async function queryContentSlug(category: string, slug: string): Promise<ContentItem | undefined> {
  const { gsi3pk, gsi3sk } = contentKeys.bySlug(category, slug);
  const { items } = await query<ContentItem>({
    index: GSI.bySlug,
    pk: gsi3pk,
    skEquals: gsi3sk,
    limit: 1,
  });
  const item = items[0];
  return item && item.status === "published" ? item : undefined;
}

/**
 * Pattern 14 — resolve a published article by URL slug.
 *
 * FAST PATH — when the category is known (SSG pages usually have it), this is a
 * SINGLE GSI3 Query on `CONTENTSLUG#<category>#<slug>`. When the category is omitted
 * (the article route resolves by slug and validates the category itself), fall back
 * to a BOUNDED fan-out — one GSI3 Query per known {@link CONTENT_CATEGORIES} (never a
 * scan) — returning the first published match. Slugs are unique across categories in
 * practice, so the fan-out yields a single hit.
 */
export async function getContentBySlug(
  slug: string,
  category?: string,
): Promise<ContentItem | undefined> {
  if (category !== undefined) return queryContentSlug(category, slug);
  const results = await Promise.all(CONTENT_CATEGORIES.map((c) => queryContentSlug(c, slug)));
  return results.find((r) => r !== undefined);
}

/** An article META by id (GetItem) — cross-reference hydration. */
export async function getContent(id: string): Promise<ContentItem | undefined> {
  return getItem<ContentItem>(contentKeys.meta(id));
}

/**
 * Pattern 14 — the newest PUBLISHED articles in a category (GSI2 `CONTENTCAT#`,
 * recency-desc). Only published items carry the GSI2 keys (drafts are never
 * projected), so the status filter is belt-and-braces.
 */
export async function getContentByCategory(category: string, limit?: number): Promise<ContentItem[]> {
  const { items } = await query<ContentItem>({
    index: GSI.byLocation,
    pk: contentKeys.categoryPk(category),
    ascending: false, // gsi2sk = publishedAt → newest first
    ...(limit !== undefined ? { limit } : {}),
  });
  return items.filter((c) => c.status === "published");
}

/** Pattern 14 — an author's PUBLISHED articles (GSI1 `AUTHOR#<id>`), newest first. */
export async function getContentByAuthor(authorId: string): Promise<ContentItem[]> {
  const { items } = await query<ContentItem>({
    index: GSI.byOwner,
    pk: contentKeys.authorPk(authorId),
    ascending: false,
  });
  return items.filter((c) => c.entity === "CONTENT" && c.status === "published");
}

/** An author profile by id (GetItem) — E-E-A-T byline. */
export async function getAuthor(authorId: string): Promise<AuthorItem | undefined> {
  return getItem<AuthorItem>(contentKeys.author(authorId));
}

/** An author profile by URL slug (GSI3, one Query). */
export async function getAuthorBySlug(slug: string): Promise<AuthorItem | undefined> {
  const { gsi3pk, gsi3sk } = contentKeys.authorBySlug(slug);
  const { items } = await query<AuthorItem>({
    index: GSI.bySlug,
    pk: gsi3pk,
    skEquals: gsi3sk,
    limit: 1,
  });
  return items[0];
}

export interface CategorySummary {
  category: string;
  count: number;
  /** The newest published items (up to `sample`), for hub card previews. */
  latest: ContentItem[];
}

/**
 * Distinct content categories with published counts + a small preview sample.
 * Bounded fan-out over the KNOWN {@link CONTENT_CATEGORIES} — one keyed GSI2 Query
 * per category (never a scan). Empty categories are omitted.
 */
export async function listCategories(sample = 3): Promise<CategorySummary[]> {
  const summaries = await Promise.all(
    CONTENT_CATEGORIES.map(async (category) => {
      const items = await getContentByCategory(category);
      return { category, count: items.length, latest: items.slice(0, sample) };
    }),
  );
  return summaries.filter((s) => s.count > 0);
}

// ── news reads (pattern 15) ───────────────────────────────────────────────────

/** Pattern 15 — a published news item by URL slug (GSI3, one Query). */
export async function getNewsBySlug(slug: string): Promise<NewsItem | undefined> {
  const { gsi3pk, gsi3sk } = newsKeys.bySlug(slug);
  const { items } = await query<NewsItem>({
    index: GSI.bySlug,
    pk: gsi3pk,
    skEquals: gsi3sk,
    limit: 1,
  });
  const item = items[0];
  return item && item.status === "published" ? item : undefined;
}

/** A news META by id (GetItem). */
export async function getNews(id: string): Promise<NewsItem | undefined> {
  return getItem<NewsItem>(newsKeys.meta(id));
}

/**
 * Pattern 15 — the global "all news" feed (GSI2 `NEWS#ALL`, recency-desc, PUBLISHED
 * only). One keyed Query; newest first.
 */
export async function getNewsFeed(limit?: number): Promise<NewsItem[]> {
  const { items } = await query<NewsItem>({
    index: GSI.byLocation,
    pk: newsKeys.allFeedPk(),
    ascending: false, // gsi2sk = publishedAt
    ...(limit !== undefined ? { limit } : {}),
  });
  return items.filter((n) => n.status === "published");
}

/**
 * Pattern 15 — a per-topic news feed (GSI2 `NEWSTOPIC#<topic>`, recency-desc). The
 * Query returns lightweight topic-pointer rows; hydrate the full NEWS metas with one
 * BatchGet (not a scan), then re-order newest-first + drop any unpublished parents.
 */
export async function getNewsByTopic(topic: string, limit?: number): Promise<NewsItem[]> {
  const { items: pointers } = await query<NewsTopicPointerItem>({
    index: GSI.byLocation,
    pk: newsKeys.topicPk(topic),
    ascending: false,
    ...(limit !== undefined ? { limit } : {}),
  });
  if (pointers.length === 0) return [];
  const metas = await batchGet<NewsItem>(pointers.map((p) => newsKeys.meta(p.newsId)));
  const byId = new Map(metas.map((m) => [m.id, m]));
  return pointers
    .map((p) => byId.get(p.newsId))
    .filter((n): n is NewsItem => !!n && n.status === "published");
}

export interface TopicSummary {
  topic: string;
  count: number;
}

/**
 * Distinct news topics with published counts. Bounded fan-out over the KNOWN
 * {@link NEWS_TOPICS} — one keyed GSI2 Query per topic (never a scan). Empty topics
 * are omitted; ordered by count desc.
 */
export async function listNewsTopics(): Promise<TopicSummary[]> {
  const summaries = await Promise.all(
    NEWS_TOPICS.map(async (topic) => {
      const { items } = await query<NewsTopicPointerItem>({
        index: GSI.byLocation,
        pk: newsKeys.topicPk(topic),
      });
      return { topic, count: items.length };
    }),
  );
  return summaries.filter((s) => s.count > 0).sort((a, b) => b.count - a.count);
}

// ── writes (admin / seed) ─────────────────────────────────────────────────────

/**
 * Validate a `relatedCityKey` resolves to a REAL city page (§12 rule 4 — no orphan
 * links). Returns the key when it resolves, else `undefined` (dropped) with a warn.
 */
export async function resolveRelatedCity(relatedCityKey?: string): Promise<string | undefined> {
  if (!relatedCityKey) return undefined;
  const { country, state, city } = parseCityKey(relatedCityKey);
  if (!country || !state || !city) {
    console.warn(`[content] dropping malformed relatedCityKey: ${relatedCityKey}`);
    return undefined;
  }
  const resolved = await getCity(country, state, city);
  if (!resolved) {
    console.warn(`[content] dropping orphan relatedCityKey (no such city): ${relatedCityKey}`);
    return undefined;
  }
  return relatedCityKey;
}

export interface CreateContentInput {
  id: string;
  title: string;
  category: string;
  excerpt: string;
  body: string; // trusted markdown
  authorId: string;
  authorName?: string;
  slug?: string; // defaults to slugify(title)
  status?: PublishStatus; // default "published"
  keyTakeaways?: string[];
  faq?: FaqEntry[];
  relatedCityKey?: string;
  coverImage?: string;
  tags?: string[];
  readMinutes?: number; // computed from body when absent
  publishedAt?: string; // ISO; defaults to now
  now?: number; // DI for deterministic tests
}

/**
 * Create/overwrite a CONTENT META (guides/gear/rules). Projects GSI2 (category
 * feed) + GSI3 (slug) + GSI1 (author) ONLY when published, computes `readMinutes`
 * from the body when absent, and validates `relatedCityKey` resolves to a live city
 * (orphan → dropped). Idempotent by id (last write wins, §9.8).
 */
export async function createContent(input: CreateContentInput): Promise<ContentItem> {
  const now = input.now ?? Date.now();
  const iso = new Date(now).toISOString();
  const status: PublishStatus = input.status ?? "published";
  const slug = input.slug ?? slugify(input.title);
  const publishedAt = input.publishedAt ?? iso;
  const relatedCityKey = await resolveRelatedCity(input.relatedCityKey);

  const item: ContentItem = {
    ...contentKeys.meta(input.id),
    // Public index keys only when published — a draft never leaks into reads.
    ...(status === "published"
      ? {
          ...contentKeys.inCategory(input.category, publishedAt),
          ...contentKeys.bySlug(input.category, slug),
          ...contentKeys.byAuthor(input.authorId, publishedAt),
        }
      : {}),
    entity: "CONTENT",
    id: input.id,
    slug,
    category: input.category,
    title: input.title,
    excerpt: input.excerpt,
    body: input.body,
    ...(input.keyTakeaways ? { keyTakeaways: input.keyTakeaways } : {}),
    ...(input.faq ? { faq: input.faq } : {}),
    authorId: input.authorId,
    ...(input.authorName !== undefined ? { authorName: input.authorName } : {}),
    ...(relatedCityKey ? { relatedCityKey } : {}),
    ...(input.coverImage !== undefined ? { coverImage: input.coverImage } : {}),
    ...(input.tags ? { tags: input.tags } : {}),
    readMinutes: input.readMinutes ?? readMinutes(input.body),
    status,
    publishedAt,
    createdAt: iso,
    updatedAt: iso,
  };
  await putItem(asItem(item));
  return item;
}

export interface UpsertAuthorInput {
  authorId: string;
  name: string;
  slug?: string;
  bio?: string;
  avatarUrl?: string;
  credentials?: string;
  socials?: AuthorItem["socials"];
  now?: number;
}

/** Upsert an AUTHOR META + its GSI3 slug (E-E-A-T byline). Idempotent by id. */
export async function upsertAuthor(input: UpsertAuthorInput): Promise<AuthorItem> {
  const now = input.now ?? Date.now();
  const iso = new Date(now).toISOString();
  const slug = input.slug ?? slugify(input.name);
  const item: AuthorItem = {
    ...contentKeys.author(input.authorId),
    ...contentKeys.authorBySlug(slug),
    entity: "AUTHOR",
    authorId: input.authorId,
    slug,
    name: input.name,
    ...(input.bio !== undefined ? { bio: input.bio } : {}),
    ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
    ...(input.credentials !== undefined ? { credentials: input.credentials } : {}),
    ...(input.socials ? { socials: input.socials } : {}),
    createdAt: iso,
    updatedAt: iso,
  };
  await putItem(asItem(item));
  return item;
}

export interface CreateNewsInput {
  id: string;
  title: string;
  excerpt: string;
  body: string; // markdown
  topics: string[];
  slug?: string;
  status?: PublishStatus; // default "published"
  source?: { name: string; url?: string };
  coverImage?: string;
  relatedContentIds?: string[];
  publishedAt?: string; // ISO; defaults to now
  now?: number;
}

/**
 * Create/overwrite a NEWS META (GSI2 all-feed + GSI3 slug, published only) PLUS one
 * {@link NewsTopicPointerItem} per topic (GSI2 `NEWSTOPIC#<topic>`), so a single news
 * item fans into many per-topic feeds. Idempotent by id + (id, topic).
 */
export async function createNews(input: CreateNewsInput): Promise<NewsItem> {
  const now = input.now ?? Date.now();
  const iso = new Date(now).toISOString();
  const status: PublishStatus = input.status ?? "published";
  const slug = input.slug ?? slugify(input.title);
  const publishedAt = input.publishedAt ?? iso;
  const topics = [...new Set(input.topics)];

  const item: NewsItem = {
    ...newsKeys.meta(input.id),
    ...(status === "published"
      ? { ...newsKeys.allFeed(publishedAt), ...newsKeys.bySlug(slug) }
      : {}),
    entity: "NEWS",
    id: input.id,
    slug,
    title: input.title,
    excerpt: input.excerpt,
    body: input.body,
    ...(input.source ? { source: input.source } : {}),
    topics,
    ...(input.coverImage !== undefined ? { coverImage: input.coverImage } : {}),
    ...(input.relatedContentIds ? { relatedContentIds: input.relatedContentIds } : {}),
    status,
    publishedAt,
    createdAt: iso,
    updatedAt: iso,
  };
  await putItem(asItem(item));

  // Fan out one topic pointer per topic (GSI2 key present only when published).
  if (status === "published") {
    await Promise.all(
      topics.map((topic) => {
        const pointer: NewsTopicPointerItem = {
          ...newsKeys.topicPointer(input.id, topic, publishedAt),
          entity: "NEWSTOPIC",
          newsId: input.id,
          topic,
          slug,
          title: input.title,
          publishedAt,
        };
        return putItem(asItem(pointer));
      }),
    );
  }

  return item;
}
