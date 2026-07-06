"use client";

/**
 * WriteReviewButton — the hero-level "Write a review" CTA (design 4.5).
 *
 * The composer, its state, and the auth-gating all live in `ReviewsModule`; this
 * button just asks it to open via a window event so the server-rendered hero
 * doesn't have to own any of that client state. The module handles `requireAuth`
 * and scrolls itself into view, so the action still gives immediate feedback.
 */

import type { JSX } from "react";

export const WRITE_REVIEW_EVENT = "pl:write-review";

const BASE =
  "inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-secondary px-5 text-sm font-semibold text-secondary-foreground transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

export function WriteReviewButton({ className = "" }: { className?: string }): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(WRITE_REVIEW_EVENT))}
      className={`${BASE} ${className}`}
    >
      Write a review
    </button>
  );
}
