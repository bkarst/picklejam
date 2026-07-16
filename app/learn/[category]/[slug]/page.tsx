import type { Metadata } from "next";
import type { JSX } from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { buildMetadata, articleTitle } from "@/lib/seo/metadata";
import {
  articleJsonLd,
  authorPersonJsonLd,
  breadcrumbListJsonLd,
  faqPageJsonLd,
} from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/directory";
import { FaqAccordion } from "@/components/ui/FaqAccordion";
import {
  AuthorByline,
  KeyTakeaways,
  RelatedLocalCTA,
  ShareLinkButton,
  TableOfContents,
  type TocItem,
} from "@/components/content";
import { categoryMeta } from "@/components/content/categories";
import { FindYourPeopleCTA } from "@/components/groups";
import { MarkdownBody, extractToc, readMinutes } from "@/lib/content/render";
import { getContentBySlug, getAuthor } from "@/lib/data/content";
import { getCity } from "@/lib/data/geo";
import { parseCityKey } from "@/lib/db/keys";
import { stateAbbr } from "@/lib/geo/us-states";
import { learnHub, learnCategoryPath, articlePath, authorPath, cityUrlFromKey } from "@/lib/urls";
import { brand } from "@/brand.config";

/** Evergreen article — ISR once/day (§6.5). */
export const revalidate = 86400;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

type Params = Promise<{ category: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { category, slug } = await params;
  const content = await getContentBySlug(slug);
  const path = articlePath(category, slug);
  if (!content || content.category !== category || content.status !== "published") {
    return buildMetadata({ title: "Article not found", path, noindex: true });
  }
  return buildMetadata({
    title: articleTitle(content.title),
    description: content.excerpt,
    path,
    ogImage: content.coverImage,
    openGraphType: "article",
    keywords: content.tags,
  });
}

export default async function ArticlePage({ params }: { params: Params }): Promise<JSX.Element> {
  const { category, slug } = await params;
  const content = await getContentBySlug(slug);
  // Enforce ONE canonical path per article (slug lives under its own category).
  if (!content || content.category !== category || content.status !== "published") notFound();

  const base = brand.siteUrl;
  const meta = categoryMeta(content.category);
  const [author] = await Promise.all([content.authorId ? getAuthor(content.authorId) : null]);

  const toc: TocItem[] = extractToc(content.body);
  const minutes = content.readMinutes ?? readMinutes(content.body);
  const faq = content.faq ?? [];
  const takeaways = content.keyTakeaways ?? [];

  // Related-local CTA — resolve the city key to a REAL city page (no orphan
  // link, §12 rule 4). Only render when the city actually exists.
  let localCta: { cityName: string; stateCode: string; href: string } | null = null;
  if (content.relatedCityKey) {
    const { country, state, city } = parseCityKey(content.relatedCityKey);
    const cityItem = await getCity(country, state, city);
    if (cityItem) {
      localCta = {
        cityName: cityItem.name,
        stateCode: stateAbbr(state),
        href: cityUrlFromKey(content.relatedCityKey),
      };
    }
  }

  const path = articlePath(category, slug);

  return (
    <main id="main" className="flex-1 bg-surface">
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <JsonLd
          data={[
            breadcrumbListJsonLd([
              { name: "Home", url: base },
              { name: "Learn", url: `${base}${learnHub()}` },
              { name: meta.label, url: `${base}${learnCategoryPath(content.category)}` },
              { name: content.title, url: `${base}${path}` },
            ]),
            articleJsonLd(content, { url: path, author }),
            ...(author ? [authorPersonJsonLd(author)] : []),
            ...(faq.length > 0 ? [faqPageJsonLd(faq)] : []),
          ]}
        />

        <Breadcrumbs
          items={[
            { name: "Home", href: "/" },
            { name: "Learn", href: learnHub() },
            { name: meta.label, href: learnCategoryPath(content.category) },
            { name: content.title },
          ]}
        />

        {/* Article header */}
        <header className="mx-auto mt-4 max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-wide text-accent">{meta.label}</p>
          <h1 className="mt-2 font-display text-3xl font-bold leading-tight text-foreground sm:text-4xl">
            {content.title}
          </h1>
          {content.excerpt && <p className="mt-3 text-lg text-muted">{content.excerpt}</p>}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <AuthorByline
              name={author?.name ?? content.authorName ?? brand.identity.name}
              avatarUrl={author?.avatarUrl}
              href={author ? authorPath(author.slug) : undefined}
              readMinutes={minutes}
              date={content.publishedAt}
              size="md"
            />
            <ShareLinkButton url={`${base}${path}`} />
          </div>
        </header>

        {/* Cover */}
        {content.coverImage && (
          <div className="mx-auto mt-6 max-w-4xl overflow-hidden rounded-2xl bg-surface-secondary">
            <div className="relative aspect-[16/9]">
              <Image
                src={content.coverImage}
                alt=""
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 896px"
                className="object-cover"
              />
            </div>
          </div>
        )}

        {/* Body + TOC */}
        <div className="mt-8 lg:grid lg:grid-cols-[1fr_15rem] lg:gap-10">
          <article className="mx-auto w-full min-w-0 max-w-3xl">
            {/* Mobile TOC (collapsible; anchors work JS-off) */}
            {toc.length > 0 && (
              <details className="mb-6 rounded-xl border border-border bg-surface px-4 lg:hidden">
                <summary className="cursor-pointer list-none py-3 font-semibold text-foreground marker:content-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                  On this page
                </summary>
                <div className="pb-3">
                  <TableOfContents items={toc} title="On this page" />
                </div>
              </details>
            )}

            {takeaways.length > 0 && (
              <div className="mb-8">
                <KeyTakeaways items={takeaways} />
              </div>
            )}

            {/* Markdown body — server-rendered, crawlable. Heading ids match the TOC. */}
            <div
              className="
                text-[1.0625rem] leading-8 text-foreground
                [&_a]:text-accent [&_a]:underline hover:[&_a]:opacity-80
                [&_blockquote]:my-6 [&_blockquote]:border-l-4 [&_blockquote]:border-accent/40 [&_blockquote]:pl-4 [&_blockquote]:text-muted [&_blockquote]:italic
                [&_code]:rounded [&_code]:bg-surface-secondary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em]
                [&_h2]:mt-10 [&_h2]:scroll-mt-24 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-foreground
                [&_h3]:mt-8 [&_h3]:scroll-mt-24 [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-foreground
                [&_img]:my-6 [&_img]:rounded-2xl
                [&_li]:my-1 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6
                [&_p]:my-4
                [&_strong]:font-semibold [&_strong]:text-foreground
                [&_table]:my-6 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:bg-surface-secondary [&_th]:p-2 [&_th]:text-left
                [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6
              "
            >
              <MarkdownBody markdown={content.body} />
            </div>

            {/* FAQ */}
            {faq.length > 0 && (
              <section className="mt-12">
                <h2 className="font-display text-2xl font-bold text-foreground">Frequently asked questions</h2>
                <div className="mt-4">
                  <FaqAccordion items={faq} />
                </div>
              </section>
            )}

            {/* Related-local CTA (resolves to a real city page) */}
            {localCta && (
              <div className="mt-12">
                <RelatedLocalCTA
                  cityName={localCta.cityName}
                  stateCode={localCta.stateCode}
                  href={localCta.href}
                />
              </div>
            )}
          </article>

          {/* Desktop sticky TOC */}
          {toc.length > 0 && (
            <aside className="hidden lg:block">
              <div className="sticky top-24">
                <TableOfContents items={toc} />
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Every article ends with an invitation to form a crew (§6.9). Full-bleed
          cream band — `main` is bg-surface, so the white card needs the canvas
          behind it to read as a card. */}
      <section className="mt-4 bg-background">
        <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:py-16">
          <FindYourPeopleCTA />
        </div>
      </section>
    </main>
  );
}
