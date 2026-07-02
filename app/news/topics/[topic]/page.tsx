import type { Metadata } from "next";
import type { JSX } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbListJsonLd, itemListJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/directory";
import { NewsCard, NewsletterSignup } from "@/components/content";
import { titleize } from "@/components/content/format";
import { getNewsByTopic, listNewsTopics } from "@/lib/data/content";
import { newsHub, newsTopicPath, newsArticlePath } from "@/lib/urls";
import { brand } from "@/brand.config";

export const revalidate = 900;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

type Params = Promise<{ topic: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { topic } = await params;
  const label = titleize(topic);
  return buildMetadata({
    title: `${label} — Pickleball News`,
    description: `The latest ${label.toLowerCase()} pickleball news and stories on ${brand.identity.name}.`,
    path: newsTopicPath(topic),
  });
}

export default async function NewsTopicPage({ params }: { params: Params }): Promise<JSX.Element> {
  const { topic } = await params;
  const base = brand.siteUrl;
  const [topics, rawFeed] = await Promise.all([listNewsTopics(), getNewsByTopic(topic)]);

  const known = topics.some((t) => t.topic === topic);
  const feed = rawFeed
    .filter((n) => n.status === "published")
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  if (!known && feed.length === 0) notFound();

  const label = titleize(topic);

  return (
    <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
      <JsonLd
        data={[
          breadcrumbListJsonLd([
            { name: "Home", url: base },
            { name: "News", url: `${base}${newsHub()}` },
            { name: label, url: `${base}${newsTopicPath(topic)}` },
          ]),
          itemListJsonLd(feed.map((n) => ({ name: n.title, url: newsArticlePath(n.slug) }))),
        ]}
      />

      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "News", href: newsHub() },
          { name: label },
        ]}
      />

      <h1 className="mt-4 font-display text-3xl font-bold text-accent sm:text-4xl">
        {label} <span className="text-foreground">News</span>
      </h1>

      {/* Topic switcher */}
      <nav aria-label="News topics" className="mt-5">
        <ul className="flex flex-wrap gap-2">
          <li>
            <Link
              href={newsHub()}
              className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              All
            </Link>
          </li>
          {topics.map((t) => {
            const active = t.topic === topic;
            return (
              <li key={t.topic}>
                <Link
                  href={newsTopicPath(t.topic)}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                    active
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border text-foreground hover:bg-surface-secondary"
                  }`}
                >
                  {titleize(t.topic)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {feed.length > 0 ? (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {feed.map((n) => (
            <NewsCard key={n.id} news={n} variant="grid" />
          ))}
        </div>
      ) : (
        <p className="mt-8 rounded-2xl border border-border bg-surface p-8 text-center text-muted">
          No {label.toLowerCase()} stories yet — check back soon.
        </p>
      )}

      <div className="mt-12">
        <NewsletterSignup source={`news-topic-${topic}`} />
      </div>
    </main>
  );
}
