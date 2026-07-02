import type { Metadata } from "next";
import type { JSX } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbListJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/directory";
import { legalPath } from "@/lib/urls";
import { brand } from "@/brand.config";
import { LEGAL_DOC_SLUGS, getLegalDoc, legalDocs } from "@/lib/legal/docs";

/**
 * Static content — the six legal docs are prerendered at build time
 * (`generateStaticParams`) and only change with a deploy; no revalidation needed.
 * These pages ARE indexable (legal pages carry no `noindex`).
 */
export const dynamicParams = false;

type Params = Promise<{ doc: string }>;

export function generateStaticParams(): { doc: string }[] {
  return LEGAL_DOC_SLUGS.map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { doc } = await params;
  const meta = getLegalDoc(doc);
  if (!meta) return {};
  return buildMetadata({
    title: meta.title,
    description: meta.description,
    path: legalPath(meta.slug),
    openGraphType: "article",
  });
}

export default async function LegalDocPage({ params }: { params: Params }): Promise<JSX.Element> {
  const { doc } = await params;
  const meta = getLegalDoc(doc);
  if (!meta) notFound();

  const base = brand.siteUrl;
  const others = LEGAL_DOC_SLUGS.filter((s) => s !== meta.slug);

  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <JsonLd
        data={breadcrumbListJsonLd([
          { name: "Home", url: base },
          { name: meta.navLabel, url: `${base}${legalPath(meta.slug)}` },
        ])}
      />

      <Breadcrumbs
        items={[{ name: "Home", href: "/" }, { name: "Legal" }, { name: meta.navLabel }]}
      />

      <article className="mt-6">
        <header className="flex flex-col gap-3 border-b border-border pb-6">
          <h1 className="font-display text-3xl font-bold leading-tight text-foreground sm:text-4xl">
            {meta.title}
          </h1>
          <p className="text-muted">{meta.description}</p>
          <p className="text-sm text-muted">
            Last updated{" "}
            <time dateTime={meta.effectiveIso}>{meta.effectiveLabel}</time>
          </p>
        </header>

        <div className="mt-8 flex flex-col gap-8">
          {meta.sections.map((section) => (
            <section key={section.heading} className="flex flex-col gap-3">
              <h2 className="font-display text-xl font-bold text-foreground">{section.heading}</h2>
              {section.body.map((p, i) => (
                <p key={i} className="leading-relaxed text-muted">
                  {p}
                </p>
              ))}
              {section.bullets && (
                <ul className="ml-5 flex list-disc flex-col gap-2 text-muted marker:text-muted">
                  {section.bullets.map((b, i) => (
                    <li key={i} className="leading-relaxed">
                      {b}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </article>

      {/* Cross-links to the other legal documents (no orphans, §12 rule 4). */}
      <nav aria-label="Other legal documents" className="mt-12 border-t border-border pt-6">
        <h2 className="font-display text-sm font-bold text-foreground">More policies</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {others.map((slug) => (
            <li key={slug}>
              <Link
                href={legalPath(slug)}
                className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                {legalDocs[slug].navLabel}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
