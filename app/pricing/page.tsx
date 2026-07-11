import type { Metadata } from "next";
import type { JSX } from "react";
import { publicEnv } from "@/lib/env";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { organizationJsonLd, faqPageJsonLd, breadcrumbListJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/directory";
import { FaqAccordion } from "@/components/ui/FaqAccordion";
import {
  pricingPath,
  roundRobinLanding,
  tournamentsHub,
  leaguesHub,
  laddersHub,
  organizeTournamentNew,
} from "@/lib/urls";
import { brand } from "@/brand.config";

/** Slow-changing marketing surface — rebuild at most once/day (§3, ISR). */
export const revalidate = 86400;

const NAME = brand.identity.name;

/** Free tools anyone can use, no account or payment required. */
const FREE: { title: string; body: string; href: string }[] = [
  {
    title: "Court directory",
    body: "Search 16,000+ pickleball courts, see amenities and schedules, check in, and read reviews.",
    href: "/courts",
  },
  {
    title: "Find games & players",
    body: "Browse open play and outings near you, RSVP, and connect with players at your level.",
    href: "/search",
  },
  {
    title: "Round robin generator",
    body: "Build fair round robins, mixers, Swiss, and pool-play brackets, and share a live scoreboard — no sign-up.",
    href: roundRobinLanding(),
  },
  {
    title: "Groups & clubs",
    body: "Find or create a local group, organize recurring games, and grow your crew.",
    href: "/groups",
  },
];

/** Paid, organizer-run competition formats (registration + a small platform fee). */
const PAID: { title: string; body: string; href: string }[] = [
  {
    title: "Tournaments",
    body: "Publish a tournament, take registrations and payments, and run live brackets.",
    href: tournamentsHub(),
  },
  {
    title: "Leagues",
    body: "Run multi-week seasons with divisions, schedules, standings, and playoffs.",
    href: leaguesHub(),
  },
  {
    title: "Ladders",
    body: "Set up ongoing challenge ladders with rankings and automated movement.",
    href: laddersHub(),
  },
];

const FAQS: { question: string; answer: string }[] = [
  {
    question: `Is ${NAME} free?`,
    answer:
      "Yes — the core of the app is free. Finding courts, checking in, discovering games and players, and the round-robin generator cost nothing and don't require a subscription. You only pay when you register for or organize a paid event like a tournament, league, or ladder.",
  },
  {
    question: "How does the platform fee work?",
    answer:
      "When you organize a paid event, you set your own registration price. On top of that, we add a small platform fee that covers secure payments, brackets and scheduling, live standings, and support. The organizer chooses whether to absorb that fee or pass it to registrants at checkout — either way it's shown clearly before anyone pays.",
  },
  {
    question: "Are there payment processing charges too?",
    answer:
      "Paid events are handled by our payment provider, which applies standard payment-processing charges. Those are separate from the platform fee. Every charge is itemized before you complete a purchase, so there are no surprises.",
  },
  {
    question: "Do organizers need an account to run a round robin?",
    answer:
      "No. The round-robin generator is free and needs no account — add players, pick a format, and share the link. You only create an account and connect a payout method when you want to charge for a tournament, league, or ladder.",
  },
  {
    question: "How do refunds work for paid events?",
    answer:
      "Each organizer sets a refund policy that's shown at registration. In general, if an organizer cancels an event the platform fee is refunded with the registration; if a registrant cancels, the registration may be refunded per the organizer's policy. See our Refund & Cancellation Policy for details.",
  },
  {
    question: "When do organizers get paid?",
    answer:
      "Registration payments are collected securely and paid out to the organizer's connected account, typically after the event, minus the platform fee. You can review every registration and payout in your organizer dashboard.",
  },
];

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: "Pricing — Free Tools & How Paid Events Work",
    description: `${NAME} is free to find courts, games, and players and to run round robins. Learn how paid tournaments, leagues, and ladders work — and our simple platform fee.`,
    path: pricingPath(),
    keywords: [
      "pickleball app pricing",
      "pickleball tournament software fees",
      "free pickleball round robin",
      "pickleball league platform",
    ],
  });
}

export default function PricingPage(): JSX.Element {
  const base = brand.siteUrl;
  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <JsonLd
        data={[
          breadcrumbListJsonLd([
            { name: "Home", url: base },
            { name: "Pricing", url: `${base}${pricingPath()}` },
          ]),
          organizationJsonLd(),
          faqPageJsonLd(FAQS),
        ]}
      />

      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Pricing" }]} />

      {/* Hero */}
      <section className="mt-6 flex flex-col items-start gap-5 rounded-3xl border border-border bg-surface p-6 sm:p-10">
        <span className="inline-flex items-center gap-2 rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-foreground">
          <span className="inline-block size-2 rounded-full bg-success" aria-hidden="true" />
          Free to find courts, games & players
        </span>
        <h1 className="max-w-3xl font-display text-4xl font-bold leading-tight text-foreground sm:text-5xl">
          Simple pricing: free to play, fair to organize
        </h1>
        <p className="max-w-2xl text-lg text-muted">
          {NAME} is free for everything you need to find pickleball and play more of it. You only
          pay when you register for or organize a paid tournament, league, or ladder — with one
          small, transparent platform fee.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={roundRobinLanding()}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-7 text-base font-semibold text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Try the free round robin tool
          </Link>
          {publicEnv.paidEventsEnabled && (
            <Link
              href={organizeTournamentNew()}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border px-7 text-base font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Organize a paid event
            </Link>
          )}
        </div>
      </section>

      {/* Free vs Paid */}
      <section className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Free */}
        <div className="flex flex-col gap-5 rounded-3xl border border-success/40 bg-success/5 p-6 sm:p-8">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-2xl font-bold text-foreground">Always free</h2>
            <span className="font-display text-3xl font-bold text-success">$0</span>
          </div>
          <p className="text-muted">No account required for the tools below. No subscription, ever.</p>
          <ul className="flex flex-col gap-4">
            {FREE.map((f) => (
              <li key={f.title} className="flex gap-3">
                <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0 text-success" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                <div>
                  <Link href={f.href} className="font-semibold text-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                    {f.title}
                  </Link>
                  <p className="text-sm text-muted">{f.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Paid */}
        <div className="flex flex-col gap-5 rounded-3xl border border-secondary/40 bg-secondary/5 p-6 sm:p-8">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-2xl font-bold text-foreground">Paid events</h2>
            <span className="text-sm font-semibold text-muted">Your price + small platform fee</span>
          </div>
          <p className="text-muted">
            Charge for entry and run the whole thing on {NAME}. You set the registration price; we
            add one small platform fee to power payments, brackets, scheduling, and support.
          </p>
          <ul className="flex flex-col gap-4">
            {PAID.map((p) => (
              <li key={p.title} className="flex gap-3">
                <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0 text-secondary" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                <div>
                  <Link href={p.href} className="font-semibold text-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                    {p.title}
                  </Link>
                  <p className="text-sm text-muted">{p.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How the platform fee works */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
          How the platform fee works
        </h2>
        <p className="mt-2 max-w-2xl text-muted">
          Plain and simple — no monthly fees, and you only pay when money changes hands.
        </p>
        <ol className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              n: 1,
              t: "You set the price",
              d: "Pick the registration price for each division of your tournament, league, or ladder.",
            },
            {
              n: 2,
              t: "We add a small fee",
              d: "A small platform fee is added on top. Choose to absorb it or pass it to registrants — it's always shown before checkout.",
            },
            {
              n: 3,
              t: "You get paid out",
              d: "Registrants pay securely; your earnings are paid to your connected account, typically after the event.",
            },
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
        <p className="mt-4 max-w-2xl text-sm text-muted">
          Standard payment-processing charges from our payment provider apply to paid events and are
          shown separately. See the{" "}
          <Link href="/legal/refund" className="font-medium text-foreground underline underline-offset-2 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
            Refund &amp; Cancellation Policy
          </Link>{" "}
          for how refunds and fees are handled.
        </p>
      </section>

      {/* FAQ */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
          Frequently asked questions
        </h2>
        <div className="mt-5">
          <FaqAccordion items={FAQS} />
        </div>
      </section>

      {/* Final CTA */}
      <section className="mt-12 flex flex-col items-center gap-4 rounded-3xl border border-border bg-surface p-8 text-center">
        <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
          Ready to play more?
        </h2>
        <p className="max-w-xl text-muted">
          Find a court near you, spin up a free round robin, or start organizing your next paid
          event — all in one place.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/courts"
            className="inline-flex h-12 items-center justify-center rounded-full bg-accent px-7 text-base font-semibold text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Find courts near you
          </Link>
          <Link
            href={roundRobinLanding()}
            className="inline-flex h-12 items-center justify-center rounded-full border border-border px-7 text-base font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Start a round robin
          </Link>
        </div>
      </section>
    </main>
  );
}
