import type { Metadata } from "next";
import type { JSX } from "react";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbListJsonLd, faqPageJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/directory";
import { tournamentsHub } from "@/lib/urls";
import { brand } from "@/brand.config";

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: "Pickleball Tournaments — Find, Register & Organize",
    description: `Find pickleball tournaments near you and register online, or organize your own — collect entry fees, run divisions, and share live brackets on ${brand.identity.name}.`,
    path: tournamentsHub(),
  });
}

const FAQS = [
  {
    question: "How do I register for a pickleball tournament?",
    answer:
      "Open a tournament, pick your division, add a partner for doubles, and pay securely through Stripe. You'll get a confirmation and can view the live bracket during the event.",
  },
  {
    question: `How much does it cost to run a tournament on ${brand.identity.name}?`,
    answer:
      "Creating and publishing a tournament is free. A small platform fee applies per registration — you choose whether to absorb it or pass it to registrants.",
  },
  {
    question: "Can I offer multiple divisions?",
    answer:
      "Yes. Add as many divisions as you like — each with its own skill or DUPR range, entry fee, capacity, and singles/doubles format.",
  },
];

function Step({ n, title, body }: { n: number; title: string; body: string }): JSX.Element {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <span className="inline-flex size-9 items-center justify-center rounded-full bg-accent/10 font-display text-base font-bold text-accent">
        {n}
      </span>
      <h3 className="mt-3 font-display text-lg font-bold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </div>
  );
}

export default function TournamentsHubPage() {
  const base = brand.siteUrl;
  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <JsonLd
        data={[
          breadcrumbListJsonLd([
            { name: "Home", url: base },
            { name: "Tournaments", url: `${base}${tournamentsHub()}` },
          ]),
          faqPageJsonLd(FAQS),
        ]}
      />

      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Tournaments" }]} />

      {/* Hero */}
      <section className="mt-4 overflow-hidden rounded-3xl border border-border bg-surface p-6 sm:p-10">
        <h1 className="max-w-2xl font-display text-3xl font-bold text-foreground sm:text-5xl">
          Pickleball tournaments, made easy
        </h1>
        <p className="mt-3 max-w-xl text-muted">
          Find and register for tournaments near you, or organize your own — collect entry fees,
          manage divisions, and share live brackets.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/search"
            className="inline-flex h-12 items-center rounded-full bg-secondary px-6 text-base font-semibold text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Find a tournament
          </Link>
          <Link
            href="/organize/tournaments/new"
            className="inline-flex h-12 items-center rounded-full border border-border px-6 text-base font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Organize a tournament
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-bold text-foreground">How it works</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Step n={1} title="Create your event" body="Set dates, venue, divisions, and entry fees in a few minutes." />
          <Step n={2} title="Connect payouts" body="Link Stripe to accept registrations and get paid directly." />
          <Step n={3} title="Publish & play" body="Share your page, take registrations, and run live brackets." />
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-bold text-foreground">Frequently asked questions</h2>
        <dl className="mt-4 divide-y divide-border rounded-2xl border border-border bg-surface">
          {FAQS.map((f) => (
            <div key={f.question} className="p-5">
              <dt className="font-display text-base font-bold text-foreground">{f.question}</dt>
              <dd className="mt-1 text-sm text-muted">{f.answer}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
