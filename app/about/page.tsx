import type { Metadata } from "next";
import type { JSX } from "react";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { organizationJsonLd, breadcrumbListJsonLd, type JsonLd as JsonLdData } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/directory";
import { aboutPath, contactPath, pricingPath, roundRobinLanding } from "@/lib/urls";
import { brand } from "@/brand.config";

/** Slow-changing marketing surface — rebuild at most once/day (§3, ISR). */
export const revalidate = 86400;

const NAME = brand.identity.name;

/** What we care about — the E-E-A-T "why you can trust us" pillars. */
const VALUES: { title: string; body: string }[] = [
  {
    title: "Players first",
    body: "We're pickleball players building for pickleball players. Every feature starts with a real problem at a real court.",
  },
  {
    title: "Free where it counts",
    body: "Finding courts, games, and players — and running a round robin — is free and always will be. We only charge when we help run paid events.",
  },
  {
    title: "Accurate & open",
    body: "We work to keep court info current, label what we're unsure about, and make it easy to correct. No dark patterns, no fake reviews.",
  },
  {
    title: "Built to be inclusive",
    body: "From beginners to 5.0s, the app is designed to be welcoming, accessible, and safe for everyone who wants to play.",
  },
];

/** The AboutPage schema.org node (built inline; JsonLd accepts any JSON-LD object). */
function aboutPageJsonLd(): JsonLdData {
  return {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: `About ${NAME}`,
    description: `${NAME}'s mission is to help people find pickleball near them and play more of it.`,
    url: `${brand.siteUrl}${aboutPath()}`,
    mainEntity: {
      "@type": "Organization",
      name: NAME,
      legalName: brand.identity.legalName,
      url: brand.siteUrl,
    },
  };
}

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: `About ${NAME}`,
    description: `${NAME}'s mission, story, and the people behind it. We help you find pickleball courts, games, and players near you — then play more.`,
    path: aboutPath(),
    keywords: [`about ${NAME.toLowerCase()}`, "pickleball app", "pickleball court finder"],
  });
}

export default function AboutPage(): JSX.Element {
  const base = brand.siteUrl;
  return (
    <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <JsonLd
        data={[
          breadcrumbListJsonLd([
            { name: "Home", url: base },
            { name: "About", url: `${base}${aboutPath()}` },
          ]),
          organizationJsonLd(),
          aboutPageJsonLd(),
        ]}
      />

      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "About" }]} />

      {/* Hero / mission */}
      <section className="mt-6 flex flex-col items-start gap-5">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-lime/25 px-3 py-1 text-xs font-semibold text-foreground">
          Our mission
        </span>
        <h1 className="max-w-3xl font-display text-4xl font-bold leading-tight text-foreground sm:text-5xl">
          {brand.identity.positioning}
        </h1>
        <p className="max-w-2xl text-lg text-muted">
          {brand.identity.description}
        </p>
      </section>

      {/* Story */}
      <section className="mt-12 flex flex-col gap-4">
        <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Our story</h2>
        <div className="flex flex-col gap-4 text-muted">
          <p>
            {NAME} started with a familiar frustration: pickleball is exploding, but finding a good
            court, an open game, and players at your level is still weirdly hard. Court info is
            scattered, schedules live in group chats, and organizing a round robin means wrestling a
            spreadsheet at the net post.
          </p>
          <p>
            So we built one place to do it all — a searchable directory of thousands of courts,
            live games and check-ins, and free tools to organize play. When you want to run
            something bigger, like a tournament, league, or ladder, the same platform handles
            registration, brackets, and standings, so you can spend less time on logistics and more
            time on the court.
          </p>
          <p>
            We&apos;re independent, player-run, and focused on one thing:{" "}
            <span className="font-semibold text-foreground">{brand.identity.taglineMarketing}</span>
          </p>
        </div>
      </section>

      {/* Values / E-E-A-T */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">What we care about</h2>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {VALUES.map((v) => (
            <div key={v.title} className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-5">
              <h3 className="font-display text-lg font-bold text-foreground">{v.title}</h3>
              <p className="text-sm text-muted">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA row */}
      <section className="mt-12 flex flex-col items-start gap-4 rounded-3xl border border-border bg-surface p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">Come play with us</h2>
          <p className="mt-1 max-w-md text-sm text-muted">
            Find a court, start a free round robin, or see how paid events work.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={roundRobinLanding()}
            className="inline-flex h-11 items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Try the free tools
          </Link>
          <Link
            href={pricingPath()}
            className="inline-flex h-11 items-center justify-center rounded-full border border-border px-6 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            See pricing
          </Link>
          <Link
            href={contactPath()}
            className="inline-flex h-11 items-center justify-center rounded-full border border-border px-6 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Contact us
          </Link>
        </div>
      </section>
    </main>
  );
}
