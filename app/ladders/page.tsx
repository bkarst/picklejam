import type { Metadata } from "next";
import type { JSX } from "react";
import { publicEnv } from "@/lib/env";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbListJsonLd, faqPageJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/directory";
import { HubHero, HubSteps, HubFaq, type HubAction } from "@/components/hub";
import { LadderMotif } from "@/components/hub/motifs";
import { laddersHub, leaguesHub, organizeLeagueNew, discoverPath } from "@/lib/urls";
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
  { title: "Join", body: "Pay once and claim your starting rung." },
  { title: "Challenge", body: "Challenge players above you within range." },
  { title: "Play & report", body: "Play your match and report the score." },
  { title: "Climb", body: "Win to take their rung and rise up the board." },
];

export default function LaddersHubPage(): JSX.Element {
  const base = brand.siteUrl;
  const actions: HubAction[] = [
    { href: discoverPath("ladders"), label: "Find a ladder", variant: "primary" },
    ...(publicEnv.paidEventsEnabled
      ? [{ href: organizeLeagueNew(), label: "Run a ladder", variant: "outline" as const }]
      : []),
    { href: leaguesHub(), label: "Prefer teams? Explore leagues →", variant: "ghost" },
  ];
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

      <HubHero
        overline="Compete · Climb"
        title="Climb the pickleball ladder"
        body="Challenge players above you, win, and move up. Individual, ongoing, and always competitive — we handle the rankings and challenge deadlines."
        actions={actions}
        motif={<LadderMotif />}
        motifTone="pink"
      />

      <HubSteps steps={STEPS} />

      <HubFaq faqs={FAQS} />
    </main>
  );
}
