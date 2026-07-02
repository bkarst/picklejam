import type { Metadata } from "next";
import Link from "next/link";
import { getCountry, getTopCities, getTopStates } from "@/lib/data/geo";
import { buildMetadata } from "@/lib/seo/metadata";
import { faqPageJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { HeroSearch } from "@/components/home/HeroSearch";
import { CityCard, StatLine } from "@/components/directory";
import { FaqAccordion } from "@/components/ui/FaqAccordion";
import { countryPath, courtTypePath } from "@/lib/urls";
import { stateUrl } from "@/lib/urls";
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
  const [us, topCities, topStates] = await Promise.all([
    getCountry("us"),
    getTopCities("us", 8),
    getTopStates("us", 6),
  ]);

  const ctas = [
    { title: "Round Robin", body: "Quick matches. Rotating partners.", href: "/round-robin", cta: "Create Round Robin" },
    { title: "Leagues", body: "Join a league and play weekly.", href: "/leagues", cta: "Browse Leagues" },
    { title: "Tournaments", body: "Compete. Climb. Win.", href: "/tournaments", cta: "Find Tournaments" },
  ];

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

      <div className="mx-auto w-full max-w-7xl px-4 py-12">
        {/* Explore places to play */}
        <section aria-labelledby="explore-heading">
          <div className="flex items-baseline justify-between">
            <h2 id="explore-heading" className="font-display text-2xl font-bold text-foreground">
              Explore places to play
            </h2>
            <Link href="/courts" className="text-sm font-semibold text-accent hover:underline">
              View all cities →
            </Link>
          </div>

          {topCities.length > 0 ? (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {topCities.map((c) => (
                <CityCard key={c.cityKey} city={c} />
              ))}
            </div>
          ) : (
            <p className="mt-4 text-muted">The directory is being populated — check back soon.</p>
          )}

          {/* Secondary groupings */}
          <div className="mt-6 flex flex-wrap gap-2">
            {topStates.map((s) => (
              <Link key={s.code} href={stateUrl(s)} className="rounded-full border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-secondary">
                {s.name}
              </Link>
            ))}
            <Link href={countryPath("us")} className="rounded-full border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-secondary">All states</Link>
            {["indoor", "outdoor", "lighted", "dedicated"].map((t) => (
              <Link key={t} href={courtTypePath(t)} className="rounded-full border border-border px-3 py-1.5 text-sm capitalize text-foreground hover:bg-surface-secondary">
                {t}
              </Link>
            ))}
          </div>
        </section>

        {/* Organize CTAs */}
        <section className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {ctas.map((c) => (
            <div key={c.title} className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-5">
              <div>
                <h3 className="font-display text-lg font-bold text-foreground">{c.title}</h3>
                <p className="mt-1 text-sm text-muted">{c.body}</p>
              </div>
              <Link href={c.href} className="mt-4 inline-flex h-10 w-fit items-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                {c.cta}
              </Link>
            </div>
          ))}
        </section>

        {/* FAQ */}
        <section className="mt-12 max-w-3xl">
          <h2 className="font-display text-2xl font-bold text-foreground">Frequently asked questions</h2>
          <div className="mt-4">
            <FaqAccordion items={HOME_FAQ} />
          </div>
        </section>
      </div>
    </>
  );
}
