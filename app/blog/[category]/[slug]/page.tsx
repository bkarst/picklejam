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
import { blogHub, blogCategoryPath, articlePath, authorPath, cityUrlFromKey } from "@/lib/urls";
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
              { name: "Blog", url: `${base}${blogHub()}` },
              { name: meta.label, url: `${base}${blogCategoryPath(content.category)}` },
              { name: content.title, url: `${base}${path}` },
            ]),
            articleJsonLd(content, { url: path, author }),
            ...(author ? [authorPersonJsonLd(author)] : []),
            ...(faq.length > 0 ? [faqPageJsonLd(faq)] : []),
          ]}
        />

        {/* Breadcrumb, header, cover and body all live in ONE column so they
            share a single left edge; the TOC is a right rail beside it (9.3).
            The content track is a fixed measure rather than 1fr so the rail sits
            a fixed distance from the text — with 1fr the rail is pushed to the
            container edge and drifts further away the wider the viewport. */}
        <div className="lg:grid lg:grid-cols-[minmax(0,39rem)_15rem] lg:justify-center lg:gap-14">
          {/* 39rem ≈ 66 characters (~11 words) per line in Montserrat at 17px —
              the ideal measure for body prose. Montserrat is a wide face, so
              this is narrower than the usual max-w-3xl; re-measure if the body
              font or size changes. */}
          <div className="mx-auto w-full min-w-0 max-w-[39rem] lg:mx-0">
            <Breadcrumbs
              items={[
                { name: "Home", href: "/" },
                { name: "Blog", href: blogHub() },
                { name: meta.label, href: blogCategoryPath(content.category) },
                { name: content.title },
              ]}
            />

            {/* Article header */}
            <header className="mt-4">
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

            {/* Cover — same width as the text column so the left edge holds. */}
            {content.coverImage && (
              <div className="mt-6 overflow-hidden rounded-2xl bg-surface-secondary">
                <div className="relative aspect-[16/9]">
                  <Image
                    src={content.coverImage}
                    alt=""
                    fill
                    priority
                    sizes="(max-width: 624px) 100vw, 624px"
                    className="object-cover"
                  />
                </div>
              </div>
            )}

            <article className="mt-8">
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
          </div>

          {/* Desktop sticky TOC — right rail, starts level with the breadcrumb. */}
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
          behind it to read as a card.

          The card matches the article block above it rather than the page
          container: below lg that is the reading column (39rem), at lg+ it is
          column + gap + rail (39 + 3.5 + 15 = 57.5rem). Each figure adds this
          wrapper's own px-4 (2rem) — so 41rem / 59.5rem. Keep these in step with
          the grid above if that geometry changes. */}
      <section className="mt-4 bg-background">
        <div className="mx-auto w-full max-w-[41rem] px-4 py-12 sm:py-16 lg:max-w-[59.5rem]">
          <FindYourPeopleCTA />
        </div>
      </section>
    </main>
  );
}
