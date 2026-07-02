import type { Metadata } from "next";
import type { JSX } from "react";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  softwareApplicationJsonLd,
  faqPageJsonLd,
  breadcrumbListJsonLd,
} from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/directory";
import { FaqAccordion } from "@/components/ui/FaqAccordion";
import { FormatCard, RR_FORMATS } from "@/components/roundrobin";
import { roundRobinNewPath, roundRobinQuizPath, roundRobinLanding } from "@/lib/urls";
import { brand } from "@/brand.config";

/** Slow-changing marketing surface — rebuild at most once/day (§3, ISR). */
export const revalidate = 86400;

const FAQS: { question: string; answer: string }[] = [
  {
    question: "Is the round robin generator free?",
    answer:
      "Yes — it's completely free and there's no sign-up. Add your players, pick a format, and share the link in seconds. No credit card, no account, no catch.",
  },
  {
    question: "Do players need an account to join?",
    answer:
      "No. Anyone with the link can see the schedule, standings, and live scores. Only you, the organizer, can enter scores — from the private link saved on your device when you created the event.",
  },
  {
    question: "How many players can I add?",
    answer:
      "Anywhere from 4 to 24 or more, in singles or doubles. Each format has a recommended range, and the live preview tells you right away if your setup will work.",
  },
  {
    question: "What's the difference between the formats?",
    answer:
      "Round Robin has everyone play everyone. Popcorn Mixer rotates partners for a social doubles session. Up & Down the River moves winners between courts. Swiss matches players on similar records. Pools → Bracket runs groups into a playoff to crown a champion. Not sure? Take the 30-second quiz.",
  },
  {
    question: "Can I run it from my phone at the courts?",
    answer:
      "Absolutely. The run console is built for phones — big tap targets, one-tap score entry, and a bye/sub list so you always know who's on and who's sitting out.",
  },
  {
    question: "Will the schedule be fair?",
    answer:
      "Yes. Every schedule is balanced so players get similar numbers of games, partners, and byes — and the exact same schedule shows for everyone who opens the link.",
  },
];

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: "Free Round Robin Generator for Pickleball",
    description:
      "Create fair, balanced pickleball round robins, mixers, Swiss, and pool-play brackets in seconds — free, no sign-up. Share a live scoreboard with everyone at the courts.",
    path: roundRobinLanding(),
    keywords: [
      "pickleball round robin generator",
      "round robin scheduler",
      "pickleball mixer",
      "king of the court",
      "pickleball bracket maker",
    ],
  });
}

export default function RoundRobinLandingPage(): JSX.Element {
  const base = brand.siteUrl;
  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <JsonLd
        data={[
          breadcrumbListJsonLd([
            { name: "Home", url: base },
            { name: "Round Robin Generator", url: `${base}${roundRobinLanding()}` },
          ]),
          softwareApplicationJsonLd(),
          faqPageJsonLd(FAQS),
        ]}
      />

      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Round Robin" }]} />

      {/* Hero */}
      <section className="mt-6 flex flex-col items-start gap-5 rounded-3xl border border-border bg-surface p-6 sm:p-10">
        <span className="inline-flex items-center gap-2 rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-foreground">
          <span className="inline-block size-2 rounded-full bg-success" aria-hidden="true" />
          Free tool · No sign-up
        </span>
        <h1 className="max-w-3xl font-display text-4xl font-bold leading-tight text-foreground sm:text-5xl">
          Free Round Robin Generator for Pickleball
        </h1>
        <p className="max-w-2xl text-lg text-muted">
          Build a fair, balanced round robin, mixer, Swiss, or pool-play bracket in minutes —
          then share one link so everyone at the courts sees the schedule, live scores, and standings.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={roundRobinNewPath()}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-secondary px-7 text-base font-semibold text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 3v4M3 5h4M6 17v4M4 19h4" /><path d="M13 3 15.5 9.5 22 12l-6.5 2.5L13 21l-2.5-6.5L4 12l6.5-2.5z" /></svg>
            Create a round robin
          </Link>
          <Link
            href={roundRobinQuizPath()}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border px-7 text-base font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Which format? Take the quiz
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">How it works</h2>
        <ol className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { n: 1, t: "Add your players", d: "Type names or paste a whole list. Ratings are optional." },
            { n: 2, t: "Pick a format", d: "See a live preview of round 1 and the full schedule as you tweak." },
            { n: 3, t: "Share the link", d: "Everyone follows along; you tap in scores and standings update." },
          ].map((s) => (
            <li key={s.n} className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-5">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                {s.n}
              </span>
              <h3 className="font-display text-lg font-bold text-foreground">{s.t}</h3>
              <p className="text-sm text-muted">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Format gallery */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Pick your format</h2>
        <p className="mt-2 max-w-2xl text-muted">
          Five ways to play — from a fair everyone-plays-everyone round robin to a full pools-and-bracket tournament.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RR_FORMATS.map((meta) => (
            <FormatCard key={meta.id} meta={meta} href={`${roundRobinNewPath()}?format=${meta.id}`} />
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Frequently asked questions</h2>
        <div className="mt-5">
          <FaqAccordion items={FAQS} />
        </div>
      </section>

      {/* Final CTA */}
      <section className="mt-12 flex flex-col items-center gap-4 rounded-3xl border border-secondary/40 bg-secondary/5 p-8 text-center">
        <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
          Ready to play more?
        </h2>
        <p className="max-w-xl text-muted">
          Set up your next round robin in a couple of minutes — free, no sign-up.
        </p>
        <Link
          href={roundRobinNewPath()}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-secondary px-7 text-base font-semibold text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Create a round robin
        </Link>
      </section>
    </main>
  );
}
