import type { Metadata } from "next";
import type { JSX } from "react";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { collectionPageJsonLd, breadcrumbListJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/directory";
import { NewsCard, NewsletterSignup } from "@/components/content";
import { titleize } from "@/components/content/format";
import { getNewsFeed, listNewsTopics } from "@/lib/data/content";
import { newsHub, newsTopicPath, newsArticlePath } from "@/lib/urls";
import { brand } from "@/brand.config";

/** Fresh news — revalidate every 15 minutes (§6.6). */
export const revalidate = 900;

const TITLE = "Pickleball News";
const DESCRIPTION = `The latest pickleball news — pro tour results, players, gear launches, business, and local stories, curated by ${brand.identity.name}.`;

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: TITLE,
    description: DESCRIPTION,
    path: newsHub(),
    keywords: ["pickleball news", "pro pickleball", "PPA tour", "MLP", "pickleball gear news"],
  });
}

export default async function NewsIndexPage(): Promise<JSX.Element> {
  const base = brand.siteUrl;
  const [rawFeed, topics] = await Promise.all([getNewsFeed(30), listNewsTopics()]);
  const feed = rawFeed
    .filter((n) => n.status === "published")
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  const featured = feed[0];
  const recent = feed.slice(1, 6);
  const latest = feed.slice(6, 11);

  return (
    <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
      <JsonLd
        data={[
          breadcrumbListJsonLd([
            { name: "Home", url: base },
            { name: "News", url: `${base}${newsHub()}` },
          ]),
          collectionPageJsonLd({
            name: TITLE,
            description: DESCRIPTION,
            url: newsHub(),
            items: feed.slice(0, 20).map((n) => ({ name: n.title, url: newsArticlePath(n.slug) })),
          }),
        ]}
      />

      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "News" }]} />

      <h1 className="mt-4 font-display text-4xl font-bold text-accent sm:text-5xl">Pickleball News</h1>

      {/* Topic switcher */}
      <nav aria-label="News topics" className="mt-6">
        <ul className="flex flex-wrap gap-2">
          <li>
            <span
              aria-current="page"
              className="inline-flex h-9 items-center rounded-full border border-accent bg-accent px-4 text-sm font-medium text-accent-foreground"
            >
              All
            </span>
          </li>
          {topics.map((t) => (
            <li key={t.topic}>
              <Link
                href={newsTopicPath(t.topic)}
                className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                {titleize(t.topic)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {feed.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-border bg-surface p-8 text-center text-muted">
          No stories yet — check back soon.
        </p>
      ) : (
        <>
          {/* Featured + Recent stories */}
          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">{featured && <NewsCard news={featured} variant="row" featured />}</div>
            {recent.length > 0 && (
              <section aria-labelledby="recent-heading">
                <h2 id="recent-heading" className="font-display text-xl font-bold text-foreground">
                  Recent stories
                </h2>
                <ul className="mt-2 divide-y divide-border">
                  {recent.map((n) => (
                    <li key={n.id}>
                      <NewsCard news={n} variant="compact" />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* Latest */}
          {latest.length > 0 && (
            <section className="mt-12">
              <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Latest</h2>
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {latest.map((n) => (
                  <NewsCard key={n.id} news={n} variant="grid" />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Newsletter */}
      <div className="mt-12">
        <NewsletterSignup
          source="news"
          description="Subscribe to our newsletter for the latest pickleball news, events, and exclusive updates."
        />
      </div>
    </main>
  );
}
