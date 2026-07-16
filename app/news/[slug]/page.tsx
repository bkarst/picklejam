import type { Metadata } from "next";
import type { JSX } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildMetadata, articleTitle } from "@/lib/seo/metadata";
import { newsArticleJsonLd, breadcrumbListJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/directory";
import { NewsCard } from "@/components/content";
import { FindYourPeopleCTA } from "@/components/groups";
import { relativeTime, formatArticleDate, titleize } from "@/components/content/format";
import { MarkdownBody } from "@/lib/content/render";
import { getNewsBySlug, getNewsFeed } from "@/lib/data/content";
import { newsHub, newsTopicPath, newsArticlePath, learnHub } from "@/lib/urls";
import { brand } from "@/brand.config";
import type { NewsItem } from "@/lib/db/types";

export const revalidate = 900;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const news = await getNewsBySlug(slug);
  const path = newsArticlePath(slug);
  if (!news || news.status !== "published") {
    return buildMetadata({ title: "Story not found", path, noindex: true });
  }
  return buildMetadata({
    title: articleTitle(news.title),
    description: news.excerpt,
    path,
    ogImage: news.coverImage,
    openGraphType: "article",
    keywords: news.topics,
  });
}

/** Pick related stories: same-topic first, then recent, excluding self. */
function pickRelated(feed: NewsItem[], current: NewsItem, limit = 3): NewsItem[] {
  const others = feed.filter((n) => n.id !== current.id && n.status === "published");
  const topicSet = new Set(current.topics ?? []);
  const sameTopic = others.filter((n) => n.topics?.some((t) => topicSet.has(t)));
  const rest = others.filter((n) => !sameTopic.includes(n));
  return [...sameTopic, ...rest].slice(0, limit);
}

export default async function NewsArticlePage({ params }: { params: Params }): Promise<JSX.Element> {
  const { slug } = await params;
  const news = await getNewsBySlug(slug);
  if (!news || news.status !== "published") notFound();

  const base = brand.siteUrl;
  const path = newsArticlePath(slug);
  const url = `${base}${path}`;
  const primaryTopic = news.topics?.[0];

  const feed = await getNewsFeed(30);
  const related = pickRelated(feed, news);

  const shareUrl = encodeURIComponent(url);
  const shareText = encodeURIComponent(news.title);
  const shares: { label: string; href: string; icon: JSX.Element }[] = [
    {
      label: "Share on Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`,
      icon: <path d="M14 8h2V5h-2c-1.7 0-3 1.3-3 3v2H9v3h2v6h3v-6h2.2l.8-3H14V8.5c0-.3.2-.5.5-.5z" fill="currentColor" stroke="none" />,
    },
    {
      label: "Share on X",
      href: `https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareText}`,
      icon: <path d="M18 4l-5.5 6.5L18 20h-3.2l-3.8-5-4.3 5H4l6-7L4 4h3.3l3.4 4.6L15 4z" />,
    },
    {
      label: "Share by email",
      href: `mailto:?subject=${shareText}&body=${shareUrl}`,
      icon: (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 7l9 6 9-6" />
        </>
      ),
    },
  ];

  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <JsonLd
        data={[
          breadcrumbListJsonLd([
            { name: "Home", url: base },
            { name: "News", url: `${base}${newsHub()}` },
            ...(primaryTopic
              ? [{ name: titleize(primaryTopic), url: `${base}${newsTopicPath(primaryTopic)}` }]
              : []),
            { name: news.title, url },
          ]),
          newsArticleJsonLd(news, { url: path }),
        ]}
      />

      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "News", href: newsHub() },
          ...(primaryTopic ? [{ name: titleize(primaryTopic), href: newsTopicPath(primaryTopic) }] : []),
          { name: news.title },
        ]}
      />

      <div className="mt-4 grid grid-cols-1 gap-10 lg:grid-cols-3">
        {/* Main */}
        <article className="lg:col-span-2">
          <h1 className="font-display text-3xl font-bold leading-tight text-accent sm:text-4xl">
            {news.title}
          </h1>

          {/* Dateline + source attribution */}
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            <time dateTime={news.publishedAt} className="font-medium text-foreground">
              {relativeTime(news.publishedAt)}
            </time>
            <span aria-hidden="true">·</span>
            <span>{formatArticleDate(news.publishedAt)}</span>
            {news.source?.name && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  via{" "}
                  {news.source.url ? (
                    <a
                      href={news.source.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="font-semibold text-accent hover:underline"
                    >
                      {news.source.name}
                    </a>
                  ) : (
                    <span className="font-semibold text-foreground">{news.source.name}</span>
                  )}
                </span>
              </>
            )}
          </p>

          {/* Cover */}
          {news.coverImage && (
            <div className="mt-5 overflow-hidden rounded-2xl bg-surface-secondary">
              <div className="relative aspect-[16/9]">
                <Image src={news.coverImage} alt="" fill priority sizes="(max-width: 1024px) 100vw, 720px" className="object-cover" />
              </div>
            </div>
          )}

          {/* Body */}
          <div
            className="
              mt-6 text-[1.0625rem] leading-8 text-foreground
              [&_a]:text-accent [&_a]:underline hover:[&_a]:opacity-80
              [&_blockquote]:my-6 [&_blockquote]:border-l-4 [&_blockquote]:border-accent/40 [&_blockquote]:pl-4 [&_blockquote]:text-muted [&_blockquote]:italic
              [&_h2]:mt-8 [&_h2]:scroll-mt-24 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold
              [&_h3]:mt-6 [&_h3]:scroll-mt-24 [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-bold
              [&_img]:my-6 [&_img]:rounded-2xl
              [&_li]:my-1 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6
              [&_p]:my-4 [&_strong]:font-semibold
              [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6
            "
          >
            <MarkdownBody markdown={news.body} />
          </div>

          {/* Share */}
          <div className="mt-8 flex items-center gap-3 border-t border-border pt-6">
            <span className="text-sm font-semibold text-foreground">Share this story</span>
            <div className="flex gap-2">
              {shares.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="inline-flex size-11 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {s.icon}
                  </svg>
                </a>
              ))}
            </div>
          </div>
        </article>

        {/* Sidebar */}
        <aside className="flex flex-col gap-6">
          {related.length > 0 && (
            <section className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-lg font-bold text-foreground">Related stories</h2>
                <Link href={newsHub()} className="rounded-sm text-sm font-semibold text-secondary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                  See all
                </Link>
              </div>
              <ul className="mt-2 divide-y divide-border">
                {related.map((n) => (
                  <li key={n.id}>
                    <NewsCard news={n} variant="compact" />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Go deeper — cross-link into the evergreen hub (§6.6). */}
          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-display text-lg font-bold text-foreground">Go deeper</h2>
            <Link
              href={learnHub()}
              className="group mt-3 flex items-center gap-4 rounded-xl border border-border p-4 transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-bubblegum/40 text-secondary">
                <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z" />
                  <path d="M19 3v18" />
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-bold uppercase tracking-wide text-accent">Guides</span>
                <span className="block font-display font-bold text-foreground">Learn Pickleball</span>
                <span className="block text-sm text-muted">Rules, scoring, shots, and court basics.</span>
              </span>
            </Link>
          </section>
        </aside>
      </div>

      {/* Every story ends with an invitation to form a crew (§6.9). */}
      <div className="mt-12">
        <FindYourPeopleCTA />
      </div>
    </main>
  );
}
