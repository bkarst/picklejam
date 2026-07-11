import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getCountry } from "@/lib/data/geo";
import { buildMetadata } from "@/lib/seo/metadata";
import { faqPageJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { HeroSearch } from "@/components/home/HeroSearch";
import { PlayFeatures } from "@/components/home/PlayFeatures";
import { FaqAccordion } from "@/components/ui/FaqAccordion";
import { countryPath, groupNewPath, discoverPath } from "@/lib/urls";
import { brand } from "@/brand.config";

export const revalidate = 3600;

export const metadata: Metadata = buildMetadata({
  title: `${brand.identity.name} — ${brand.identity.tagline}`,
  description: brand.identity.description,
  path: "/",
});

const HOME_FAQ = [
  { question: "How do I find pickleball courts near me?", answer: `Search your city on ${brand.identity.name} or browse the court directory by state and city to find places to play, complete with amenities, schedules, and reviews.` },
  { question: `Is ${brand.identity.name} free to use?`, answer: `Yes — finding courts, checking in, organizing games, and running round robins are free. Paid tournaments and leagues add registration and payouts.` },
  { question: "Can I organize my own games or events?", answer: "Yes — host a free round robin with no account, schedule outings, or run paid tournaments and leagues with Stripe registration." },
];

export default async function Home() {
  const us = await getCountry("us");

  const courtCount = us?.counts?.courts;
  const cityCount = us?.counts?.cities;
  const searchPlaceholder =
    courtCount && cityCount
      ? `Search ${courtCount.toLocaleString("en-US")} courts and ${cityCount.toLocaleString("en-US")} cities…`
      : "Search courts or cities…";

  return (
    <>
      <JsonLd data={faqPageJsonLd(HOME_FAQ)} />
      {/* Hero */}
      <section className="border-b border-border bg-surface">
        <main
          id="main"
          className="mx-auto flex w-full max-w-7xl flex-col items-center px-4 py-16 text-center"
        >
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">
            {brand.identity.taglineMarketing}
          </p>
          <h1 className="mt-2 max-w-3xl font-display text-4xl font-bold normal-case text-accent sm:text-5xl">
            Find pickleball near you
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-muted">{brand.identity.description}</p>
          <div className="mt-6 w-full max-w-xl">
            <HeroSearch placeholder={searchPlaceholder} />
          </div>
          {/* Secondary CTA — organize a group */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm text-muted">
            <span>Running a club or crew?</span>
            <Link
              href={groupNewPath()}
              className="inline-flex h-11 items-center gap-1.5 rounded-full border border-border bg-surface px-4 font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <svg
                viewBox="0 0 24 24"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              Start a group
            </Link>
          </div>
        </main>
      </section>

      {/* Groups — Find your pickleball people (§6.9) */}
      <section>
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:py-16">
          <div className="overflow-hidden rounded-3xl bg-surface shadow-[10px_10px_0_0_var(--accent)]">
            <div className="grid grid-cols-1 lg:grid-cols-2">
              {/* Copy */}
              <div className="flex flex-col justify-center gap-5 p-8 sm:p-12">
                <p className="text-sm font-bold uppercase tracking-wider text-secondary">
                  Community · Your crew
                </p>
                <h2 className="font-display text-4xl font-bold uppercase leading-[0.95] text-accent sm:text-5xl">
                  Find your pickleball people
                </h2>
                <p className="max-w-md text-lg text-muted">
                  Groups are your club, crew, or regulars — a home base for meet-ups, members, and
                  who&apos;s looking to play. Private and invite-only by default.
                </p>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href={groupNewPath()}
                    className="inline-flex h-12 items-center justify-center rounded-full bg-secondary px-8 text-base font-bold uppercase tracking-wide text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    Start a group
                  </Link>
                  <Link
                    href={discoverPath("groups")}
                    className="inline-flex h-12 items-center justify-center rounded-full border-2 border-accent px-8 text-base font-bold uppercase tracking-wide text-accent transition-colors hover:bg-accent/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    Find a group
                  </Link>
                </div>
              </div>
              {/* Photo */}
              <div className="relative min-h-[18rem] lg:min-h-0">
                <Image
                  src="/images/home/cta-community.jpg"
                  alt="Pickleball players greeting each other at the net"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover object-center"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ways to play — Round Robin, Leagues, Tournaments (full-bleed bands) */}
      <PlayFeatures />

      {/* Community CTA — full-bleed photo band */}
      <section className="relative isolate overflow-hidden">
        <Image
          src="/images/home/cta-community.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
        <div
          className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/65 to-black/35"
          aria-hidden="true"
        />
        <div className="relative mx-auto w-full max-w-7xl px-4 py-20 sm:py-28">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white backdrop-blur">
              <span className="size-1.5 rounded-full bg-brand-lime" aria-hidden="true" />
              Get on the court
            </span>
            <h2 className="mt-4 font-display text-3xl font-bold text-white sm:text-4xl">
              Your next game is a tap away
            </h2>
            <p className="mt-3 text-lg text-white/85">
              Thousands of courts, games, and players near you. Find your spot, check in, meet the
              regulars, and play more pickleball.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/search"
                className="inline-flex h-12 items-center justify-center rounded-full bg-brand-lime px-7 text-base font-semibold text-accent transition-transform hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Find courts near me
              </Link>
              <Link
                href={countryPath("us")}
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/40 px-7 text-base font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Browse the directory
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:py-20">
        {/* FAQ */}
        <section>
          <h2 className="font-display text-2xl font-bold text-foreground">Frequently asked questions</h2>
          <div className="mt-4">
            <FaqAccordion items={HOME_FAQ} />
          </div>
        </section>
      </div>
    </>
  );
}
