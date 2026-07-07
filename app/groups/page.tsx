import type { Metadata } from "next";
import type { JSX } from "react";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbListJsonLd, faqPageJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/directory";
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
    question: "What is a group on PickleLoko?",
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

const STEPS: { n: number; title: string; body: string }[] = [
  { n: 1, title: "Create", body: "Name your group and pick a home court in under a minute." },
  { n: 2, title: "Invite", body: "Share an invite link with your crew — private by default." },
  { n: 3, title: "Schedule", body: "Post recurring meet-ups; members RSVP in a tap." },
  { n: 4, title: "Play", body: "See who's checked in and looking to play, then hit the court." },
];

function Feature({ title, body, icon }: { title: string; body: string; icon: JSX.Element }): JSX.Element {
  return (
    <div className="flex gap-4">
      <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        {icon}
      </span>
      <div>
        <h3 className="font-display text-lg font-bold text-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted">{body}</p>
      </div>
    </div>
  );
}

export default function GroupsHubPage() {
  const base = brand.siteUrl;
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

      {/* Hero */}
      <section className="mt-4 grid grid-cols-1 gap-6 overflow-hidden rounded-3xl border border-border bg-surface p-6 sm:p-10 lg:grid-cols-2">
        <div>
          <h1 className="max-w-xl font-display text-3xl font-bold text-foreground sm:text-5xl">
            Find your pickleball people
          </h1>
          <p className="mt-3 max-w-lg text-muted">
            Groups are your club, crew, or regulars — a home base for meet-ups, members, and who&apos;s
            looking to play. Private and invite-only by default.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={groupNewPath()}
              className="inline-flex h-12 items-center rounded-full bg-secondary px-6 text-base font-semibold text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Start a group
            </Link>
            <Link
              href={discoverPath("groups")}
              className="inline-flex h-12 items-center rounded-full border border-border px-6 text-base font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Find a group
            </Link>
          </div>
        </div>

        <div className="flex flex-col justify-center gap-6 rounded-2xl border border-border bg-background/40 p-6">
          <Feature
            title="One home for your crew"
            body="Keep members, meet-ups, and your home court together — not scattered across group chats."
            icon={<svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>}
          />
          <Feature
            title="Private by default"
            body="Invite-only from the start. Open it up to requests or the public whenever you want."
            icon={<svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>}
          />
          <Feature
            title="Meet-ups on repeat"
            body="Schedule recurring games; members RSVP and see who's in for today's session."
            icon={<svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>}
          />
        </div>
      </section>

      {/* How it works */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-bold text-foreground">How it works</h2>
        <ol className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
