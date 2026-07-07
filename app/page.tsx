import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getCountry } from "@/lib/data/geo";
import { buildMetadata } from "@/lib/seo/metadata";
import { faqPageJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { HeroSearch } from "@/components/home/HeroSearch";
import { PlayFeatures } from "@/components/home/PlayFeatures";
import { StatLine } from "@/components/directory";
import { FaqAccordion } from "@/components/ui/FaqAccordion";
import { countryPath } from "@/lib/urls";
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

  return (
    <>
      <JsonLd data={faqPageJsonLd(HOME_FAQ)} />
      {/* Hero */}
      <section className="border-b border-border bg-surface">
        <main id="main" className="mx-auto w-full max-w-7xl px-4 py-16">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">
            {brand.identity.taglineMarketing}
          </p>
          <h1 className="mt-2 max-w-3xl font-display text-4xl font-bold text-accent sm:text-5xl">
            Find pickleball near you
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-muted">{brand.identity.description}</p>
          <div className="mt-6">
            <HeroSearch />
          </div>
          {us && (
            <div className="mt-4">
              <StatLine
                items={[
                  { value: us.counts?.locations ?? 0, label: "Locations" },
                  { value: us.counts?.courts ?? 0, label: "Courts" },
                  { value: us.counts?.cities ?? 0, label: "Cities" },
                ]}
              />
            </div>
          )}
        </main>
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
