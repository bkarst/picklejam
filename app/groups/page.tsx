import type { Metadata } from "next";
import type { JSX } from "react";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbListJsonLd, faqPageJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/directory";
import { HubHero, HubSteps, HubFaq, type HubAction } from "@/components/hub";
import { groupsHub, groupNewPath, discoverPath } from "@/lib/urls";
import { brand } from "@/brand.config";

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: "Pickleball Groups & Clubs — Find or Start a Crew",
    description: `Find your pickleball people. Start or join a group on ${brand.identity.name} to organize regular meet-ups, keep your crew in one place, and see who's looking to play.`,
    path: groupsHub(),
  });
}

const FAQS = [
  {
    question: `What is a group on ${brand.identity.name}?`,
    answer:
      "A group is a persistent community — your club, crew, or regulars. Members stay together between games, schedule meet-ups, and can see who's checked in or looking to play. Groups are private and invite-only by default, so you decide who's in.",
  },
  {
    question: "How is a group different from a game?",
    answer:
      "A game (outing) is a single session at a court. A group is the ongoing community that organizes those sessions — one home base for all your meet-ups, members, and chatter.",
  },
  {
    question: "Are groups private?",
    answer:
      "Yes — new groups are private and invite-only by default. You can switch a group to request-to-join or fully open, or make it public so it shows up in city finders and on court pages.",
  },
  {
    question: "How do people join my group?",
    answer:
      "Owners and admins create a shareable invite link. Depending on your join policy, people can join instantly, request approval, or join only with an invite.",
  },
];

const STEPS = [
  { title: "Create", body: "Name your group and pick a home court in under a minute." },
  { title: "Invite", body: "Share an invite link with your crew — private by default." },
  { title: "Schedule", body: "Post recurring meet-ups; members RSVP in a tap." },
  { title: "Play", body: "See who's checked in and looking to play, then hit the court." },
];

export default function GroupsHubPage(): JSX.Element {
  const base = brand.siteUrl;
  const actions: HubAction[] = [
    { href: groupNewPath(), label: "Start a group", variant: "primary" },
    { href: discoverPath("groups"), label: "Find a group", variant: "outline" },
  ];
  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <JsonLd
        data={[
          breadcrumbListJsonLd([
            { name: "Home", url: base },
            { name: "Groups & Clubs", url: `${base}${groupsHub()}` },
          ]),
          faqPageJsonLd(FAQS),
        ]}
      />

      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Groups & Clubs" }]} />

      <HubHero
        overline="Community · Your crew"
        title="Find your pickleball people"
        body="Groups are your club, crew, or regulars — a home base for meet-ups, members, and who's looking to play. Private and invite-only by default."
        actions={actions}
        image={{
          src: "/images/home/leagues-team.jpg",
          alt: "A group of pickleball players tapping paddles at the net after a match",
        }}
      />

      <HubSteps steps={STEPS} />

      <HubFaq faqs={FAQS} />
    </main>
  );
}
