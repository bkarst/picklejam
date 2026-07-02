import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbListJsonLd, faqPageJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/directory";
import { laddersHub, leaguesHub, organizeLeagueNew } from "@/lib/urls";
import { brand } from "@/brand.config";

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: "Pickleball Ladders — Challenge, Climb & Organize",
    description: `Join a pickleball ladder near you and climb the rankings by challenging players above you, or run your own on ${brand.identity.name}. Individual, ongoing, and always competitive.`,
    path: laddersHub(),
  });
}

const FAQS = [
  {
    question: "How does a pickleball ladder work?",
    answer:
      "Every player holds a rung. You climb by challenging someone ranked above you within the challenge range and beating them — they and everyone in between slide down a rung. It's individual and ongoing, with no fixed schedule.",
  },
  {
    question: "How do challenges and the response window work?",
    answer:
      "You issue a challenge to a player above you. They have a set number of days to respond before forfeiting. After you play, one player reports the score and the other confirms — then the board re-ranks automatically.",
  },
  {
    question: `How much does it cost to run a ladder on ${brand.identity.name}?`,
    answer:
      "Creating a ladder is free. Players pay a membership fee to join; a small platform fee applies per registration, which you can absorb or pass on.",
  },
];

const STEPS = [
  { n: 1, title: "Join", body: "Pay once and claim your starting rung." },
  { n: 2, title: "Challenge", body: "Challenge players above you within range." },
  { n: 3, title: "Play & report", body: "Play your match and report the score." },
  { n: 4, title: "Climb", body: "Win to take their rung and rise up the board." },
];

export default function LaddersHubPage() {
  const base = brand.siteUrl;
  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <JsonLd
        data={[
          breadcrumbListJsonLd([
            { name: "Home", url: base },
            { name: "Ladders", url: `${base}${laddersHub()}` },
          ]),
          faqPageJsonLd(FAQS),
        ]}
      />

      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Ladders" }]} />

      <section className="mt-4 overflow-hidden rounded-3xl border border-border bg-surface p-6 sm:p-10">
        <h1 className="max-w-2xl font-display text-3xl font-bold text-foreground sm:text-5xl">
          Climb the pickleball ladder
        </h1>
        <p className="mt-3 max-w-xl text-muted">
          Challenge players above you, win, and move up. Individual, ongoing, and always competitive —
          we handle the rankings and challenge deadlines.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/search" className="inline-flex h-12 items-center rounded-full bg-secondary px-6 text-base font-semibold text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
            Find a ladder
          </Link>
          <Link href={organizeLeagueNew()} className="inline-flex h-12 items-center rounded-full border border-border px-6 text-base font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
            Run a ladder
          </Link>
          <Link href={leaguesHub()} className="inline-flex h-12 items-center rounded-full px-2 text-base font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
            Prefer teams? Explore leagues →
          </Link>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-bold text-foreground">How it works</h2>
        <ol className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.n} className="rounded-2xl border border-border bg-surface p-5">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-accent/10 font-display text-base font-bold text-accent">{s.n}</span>
              <h3 className="mt-3 font-display text-base font-bold text-foreground">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

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
