"use client";

/**
 * Dashboard — the member landing page (UI §13.5). At-a-glance modules that are
 * all empty in Stage 2 (check-ins/outings/registrations land in later stages),
 * each with an empty state + a clear CTA so the page never feels dead. Reads the
 * caller's profile via useMyProfile; ratings summary via useMyRatings.
 */

import type { JSX, ReactNode } from "react";
import Link from "next/link";
import { Skeleton } from "@heroui/react";
import { useMyProfile, useMyRatings } from "@/lib/api/profile";
import { RATING_LABELS, primaryRating, skillBand } from "./ratings";
import { GamifyProgressModule } from "./GamifyProgressModule";
import { GamifyQuestsModule } from "./GamifyQuestsModule";

function Module({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="font-display text-base font-bold text-foreground">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function EmptyState({ text, ctaLabel, ctaHref }: { text: string; ctaLabel: string; ctaHref: string }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border p-5 text-sm text-muted">
      <p>{text}</p>
      <Link
        href={ctaHref}
        className="inline-flex h-10 items-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}

const QUICK_ACTIONS = [
  { label: "Find courts", href: "/courts" },
  { label: "Host a round robin", href: "/round-robin/new" },
  { label: "Edit profile", href: "/account/profile" },
];

export function Dashboard(): JSX.Element {
  const { data: profile, isLoading } = useMyProfile();
  const { data: ratings } = useMyRatings();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64 rounded-lg" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const firstName = profile?.displayName?.split(" ")[0] ?? "there";
  const primary = ratings ? primaryRating(ratings, profile?.defaultRatingSource) : undefined;
  const band = skillBand(primary?.value);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
          Welcome back, {firstName}
        </h1>
        <p className="text-muted">Here&apos;s what&apos;s happening with your pickleball.</p>
      </header>

      {profile && !profile.onboarded && (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-accent/40 bg-accent/5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-foreground">Finish setting up your profile</p>
            <p className="text-sm text-muted">Add your home court and a rating so players can find you.</p>
          </div>
          <Link
            href="/welcome"
            className="inline-flex h-11 shrink-0 items-center rounded-full bg-accent px-5 font-semibold text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Continue setup
          </Link>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="inline-flex h-11 items-center rounded-full border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {a.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <GamifyProgressModule />
        <GamifyQuestsModule />

        <Module title="Next outings">
          <EmptyState
            text="You have no upcoming outings."
            ctaLabel="Find games"
            ctaHref="/search"
          />
        </Module>

        <Module title="Games at your courts">
          <EmptyState
            text="Follow a court to see its upcoming games here."
            ctaLabel="Find courts"
            ctaHref="/courts"
          />
        </Module>

        <Module title="Your ratings">
          {ratings && ratings.length > 0 ? (
            <div className="flex flex-col gap-2 text-sm">
              <p className="text-muted">
                {ratings.length} rating{ratings.length === 1 ? "" : "s"} on file
                {band ? ` · skill band ${band}` : ""}.
              </p>
              <ul className="flex flex-wrap gap-2">
                {ratings.map((r) => (
                  <li
                    key={r.system}
                    className="rounded-full bg-surface-secondary px-3 py-1 text-foreground"
                  >
                    <span className="font-semibold">{RATING_LABELS[r.system]}</span> {r.value}
                  </li>
                ))}
              </ul>
              <Link href="/account/profile" className="font-semibold text-accent hover:underline">
                Manage ratings
              </Link>
            </div>
          ) : (
            <EmptyState
              text="Add a rating so we can match you to the right games."
              ctaLabel="Add a rating"
              ctaHref="/account/profile"
            />
          )}
        </Module>

        <Module title="Registrations">
          <EmptyState
            text="No tournament or league registrations yet."
            ctaLabel="Browse events"
            ctaHref="/tournaments"
          />
        </Module>
      </div>
    </div>
  );
}
