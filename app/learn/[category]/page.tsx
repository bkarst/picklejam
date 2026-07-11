import type { Metadata } from "next";
import type { JSX } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbListJsonLd, itemListJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/directory";
import { ArticleCard, NewsletterSignup } from "@/components/content";
import { categoryMeta } from "@/components/content/categories";
import { getContentByCategory, getAuthor, listCategories, CONTENT_CATEGORIES } from "@/lib/data/content";
import { learnHub, learnCategoryPath, articlePath } from "@/lib/urls";
import { brand } from "@/brand.config";
import type { ContentItem } from "@/lib/db/types";

export const revalidate = 86400;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

type Params = Promise<{ category: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { category } = await params;
  const meta = categoryMeta(category);
  return buildMetadata({
    title: `${meta.label} — Pickleball ${meta.label} Guides`,
    description: meta.blurb,
    path: learnCategoryPath(category),
  });
}

async function avatarMap(articles: ContentItem[]): Promise<Map<string, string>> {
  const ids = [...new Set(articles.map((a) => a.authorId).filter(Boolean))];
  const authors = await Promise.all(ids.map((id) => getAuthor(id)));
  const map = new Map<string, string>();
  for (const a of authors) if (a?.avatarUrl) map.set(a.authorId, a.avatarUrl);
  return map;
}

export default async function LearnCategoryPage({
  params,
}: {
  params: Params;
}): Promise<JSX.Element> {
  const { category } = await params;
  const base = brand.siteUrl;
  const [categories, rawArticles] = await Promise.all([
    listCategories(),
    getContentByCategory(category),
  ]);

  const known = categories.some((c) => c.category === category);
  // A curated category slug (e.g. "gear") is "defined" even before it has any
  // content — it's in the taxonomy and linked from nav, so it earns a
  // "Coming soon" page rather than a 404.
  const isDefinedCategory = (CONTENT_CATEGORIES as readonly string[]).includes(category);
  const articles = rawArticles
    .filter((a) => a.status === "published")
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  // Genuinely unknown category with no content is a real 404 (avoid thin/empty
  // pages). A defined-but-empty category falls through to the "Coming soon" body.
  if (!known && !isDefinedCategory && articles.length === 0) notFound();

  const meta = categoryMeta(category);
  const avatars = await avatarMap(articles);

  return (
    <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
      <JsonLd
        data={[
          breadcrumbListJsonLd([
            { name: "Home", url: base },
            { name: "Learn", url: `${base}${learnHub()}` },
            { name: meta.label, url: `${base}${learnCategoryPath(category)}` },
          ]),
          itemListJsonLd(
            articles.map((a) => ({ name: a.title, url: articlePath(a.category, a.slug) })),
          ),
        ]}
      />

      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Learn", href: learnHub() },
          { name: meta.label },
        ]}
      />

      {/* Header */}
      <header className="mt-4">
        <h1 className="font-display text-3xl font-bold text-accent sm:text-4xl">{meta.label}</h1>
        <p className="mt-2 max-w-2xl text-lg text-muted">{meta.blurb}</p>

        {/* Topic switcher — all categories as pills (current active). */}
        <nav aria-label="Categories" className="mt-5">
          <ul className="flex flex-wrap gap-2">
            <li>
              <Link
                href={learnHub()}
                className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                All Topics
              </Link>
            </li>
            {categories.map((c) => {
              const active = c.category === category;
              return (
                <li key={c.category}>
                  <Link
                    href={learnCategoryPath(c.category)}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                      active
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-border text-foreground hover:bg-surface-secondary"
                    }`}
                  >
                    {categoryMeta(c.category).label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      {/* Body */}
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {articles.length > 0 ? (
            <ul className="flex flex-col gap-5">
              {articles.map((a) => (
                <li key={a.id}>
                  <ArticleCard content={a} variant="row" authorAvatarUrl={avatars.get(a.authorId)} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface px-6 py-16 text-center">
              <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary" aria-hidden="true">
                <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
              </span>
              <div>
                <h2 className="font-display text-2xl font-bold text-foreground">Coming soon</h2>
                <p className="mx-auto mt-2 max-w-md text-muted">
                  Our {meta.label.toLowerCase()} guides are on the way — check back soon.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-6">
          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-display text-lg font-bold text-foreground">New to pickleball?</h2>
            <p className="mt-1 text-sm text-muted">
              Explore guides, tips, and resources designed to get you on the court.
            </p>
            <Link
              href="/courts"
              className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-secondary px-5 text-sm font-semibold text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Find courts near you
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </Link>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5">
            <NewsletterSignup source="learn-category" variant="inline" title="Stay in the loop" description="Get new guides delivered to your inbox." />
          </section>
        </aside>
      </div>
    </main>
  );
}
