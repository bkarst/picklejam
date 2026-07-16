/**
 * FindYourPeopleCTA — the "Find your pickleball people" groups call-to-action
 * card (§6.9): copy + Start/Find a group buttons on the left, photo on the right,
 * with the accent offset shadow.
 *
 * Server component. Used on the home page and at the foot of every published
 * article (evergreen guides and news stories). It renders the CARD only — the
 * page supplies the section wrapper, container width, and vertical spacing.
 */

import type { JSX } from "react";
import Image from "next/image";
import Link from "next/link";
import { groupNewPath, discoverPath } from "@/lib/urls";

export type FindYourPeopleCTAProps = {
  /** Extra classes for the card root (spacing/width live on the parent). */
  className?: string;
};

export function FindYourPeopleCTA({ className = "" }: FindYourPeopleCTAProps): JSX.Element {
  return (
    <div
      className={`overflow-hidden rounded-3xl bg-surface shadow-[10px_10px_0_0_var(--accent)] ${className}`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* Copy */}
        <div className="flex flex-col justify-center gap-5 p-8 sm:p-12">
          <p className="text-sm font-bold uppercase tracking-wider text-secondary">
            Community · Your crew
          </p>
          <h2 className="font-display text-4xl font-bold uppercase leading-[0.95] text-accent sm:text-5xl">
            Find your pickleball people
          </h2>
          <p className="max-w-md text-lg text-muted">
            Groups are your club, crew, or regulars — a home base for meet-ups, members, and
            who&apos;s looking to play. Private and invite-only by default.
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Link
              href={groupNewPath()}
              className="inline-flex h-12 items-center justify-center rounded-full bg-secondary px-8 text-base font-bold uppercase tracking-wide text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Start a group
            </Link>
            <Link
              href={discoverPath("groups")}
              className="inline-flex h-12 items-center justify-center rounded-full border-2 border-accent px-8 text-base font-bold uppercase tracking-wide text-accent transition-colors hover:bg-accent/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Find a group
            </Link>
          </div>
        </div>
        {/* Photo */}
        <div className="relative min-h-[18rem] lg:min-h-0">
          <Image
            src="/images/home/cta-community.jpg"
            alt="Pickleball players greeting each other at the net"
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover object-center"
          />
        </div>
      </div>
    </div>
  );
}
