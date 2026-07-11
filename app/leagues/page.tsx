import type { Metadata } from "next";
import type { JSX } from "react";
import { publicEnv } from "@/lib/env";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbListJsonLd, faqPageJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/directory";
import { HubHero, HubSteps, HubFaq, type HubAction } from "@/components/hub";
import { CalendarMotif } from "@/components/hub/motifs";
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

const STEPS = [
  { title: "Create", body: "Set up your league or ladder in minutes." },
  { title: "Automate", body: "Schedules, matchups, and notifications — handled." },
  { title: "Format", body: "Balanced play with fair matchups every week." },
  { title: "Live standings", body: "Track results and see who's on top." },
  { title: "Playoffs", body: "Top teams advance to win it all." },
];

export default function LeaguesHubPage(): JSX.Element {
  const base = brand.siteUrl;
  const actions: HubAction[] = [
    { href: discoverPath("leagues"), label: "Find a league", variant: "primary" },
    ...(publicEnv.paidEventsEnabled
      ? [{ href: organizeLeagueNew(), label: "Run a league", variant: "outline" as const }]
      : []),
    { href: laddersHub(), label: "Explore ladders →", variant: "ghost" },
  ];
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

      <HubHero
        overline="Compete · Season play"
        title="Leagues & ladders on autopilot"
        body="We handle the brackets, scheduling, matchups, and standings — so you can focus on playing."
        actions={actions}
        motif={<CalendarMotif />}
        motifTone="lime"
      />

      <HubSteps steps={STEPS} />

      <HubFaq faqs={FAQS} />
    </main>
  );
}
