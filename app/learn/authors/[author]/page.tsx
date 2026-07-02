import type { Metadata } from "next";
import type { JSX } from "react";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  authorPersonJsonLd,
  breadcrumbListJsonLd,
  itemListJsonLd,
  type JsonLd,
} from "@/lib/seo/jsonld";
import { JsonLd as JsonLdScript } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/directory";
import { ArticleCard } from "@/components/content";
import { initials } from "@/components/content/format";
import { getAuthorBySlug, getContentByAuthor } from "@/lib/data/content";
import { learnHub, authorPath, articlePath } from "@/lib/urls";
import { brand } from "@/brand.config";

export const revalidate = 86400;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

type Params = Promise<{ author: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { author } = await params;
  const item = await getAuthorBySlug(author);
  const path = authorPath(author);
  if (!item) return buildMetadata({ title: "Author not found", path, noindex: true });
  return buildMetadata({
    title: `${item.name} — ${brand.identity.name} Author`,
    description:
      item.bio?.trim() ||
      `Pickleball guides and articles by ${item.name}${item.credentials ? `, ${item.credentials}` : ""}.`,
    path,
    ogImage: item.avatarUrl,
    openGraphType: "profile",
  });
}

function SocialLinks({
  socials,
}: {
  socials?: { twitter?: string; instagram?: string; website?: string };
}): JSX.Element | null {
  if (!socials) return null;
  const links: { label: string; href: string; icon: JSX.Element }[] = [];
  if (socials.twitter) {
    links.push({
      label: `${socials.twitter} on X`,
      href: `https://x.com/${socials.twitter.replace(/^@/, "")}`,
      icon: <path d="M18 4l-5.5 6.5L18 20h-3.2l-3.8-5-4.3 5H4l6-7L4 4h3.3l3.4 4.6L15 4z" />,
    });
  }
  if (socials.instagram) {
    links.push({
      label: `${socials.instagram} on Instagram`,
      href: `https://www.instagram.com/${socials.instagram.replace(/^@/, "")}`,
      icon: (
        <>
          <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
        </>
      ),
    });
  }
  if (socials.website) {
    links.push({
      label: "Website",
      href: socials.website,
      icon: (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
        </>
      ),
    });
  }
  if (links.length === 0) return null;
  return (
    <div className="mt-4 flex gap-2">
      {links.map((l) => (
        <a
          key={l.href}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          aria-label={l.label}
          className="inline-flex size-11 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {l.icon}
          </svg>
        </a>
      ))}
    </div>
  );
}

export default async function AuthorPage({ params }: { params: Params }): Promise<JSX.Element> {
  const { author } = await params;
  const item = await getAuthorBySlug(author);
  if (!item) notFound();

  const base = brand.siteUrl;
  const articles = (await getContentByAuthor(item.authorId))
    .filter((a) => a.status === "published")
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  // Person node, wrapped in a ProfilePage (E-E-A-T). The nested Person keeps its
  // own @context (valid JSON-LD; a redundant nested @context is ignored).
  const profilePage: JsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: authorPersonJsonLd(item, { url: authorPath(item.slug) }),
  };

  return (
    <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <JsonLdScript
        data={[
          breadcrumbListJsonLd([
            { name: "Home", url: base },
            { name: "Learn", url: `${base}${learnHub()}` },
            { name: item.name, url: `${base}${authorPath(item.slug)}` },
          ]),
          profilePage,
          ...(articles.length > 0
            ? [itemListJsonLd(articles.map((a) => ({ name: a.title, url: articlePath(a.category, a.slug) })))]
            : []),
        ]}
      />

      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Learn", href: learnHub() },
          { name: item.name },
        ]}
      />

      {/* Author header */}
      <header className="mt-4 flex flex-col items-start gap-5 rounded-2xl border border-border bg-surface p-6 sm:flex-row sm:items-center">
        {item.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.avatarUrl} alt="" className="size-24 shrink-0 rounded-full object-cover" />
        ) : (
          <span
            aria-hidden="true"
            className="inline-flex size-24 shrink-0 items-center justify-center rounded-full bg-surface-secondary font-display text-2xl font-bold text-muted"
          >
            {initials(item.name)}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold text-accent">{item.name}</h1>
          {item.credentials && (
            <p className="mt-1 text-sm font-semibold text-foreground">{item.credentials}</p>
          )}
          {item.bio && <p className="mt-3 max-w-2xl text-muted">{item.bio}</p>}
          <SocialLinks socials={item.socials} />
        </div>
      </header>

      {/* Their articles */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-bold text-foreground">
          {articles.length > 0 ? `Articles by ${item.name}` : "Articles"}
        </h2>
        {articles.length > 0 ? (
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((a) => (
              <ArticleCard key={a.id} content={a} variant="grid" authorAvatarUrl={item.avatarUrl} />
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-2xl border border-border bg-surface p-8 text-center text-muted">
            No published articles yet.
          </p>
        )}
      </section>
    </main>
  );
}
