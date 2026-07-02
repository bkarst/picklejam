/**
 * RatingTiles — read-only multi-system rating badges for the public player
 * profile (design 6.1). Each tile shows the system, the value, a label, and a
 * "verified" check when the rating is verified (DUPR connection).
 *
 * Presentational + server-safe (no "use client"): rendered by the public profile
 * server component. Accessibility (CLAUDE.md/HIG): "verified" is carried by text
 * (`aria-label` / an sr-only word), never color/icon alone.
 */

import type { JSX } from "react";
import type { RatingItem } from "@/lib/db/types";
import { RATING_LABELS, formatRatingValue, sortRatings } from "./ratings";

function VerifiedCheck(): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1 text-success" title="Verified">
      <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
        <path d="M12 2l2.4 1.8 3 .1 1 2.8 2.4 1.7-.9 2.9.9 2.9-2.4 1.7-1 2.8-3 .1L12 22l-2.4-1.8-3-.1-1-2.8L3.2 15l.9-2.9-.9-2.9 2.4-1.7 1-2.8 3-.1L12 2z" />
        <path
          d="M8.5 12.2l2.2 2.2 4.6-4.6"
          fill="none"
          stroke="var(--success-foreground)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="sr-only">Verified</span>
    </span>
  );
}

export function RatingTiles({ ratings }: { ratings: RatingItem[] }): JSX.Element {
  if (ratings.length === 0) {
    return (
      <p className="text-sm text-muted">No ratings shared yet.</p>
    );
  }

  return (
    <ul className="flex flex-wrap gap-3" aria-label="Player ratings">
      {sortRatings(ratings).map((r) => {
        const label = RATING_LABELS[r.system];
        return (
          <li
            key={r.system}
            className="min-w-24 flex-1 rounded-xl border border-border bg-surface p-3 sm:flex-none"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-accent">{label}</span>
              {r.verified && <VerifiedCheck />}
            </div>
            <p
              className="mt-1 font-display text-2xl font-bold text-foreground"
              aria-label={`${label} rating ${formatRatingValue(r.value)}${r.verified ? ", verified" : ""}`}
            >
              {formatRatingValue(r.value)}
            </p>
            <p className="text-xs text-muted">{label}</p>
          </li>
        );
      })}
    </ul>
  );
}
