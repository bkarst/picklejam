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
import { HubHero, HubSteps, HubFaq, Overline, hubButtonClass, type HubAction } from "@/components/hub";
import { RotationMotif } from "@/components/hub/motifs";
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

const STEPS = [
  { title: "Add your players", body: "Type names or paste a whole list. Ratings are optional." },
  { title: "Pick a format", body: "See a live preview of round 1 and the full schedule as you tweak." },
  { title: "Share the link", body: "Everyone follows along; you tap in scores and standings update." },
];

const SparkleIcon = (
  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 3v4M3 5h4M6 17v4M4 19h4" />
    <path d="M13 3 15.5 9.5 22 12l-6.5 2.5L13 21l-2.5-6.5L4 12l6.5-2.5z" />
  </svg>
);

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
  const actions: HubAction[] = [
    { href: roundRobinNewPath(), label: "Create a round robin", variant: "primary", icon: SparkleIcon },
    { href: roundRobinQuizPath(), label: "Which format? Take the quiz", variant: "outline" },
  ];
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

      <HubHero
        overline="Free tool · No sign-up"
        title="Free round robin generator for pickleball"
        body="Build a fair, balanced round robin, mixer, Swiss, or pool-play bracket in minutes — then share one link so everyone at the courts sees the schedule, live scores, and standings."
        actions={actions}
        motif={<RotationMotif />}
        motifTone="lime"
      />

      <HubSteps steps={STEPS} />

      {/* Format gallery */}
      <section className="mt-12">
        <Overline>Five ways to play</Overline>
        <h2 className="mt-2 font-display text-3xl text-foreground">Pick your format</h2>
        <p className="mt-3 max-w-2xl text-muted">
          From a fair everyone-plays-everyone round robin to a full pools-and-bracket tournament.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RR_FORMATS.map((meta) => (
            <FormatCard key={meta.id} meta={meta} href={`${roundRobinNewPath()}?format=${meta.id}`} />
          ))}
        </div>
      </section>

      <HubFaq faqs={FAQS} />

      {/* Final CTA */}
      <section className="pj-sticker mt-12 mb-4 flex flex-col items-center gap-4 rounded-[1.5rem] bg-brand-bubblegum p-8 text-center sm:p-10">
        <h2 className="font-display text-3xl text-foreground">Ready to play more?</h2>
        <p className="max-w-xl text-muted">
          Set up your next round robin in a couple of minutes — free, no sign-up.
        </p>
        <Link href={roundRobinNewPath()} className={hubButtonClass.primary}>
          {SparkleIcon}
          Create a round robin
        </Link>
      </section>
    </main>
  );
}
