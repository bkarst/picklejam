import type { Metadata } from "next";
import type { JSX } from "react";
import { publicEnv } from "@/lib/env";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbListJsonLd, faqPageJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/directory";
import { HubHero, HubSteps, HubFaq, type HubAction } from "@/components/hub";
import { BracketMotif } from "@/components/hub/motifs";
import { tournamentsHub, discoverPath } from "@/lib/urls";
import { brand } from "@/brand.config";

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: "Pickleball Tournaments — Find, Register & Organize",
    description: `Find pickleball tournaments near you and register online, or organize your own — collect entry fees, run divisions, and share live brackets on ${brand.identity.name}.`,
    path: tournamentsHub(),
  });
}

const FAQS = [
  {
    question: "How do I register for a pickleball tournament?",
    answer:
      "Open a tournament, pick your division, add a partner for doubles, and pay securely through Stripe. You'll get a confirmation and can view the live bracket during the event.",
  },
  {
    question: `How much does it cost to run a tournament on ${brand.identity.name}?`,
    answer:
      "Creating and publishing a tournament is free. A small platform fee applies per registration — you choose whether to absorb it or pass it to registrants.",
  },
  {
    question: "Can I offer multiple divisions?",
    answer:
      "Yes. Add as many divisions as you like — each with its own skill or DUPR range, entry fee, capacity, and singles/doubles format.",
  },
];

const STEPS = [
  { title: "Create your event", body: "Set dates, venue, divisions, and entry fees in a few minutes." },
  { title: "Connect payouts", body: "Link Stripe to accept registrations and get paid directly." },
  { title: "Publish & play", body: "Share your page, take registrations, and run live brackets." },
];

export default function TournamentsHubPage(): JSX.Element {
  const base = brand.siteUrl;
  const actions: HubAction[] = [
    { href: discoverPath("tournaments"), label: "Find a tournament", variant: "primary" },
    ...(publicEnv.paidEventsEnabled
      ? [{ href: "/organize/tournaments/new", label: "Organize a tournament", variant: "outline" as const }]
      : []),
  ];
  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <JsonLd
        data={[
          breadcrumbListJsonLd([
            { name: "Home", url: base },
            { name: "Tournaments", url: `${base}${tournamentsHub()}` },
          ]),
          faqPageJsonLd(FAQS),
        ]}
      />

      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Tournaments" }]} />

      <HubHero
        overline="Compete · This season"
        title="Pickleball tournaments, made easy"
        body="Find and register for tournaments near you, or organize your own — collect entry fees, manage divisions, and share live brackets."
        actions={actions}
        motif={<BracketMotif />}
        motifTone="lime"
      />

      <HubSteps steps={STEPS} />

      <HubFaq faqs={FAQS} />
    </main>
  );
}
