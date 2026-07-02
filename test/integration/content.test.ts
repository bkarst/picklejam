import { describe, it, expect, beforeAll, vi } from "vitest";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getItem, putItem } from "@/lib/db/client";
import { getDocClient } from "@/lib/db/table";
import { geoKeys, subscriberKeys, cityKeyOf } from "@/lib/db/keys";
import {
  createContent,
  createNews,
  upsertAuthor,
  getContentBySlug,
  getContentByCategory,
  getContentByAuthor,
  getAuthor,
  getAuthorBySlug,
  getNewsBySlug,
  getNewsFeed,
  getNewsByTopic,
  listCategories,
  listNewsTopics,
} from "@/lib/data/content";
import { subscribeNewsletter } from "@/lib/data/subscribers";
import type { CityItem, SubscriberItem } from "@/lib/db/types";

/**
 * Stage 9 Content Hub + News data layer against DynamoDB Local (§6.5/§6.6, §9.5
 * patterns 14/15). Skipped without DYNAMODB_ENDPOINT. Parallel-safe + re-runnable:
 * every id / slug / category / topic / cityKey is namespaced per-run.
 *
 * Proves: patterns 14/15 each resolve in ONE keyed Query; feeds are recency-desc
 * (newest first); PUBLISHED-only filtering (drafts never index); the related-local
 * CTA validates against a REAL city (orphan dropped); news topic pointers fan one
 * item into many topic feeds; and the idempotent newsletter subscribe.
 */
const d = process.env.DYNAMODB_ENDPOINT ? describe : describe.skip;

const RUN = Math.random().toString(36).slice(2, 8);

const AUTHOR_ID = `au-${RUN}`;
const AUTHOR_SLUG = `author-${RUN}`;
const CAT = `cat${RUN}`;
const TOPIC_A = `topa${RUN}`;
const TOPIC_B = `topb${RUN}`;

// A REAL city for the related-local CTA, and an orphan (never seeded) sibling.
const REAL_CITY = cityKeyOf("zz", `s${RUN}`, `c${RUN}`);
const ORPHAN_CITY = cityKeyOf("zz", `s${RUN}`, `orphan${RUN}`);

/** Count DynamoDB `Query` operations issued by `fn` (§9.5 "one query" rule). */
async function countQueries<T>(fn: () => Promise<T>): Promise<{ result: T; queries: number }> {
  const spy = vi.spyOn(getDocClient(), "send");
  const start = spy.mock.calls.length;
  const result = await fn();
  const queries = spy.mock.calls.slice(start).filter((c) => c[0] instanceof QueryCommand).length;
  spy.mockRestore();
  return { result, queries };
}

async function seedCity(): Promise<void> {
  const city: CityItem = {
    ...geoKeys.city("zz", `s${RUN}`, `c${RUN}`),
    entity: "CITY",
    cityKey: REAL_CITY,
    name: `Testville ${RUN}`,
    slug: `c${RUN}`,
    country: "zz",
    state: `s${RUN}`,
  };
  await putItem(city as unknown as Record<string, unknown>);
}

d("content hub + news data layer (DynamoDB Local)", () => {
  beforeAll(async () => {
    await seedCity();
    await upsertAuthor({
      authorId: AUTHOR_ID,
      name: `Author ${RUN}`,
      slug: AUTHOR_SLUG,
      credentials: "USAP-certified coach",
    });

    // Three published articles in one per-run category, ascending publish time.
    await createContent({
      id: `c1-${RUN}`,
      slug: `a1-${RUN}`,
      category: CAT,
      title: "First Article",
      excerpt: "first",
      body: "## Intro\n\nHello world of pickleball dinks and drives.\n\n### Detail\n\nMore.",
      authorId: AUTHOR_ID,
      authorName: `Author ${RUN}`,
      keyTakeaways: ["a", "b"],
      faq: [{ question: "Q?", answer: "A." }],
      relatedCityKey: REAL_CITY,
      publishedAt: "2026-05-01T00:00:00.000Z",
    });
    await createContent({
      id: `c2-${RUN}`,
      slug: `a2-${RUN}`,
      category: CAT,
      title: "Second Article",
      excerpt: "second",
      body: "## Body\n\nWords.",
      authorId: AUTHOR_ID,
      publishedAt: "2026-05-02T00:00:00.000Z",
    });
    await createContent({
      id: `c3-${RUN}`,
      slug: `a3-${RUN}`,
      category: CAT,
      title: "Third Article",
      excerpt: "third",
      body: "## Body\n\nWords.",
      authorId: AUTHOR_ID,
      publishedAt: "2026-05-03T00:00:00.000Z",
    });
    // A DRAFT — must never surface in any public read.
    await createContent({
      id: `cd-${RUN}`,
      slug: `ad-${RUN}`,
      category: CAT,
      title: "Draft Article",
      excerpt: "draft",
      body: "## Draft\n\nHidden.",
      authorId: AUTHOR_ID,
      status: "draft",
      publishedAt: "2026-05-09T00:00:00.000Z",
    });
    // One in a REAL category so listCategories has something to count.
    await createContent({
      id: `cg-${RUN}`,
      slug: `guide-${RUN}`,
      category: "guides",
      title: "A Real Guide",
      excerpt: "guide",
      body: "## Guide\n\nWords.",
      authorId: AUTHOR_ID,
      publishedAt: "2026-05-04T00:00:00.000Z",
    });

    // News: n1 has BOTH topics, n2 only topic A → fan-out; nd is a draft.
    await createNews({
      id: `n1-${RUN}`,
      slug: `nn1-${RUN}`,
      title: "News One",
      excerpt: "one",
      body: "## One\n\nBody.",
      topics: [TOPIC_A, TOPIC_B],
      source: { name: "Source", url: "https://src.test" },
      publishedAt: "2026-06-01T00:00:00.000Z",
    });
    await createNews({
      id: `n2-${RUN}`,
      slug: `nn2-${RUN}`,
      title: "News Two",
      excerpt: "two",
      body: "## Two\n\nBody.",
      topics: [TOPIC_A],
      publishedAt: "2026-06-02T00:00:00.000Z",
    });
    await createNews({
      id: `nd-${RUN}`,
      slug: `nnd-${RUN}`,
      title: "News Draft",
      excerpt: "draft",
      body: "## Draft\n\nHidden.",
      topics: [TOPIC_A],
      status: "draft",
      publishedAt: "2026-06-09T00:00:00.000Z",
    });
    // One with a REAL topic so listNewsTopics has something to count.
    await createNews({
      id: `ne-${RUN}`,
      slug: `nne-${RUN}`,
      title: "Events News",
      excerpt: "events",
      body: "## Events\n\nBody.",
      topics: ["events"],
      publishedAt: "2026-06-03T00:00:00.000Z",
    });
  });

  // ── pattern 14 (content) ────────────────────────────────────────────────────

  it("#14 getContentBySlug (category fast path) resolves in ONE Query (draft → undefined)", async () => {
    const { result, queries } = await countQueries(() => getContentBySlug(`a1-${RUN}`, CAT));
    expect(queries).toBe(1);
    expect(result?.id).toBe(`c1-${RUN}`);
    // Structured fields round-trip + readMinutes computed from the body.
    expect(result?.faq?.[0].question).toBe("Q?");
    expect(result?.readMinutes).toBeGreaterThanOrEqual(1);

    // A draft is not resolvable by slug.
    expect(await getContentBySlug(`ad-${RUN}`, CAT)).toBeUndefined();
  });

  it("#14 getContentBySlug (slug-only) resolves via bounded fan-out over known categories", async () => {
    // `cg-` lives in the real "guides" category, so slug-only resolution finds it.
    const found = await getContentBySlug(`guide-${RUN}`);
    expect(found?.id).toBe(`cg-${RUN}`);
    expect(found?.category).toBe("guides");
  });

  it("#14 getContentByCategory: ONE Query, recency-desc, PUBLISHED-only", async () => {
    const { result, queries } = await countQueries(() => getContentByCategory(CAT));
    expect(queries).toBe(1);
    expect(result.map((c) => c.id)).toEqual([`c3-${RUN}`, `c2-${RUN}`, `c1-${RUN}`]);
    expect(result.every((c) => c.status === "published")).toBe(true);
  });

  it("#14 getContentByAuthor: ONE Query (GSI1), newest-first, draft excluded", async () => {
    const { result, queries } = await countQueries(() => getContentByAuthor(AUTHOR_ID));
    expect(queries).toBe(1);
    const ids = result.map((c) => c.id);
    expect(ids).toContain(`c3-${RUN}`);
    expect(ids).toContain(`c1-${RUN}`);
    expect(ids).not.toContain(`cd-${RUN}`); // the draft
    // Newest-first: c3 (05-04 guide is newer) ... assert c3 precedes c1.
    expect(ids.indexOf(`c3-${RUN}`)).toBeLessThan(ids.indexOf(`c1-${RUN}`));
  });

  it("#14 author profile resolves by id and by slug (GSI3, one Query)", async () => {
    expect((await getAuthor(AUTHOR_ID))?.slug).toBe(AUTHOR_SLUG);
    const { result, queries } = await countQueries(() => getAuthorBySlug(AUTHOR_SLUG));
    expect(queries).toBe(1);
    expect(result?.authorId).toBe(AUTHOR_ID);
  });

  it("listCategories counts a real category with a preview sample", async () => {
    const cats = await listCategories();
    const guides = cats.find((c) => c.category === "guides");
    expect(guides).toBeDefined();
    expect(guides!.count).toBeGreaterThanOrEqual(1);
    expect(guides!.latest.length).toBeGreaterThanOrEqual(1);
  });

  // ── related-local CTA (§12 rule 4) ──────────────────────────────────────────

  it("related-city CTA is kept when the city is REAL and dropped when orphan", async () => {
    // The seeded c1 pointed at a real city → kept.
    const kept = await getContentBySlug(`a1-${RUN}`, CAT);
    expect(kept?.relatedCityKey).toBe(REAL_CITY);

    // A fresh article pointing at a non-existent city → the key is dropped.
    const orphan = await createContent({
      id: `co-${RUN}`,
      slug: `ao-${RUN}`,
      category: CAT,
      title: "Orphan City Article",
      excerpt: "orphan",
      body: "## Body\n\nWords.",
      authorId: AUTHOR_ID,
      relatedCityKey: ORPHAN_CITY,
      publishedAt: "2026-05-05T00:00:00.000Z",
    });
    expect(orphan.relatedCityKey).toBeUndefined();
  });

  // ── pattern 15 (news) ───────────────────────────────────────────────────────

  it("#15 getNewsBySlug resolves in ONE Query (draft → undefined)", async () => {
    const { result, queries } = await countQueries(() => getNewsBySlug(`nn1-${RUN}`));
    expect(queries).toBe(1);
    expect(result?.id).toBe(`n1-${RUN}`);
    expect(result?.source?.name).toBe("Source");
    expect(await getNewsBySlug(`nnd-${RUN}`)).toBeUndefined();
  });

  it("#15 getNewsFeed: ONE Query, recency-desc, PUBLISHED-only", async () => {
    const { result, queries } = await countQueries(() => getNewsFeed());
    expect(queries).toBe(1);
    // The global feed is shared across runs — assert on THIS run's items only.
    const mine = result.filter((n) => n.id.endsWith(`-${RUN}`));
    expect(mine.map((n) => n.id)).toEqual([`ne-${RUN}`, `n2-${RUN}`, `n1-${RUN}`]);
    expect(mine.map((n) => n.id)).not.toContain(`nd-${RUN}`);
  });

  it("#15 news topic pointers fan one item into MANY topic feeds (ONE Query each)", async () => {
    const a = await countQueries(() => getNewsByTopic(TOPIC_A));
    const b = await countQueries(() => getNewsByTopic(TOPIC_B));
    expect(a.queries).toBe(1); // the topic Query (BatchGet hydration isn't a Query)
    expect(b.queries).toBe(1);

    // Topic A carries both news items, newest-first; the draft is excluded.
    expect(a.result.map((n) => n.id)).toEqual([`n2-${RUN}`, `n1-${RUN}`]);
    // Topic B carries only n1 → n1 fanned into BOTH feeds.
    expect(b.result.map((n) => n.id)).toEqual([`n1-${RUN}`]);
  });

  it("listNewsTopics counts a real topic", async () => {
    const topics = await listNewsTopics();
    const events = topics.find((t) => t.topic === "events");
    expect(events).toBeDefined();
    expect(events!.count).toBeGreaterThanOrEqual(1);
  });

  // ── newsletter subscribe (idempotent) ───────────────────────────────────────

  it("subscribeNewsletter stores a subscriber and is idempotent", async () => {
    const email = `Sub-${RUN}@Example.com`;

    const first = await subscribeNewsletter(email, "content-hub");
    expect(first).toEqual({ ok: true });

    // Row is stored under the lower-cased email.
    const row = await getItem<SubscriberItem>(subscriberKeys.byEmail(email));
    expect(row?.email).toBe(`sub-${RUN}@example.com`);
    expect(row?.source).toBe("content-hub");

    // Re-subscribing is a harmless no-op.
    const second = await subscribeNewsletter(email, "different-source");
    expect(second).toEqual({ ok: true, alreadySubscribed: true });

    // Invalid emails are rejected without a write.
    const bad = await subscribeNewsletter("not-an-email");
    expect(bad.ok).toBe(false);
  });
});
