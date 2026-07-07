import type { Metadata } from "next";
import type { JSX } from "react";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbListJsonLd, faqPageJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/directory";
import { leaguesHub, laddersHub, organizeLeagueNew, discoverPath } from "@/lib/urls";
import { brand } from "@/brand.config";

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: "Pickleball Leagues & Ladders — Find, Join & Organize",
    description: `Find and join pickleball leagues and ladders near you, or run your own — ${brand.identity.name} handles the brackets, scheduling, matchups, and standings so you can focus on playing.`,
    path: leaguesHub(),
  });
}

const FAQS = [
  {
    question: "What's the difference between a league and a ladder?",
    answer:
      "A league has fixed teams playing a set weekly schedule against other teams in your division. A ladder is individual and ongoing — you climb by challenging and beating players ranked above you.",
  },
  {
    question: "How do I join a pickleball league?",
    answer:
      "Open a league, pick your division or flight, register with a partner or join the free-agent pool, and pay securely through Stripe. You'll get a schedule, live standings, and score confirmation each week.",
  },
  {
    question: `How much does it cost to run a league on ${brand.identity.name}?`,
    answer:
      "Creating and publishing a league or ladder is free. A small platform fee applies per registration — you choose whether to absorb it or pass it to players.",
  },
];

const STEPS: { n: number; title: string; body: string }[] = [
  { n: 1, title: "Create", body: "Set up your league or ladder in minutes." },
  { n: 2, title: "Automate", body: "Schedules, matchups, and notifications — handled." },
  { n: 3, title: "Format", body: "Balanced play with fair matchups every week." },
  { n: 4, title: "Live standings", body: "Track results and see who's on top." },
  { n: 5, title: "Playoffs", body: "Top teams advance to win it all." },
];

function Compare({
  title,
  body,
  tags,
  icon,
}: {
  title: string;
  body: string;
  tags: string[];
  icon: JSX.Element;
}): JSX.Element {
  return (
    <div className="flex gap-4">
      <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        {icon}
      </span>
      <div>
        <h3 className="font-display text-lg font-bold text-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted">{body}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {tags.map((t) => (
            <span key={t} className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-foreground">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LeaguesHubPage() {
  const base = brand.siteUrl;
  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <JsonLd
        data={[
          breadcrumbListJsonLd([
            { name: "Home", url: base },
            { name: "Leagues & Ladders", url: `${base}${leaguesHub()}` },
          ]),
          faqPageJsonLd(FAQS),
        ]}
      />

      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Leagues & Ladders" }]} />

      {/* Hero */}
      <section className="mt-4 grid grid-cols-1 gap-6 overflow-hidden rounded-3xl border border-border bg-surface p-6 sm:p-10 lg:grid-cols-2">
        <div>
          <h1 className="max-w-xl font-display text-3xl font-bold text-foreground sm:text-5xl">
            Leagues &amp; ladders on autopilot
          </h1>
          <p className="mt-3 max-w-lg text-muted">
            We handle the brackets, scheduling, matchups, and standings — so you can focus on playing.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={discoverPath("leagues")}
              className="inline-flex h-12 items-center rounded-full bg-secondary px-6 text-base font-semibold text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Find a league
            </Link>
            <Link
              href={organizeLeagueNew()}
              className="inline-flex h-12 items-center rounded-full border border-border px-6 text-base font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Run a league
            </Link>
          </div>
        </div>

        {/* Leagues vs Ladders */}
        <div className="flex flex-col justify-center gap-6 rounded-2xl border border-border bg-background/40 p-6">
          <p className="text-center font-display text-base font-bold text-foreground">Leagues vs. Ladders</p>
          <Compare
            title="Leagues"
            body="Fixed teams. Play a set schedule against other teams in your division."
            tags={["Team-based", "Season-long"]}
            icon={
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /></svg>
            }
          />
          <Compare
            title="Ladders"
            body="Climb the ladder by beating players above you. Move up, stay on top."
            tags={["Individual", "Ongoing"]}
            icon={
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 3v18M17 3v18M7 7h10M7 12h10M7 17h10" /></svg>
            }
          />
          <Link href={laddersHub()} className="text-center text-sm font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
            Explore ladders →
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-bold text-foreground">How it works</h2>
        <ol className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s) => (
            <li key={s.n} className="rounded-2xl border border-border bg-surface p-5">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-accent/10 font-display text-base font-bold text-accent">
                {s.n}
              </span>
              <h3 className="mt-3 font-display text-base font-bold text-foreground">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
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
