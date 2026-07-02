/**
 * RelatedLocalCTA — the "related local" call-to-action at the foot of an article
 * (§12 rule 4). Links an evergreen guide back into the directory (a real city
 * page), turning top-of-funnel authority traffic into local intent.
 *
 * Server component. The PAGE is responsible for resolving `cityKey` to a REAL
 * city page before rendering this (no orphan link, §12 rule 4) — this component
 * only receives an already-validated `href` + display name.
 */

import type { JSX } from "react";
import Link from "next/link";

export function RelatedLocalCTA({
  cityName,
  stateCode,
  href,
}: {
  cityName: string;
  stateCode?: string;
  href: string;
}): JSX.Element {
  const place = stateCode ? `${cityName}, ${stateCode}` : cityName;
  return (
    <aside className="flex flex-col items-start gap-3 rounded-2xl border border-secondary/40 bg-secondary/5 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-secondary">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </span>
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">
            Ready to play in {place}?
          </h2>
          <p className="mt-1 text-sm text-muted">
            Find pickleball courts near you, check who&apos;s playing, and get on the court.
          </p>
        </div>
      </div>
      <Link
        href={href}
        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-secondary px-6 text-sm font-semibold text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        Courts in {cityName}
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </Link>
    </aside>
  );
}
