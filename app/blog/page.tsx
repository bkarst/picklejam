import type { Metadata } from "next";
import type { JSX } from "react";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { collectionPageJsonLd, breadcrumbListJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/directory";
import { ArticleCard, CategoryTile, NewsletterSignup } from "@/components/content";
import { categoryMeta } from "@/components/content/categories";
import {
  getContentByCategory,
  getAuthor,
  listCategories,
} from "@/lib/data/content";
import { blogHub, blogCategoryPath, articlePath } from "@/lib/urls";
import { brand } from "@/brand.config";
import type { ContentItem } from "@/lib/db/types";

/** Evergreen hub — slow-changing; rebuild at most once/day (§3, ISR). */
export const revalidate = 86400;

const TITLE = "Pickleball Blog";
const DESCRIPTION = `Guides, rules, strategy & gear — from first dink to tournament day. Expert, beginner-friendly pickleball guides from ${brand.identity.name}.`;

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: TITLE,
    description: DESCRIPTION,
    path: blogHub(),
    keywords: [
      "pickleball blog",
      "learn pickleball",
      "pickleball guides",
      "pickleball rules",
      "pickleball strategy",
      "pickleball gear",
      "pickleball news",
    ],
  });
}

/** Map distinct author ids in a set of articles to their avatar url. */
async function authorAvatars(articles: ContentItem[]): Promise<Map<string, string>> {
  const ids = [...new Set(articles.map((a) => a.authorId).filter(Boolean))];
  const authors = await Promise.all(ids.map((id) => getAuthor(id)));
  const map = new Map<string, string>();
  for (const a of authors) if (a?.avatarUrl) map.set(a.authorId, a.avatarUrl);
  return map;
}

export default async function BlogHubPage(): Promise<JSX.Element> {
  const base = brand.siteUrl;
  const categories = await listCategories();

  // Aggregate published articles across categories (pattern 14, GSI2 per category),
  // then rank by recency for the Featured + Latest rails.
  const perCategory = await Promise.all(
    categories.map((c) => getContentByCategory(c.category)),
  );
  const seen = new Set<string>();
  const all: ContentItem[] = [];
  for (const list of perCategory) {
    for (const item of list) {
      if (item.status !== "published" || seen.has(item.id)) continue;
      seen.add(item.id);
      all.push(item);
    }
  }
  all.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  const featured = all.slice(0, 3);
  const latest = all.slice(3, 11);
  const avatars = await authorAvatars([...featured, ...latest]);

  return (
    <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
      <JsonLd
        data={[
          breadcrumbListJsonLd([
            { name: "Home", url: base },
            { name: "Blog", url: `${base}${blogHub()}` },
          ]),
          collectionPageJsonLd({
            name: TITLE,
            description: DESCRIPTION,
            url: blogHub(),
            items: all.slice(0, 20).map((a) => ({
              name: a.title,
              url: articlePath(a.category, a.slug),
            })),
          }),
        ]}
      />

      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Blog" }]} />

      {/* Header + Browse by topic */}
      <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h1 className="font-display text-4xl font-bold text-accent sm:text-5xl">Pickleball Blog</h1>
          <p className="mt-3 max-w-xl text-lg text-muted">
            Guides, rules, strategy, gear &amp; news — from first dink to tournament day.
          </p>
          <form action="/search" method="get" role="search" className="mt-6 flex max-w-xl gap-2">
            <label htmlFor="blog-search" className="sr-only">
              Search guides, topics, or questions
            </label>
            <div className="relative flex-1">
              <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                id="blog-search"
                type="search"
                name="q"
                placeholder="Search guides, topics, or questions…"
                className="h-12 w-full rounded-full border border-border bg-field pl-10 pr-4 text-field-foreground placeholder:text-field-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Search
            </button>
          </form>
        </div>

        <nav aria-label="Browse by topic" className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="px-3 pb-2 font-display text-lg font-bold text-foreground">Browse by topic</h2>
          <ul className="flex flex-col divide-y divide-border">
            {categories.map((c) => {
              const meta = categoryMeta(c.category);
              return (
                <li key={c.category} className="py-0.5">
                  <CategoryTile
                    label={meta.label}
                    href={blogCategoryPath(c.category)}
                    count={c.count}
                    glyph={meta.glyph}
                  />
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {/* Featured */}
      {featured.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Featured</h2>
          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-3">
            {featured.map((a, i) => (
              <ArticleCard
                key={a.id}
                content={a}
                variant="grid"
                featured={i === 0}
                authorAvatarUrl={avatars.get(a.authorId)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Latest */}
      {latest.length > 0 && (
        <section className="mt-12">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Latest</h2>
            {categories[0] && (
              <Link
                href={blogCategoryPath(categories[0].category)}
                className="rounded-sm text-sm font-semibold text-secondary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                View all
              </Link>
            )}
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {latest.map((a) => (
              <ArticleCard
                key={a.id}
                content={a}
                variant="grid"
                authorAvatarUrl={avatars.get(a.authorId)}
              />
            ))}
          </div>
        </section>
      )}

      {all.length === 0 && (
        <p className="mt-12 rounded-2xl border border-border bg-surface p-8 text-center text-muted">
          New guides are on the way. Check back soon.
        </p>
      )}

      {/* Newsletter */}
      <div className="mt-12">
        <NewsletterSignup source="blog" />
      </div>
    </main>
  );
}
