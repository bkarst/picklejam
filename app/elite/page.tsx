/**
 * Elite landing — `/elite` (§G12.17). ISR(86400), indexable. The program's public explainer:
 * hero → criteria (rendered from the LIVE config, never hand-written copy that can drift) →
 * perks → the current-year cohort strip (approved public members) → self-nomination CTA →
 * FAQ (FAQPage JSON-LD). The criteria being public is the fairness guarantee (§G11).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { getEliteCohort } from "@/lib/data/gamify-elite";
import { eliteCriteriaCopy, currentEliteYear } from "@/lib/gamify/elite";
import { EliteNominateCTA } from "@/components/gamify/EliteNominateCTA";
import { GamifyAvatar } from "@/components/gamify/GamifyAvatar";
import { buildMetadata } from "@/lib/seo/metadata";
import { faqPageJsonLd, breadcrumbListJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/directory";
import { nowMs } from "@/lib/directory/court-local-day";
import { brand } from "@/brand.config";

export const revalidate = 86400;

const PERKS = [
  { icon: "🏅", title: "Elite badge + gold ring", body: "A year-stamped crest on your profile and a subtle gold ring — yours to keep forever." },
  { icon: "✍️", title: "Elite review styling", body: "A small crest on your reviews marks a trusted local voice — quiet, never louder content." },
  { icon: "🚀", title: "Early access", body: "First look at new features and betas before anyone else." },
  { icon: "🎟️", title: "Partner perks", body: "Reserved-free entries or merch at partner events, where available." },
];

function faqs(year: string) {
  return [
    { question: "How do I become Elite?", answer: "Meet the public criteria in the qualifying year, then nominate yourself (or get auto-flagged). A quick human review confirms each year's cohort." },
    { question: "Does Elite cost anything?", answer: "No. Elite is earned through participation and quality contributions — it can never be purchased, and no criterion involves money." },
    { question: "Do I keep it forever?", answer: `Status is re-earned each year to keep it meaningful, but you keep the year-stamped Elite ${year} badge permanently, even if you don't re-qualify.` },
    { question: "Can Elite status be revoked?", answer: "A moderation strike for fabricated activity or review farming voids eligibility and can revoke status. The bar is honest activity." },
  ];
}

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: `${brand.identity.name} Elite`,
    description: "Elite is our annual, quality-gated status for the players who make local pickleball better — real reviews, real check-ins, real community.",
    path: "/elite",
  });
}

export default async function ElitePage() {
  const year = currentEliteYear(nowMs());
  const cohort = await getEliteCohort(year);
  const criteria = eliteCriteriaCopy();
  const base = brand.siteUrl;
  const faq = faqs(year);

  return (
    <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <JsonLd
        data={[
          breadcrumbListJsonLd([
            { name: "Home", url: base },
            { name: "Elite", url: `${base}/elite` },
          ]),
          faqPageJsonLd(faq),
        ]}
      />

      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Elite" }]} />

      {/* Hero */}
      <section className="mt-6 text-center">
        <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-warning/15 text-4xl" aria-hidden="true">🏆</div>
        <h1 className="mt-4 font-display text-4xl font-bold text-accent">{brand.identity.name} Elite {year}</h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg text-muted">
          An annual, quality-gated recognition for the players who put their courts on the map — real reviews, real check-ins, real community. Earned, never bought.
        </p>
        <div className="mt-6 flex justify-center">
          <EliteNominateCTA year={year} />
        </div>
      </section>

      {/* Criteria — rendered from the live config */}
      <section className="mt-12" aria-labelledby="criteria-heading">
        <h2 id="criteria-heading" className="font-display text-2xl font-bold text-foreground">How to qualify</h2>
        <p className="mt-1 text-sm text-muted">The bar is public — that&apos;s the fairness guarantee. Meet it in {year}:</p>
        <ul className="mt-4 flex flex-col gap-3">
          {criteria.map((c) => (
            <li key={c} className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0 text-success" aria-hidden="true">✓</span>
              <span className="text-foreground">{c}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Perks */}
      <section className="mt-12" aria-labelledby="perks-heading">
        <h2 id="perks-heading" className="font-display text-2xl font-bold text-foreground">What Elite gets you</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PERKS.map((p) => (
            <div key={p.title} className="rounded-2xl border border-border bg-surface p-4">
              <div className="text-2xl" aria-hidden="true">{p.icon}</div>
              <h3 className="mt-2 font-semibold text-foreground">{p.title}</h3>
              <p className="mt-1 text-sm text-muted">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cohort strip */}
      {cohort.length > 0 && (
        <section className="mt-12" aria-labelledby="cohort-heading">
          <h2 id="cohort-heading" className="font-display text-2xl font-bold text-foreground">
            The {year} cohort · {cohort.length}
          </h2>
          <ul className="mt-4 flex flex-wrap gap-3">
            {cohort.map((m) => (
              <li key={m.uid}>
                <Link href={`/players/${m.username}`} className="flex flex-col items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-accent">
                  <GamifyAvatar name={m.displayName} avatarUrl={m.avatarUrl} className="size-14 text-base ring-2 ring-warning/70" />
                  <span className="max-w-[5rem] truncate text-xs font-medium text-foreground">{m.displayName}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Terms */}
      <section className="mt-12 rounded-2xl border border-border bg-surface-secondary p-5" aria-labelledby="terms-heading">
        <h2 id="terms-heading" className="font-display text-lg font-bold text-foreground">Program terms</h2>
        <p className="mt-2 text-sm text-muted">
          Elite status is awarded for a single calendar year and must be re-earned each year. You keep the year-stamped badge permanently. Status is granted at
          our discretion after a human review of the public criteria, and may be withheld or revoked for moderation strikes (including fabricated check-ins or
          review farming). No perk, badge, or criterion can be purchased. See the{" "}
          <Link href="/legal/community-guidelines" className="font-semibold text-accent hover:underline">Community Guidelines</Link> for the integrity rules.
        </p>
      </section>

      {/* FAQ */}
      <section className="mt-12" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="font-display text-2xl font-bold text-foreground">Elite FAQ</h2>
        <dl className="mt-4 flex flex-col gap-4">
          {faq.map((qa) => (
            <div key={qa.question}>
              <dt className="font-semibold text-foreground">{qa.question}</dt>
              <dd className="mt-1 text-muted">{qa.answer}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
