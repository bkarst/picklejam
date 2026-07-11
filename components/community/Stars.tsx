/**
 * Stars — the brand pickleball-ball rating motif, in a display and an input form.
 *
 * Reuses the logo's ball dot (see RatingBadge) so a review's rating reads as the
 * same visual language as a court's aggregate. Accessibility (CLAUDE.md / HIG):
 * balls are decorative; the meaning is always carried by text (`aria-label` on
 * the display, an sr-only word per radio on the input) — never color/shape alone.
 */

"use client";

import { useId } from "react";
import type { JSX } from "react";

const SIZES = {
  sm: 14,
  md: 18,
  lg: 30,
} as const;

/** One pickleball dot: a filled Pickle-Green ball, or an empty ring. */
export function Ball({ filled, px }: { filled: boolean; px: number }): JSX.Element {
  return (
    <svg width={px} height={px} viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
      {filled ? (
        <circle cx="8" cy="8" r="7" className="fill-success" />
      ) : (
        <circle cx="8" cy="8" r="6.4" className="fill-none stroke-muted" strokeWidth="1.5" />
      )}
    </svg>
  );
}

/** Read-only 1–5 rating, five balls filled to `rating`. */
export function StarsDisplay({
  rating,
  size = "sm",
}: {
  rating: number;
  size?: keyof typeof SIZES;
}): JSX.Element {
  const px = SIZES[size];
  const filled = Math.round(rating);
  return (
    <span
      role="img"
      aria-label={`Rated ${rating} out of 5`}
      className="inline-flex items-center gap-0.5"
    >
      {Array.from({ length: 5 }, (_, i) => (
        <Ball key={i} filled={i < filled} px={px} />
      ))}
    </span>
  );
}

/**
 * Accessible 1–5 rating input built on native radios (free keyboard support,
 * axe-clean): each ball is a label wrapping an sr-only radio + an sr-only word.
 */
export function StarRatingInput({
  value,
  onChange,
  label = "Your rating",
}: {
  value: number;
  onChange: (value: number) => void;
  label?: string;
}): JSX.Element {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <label
          key={n}
          className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-surface-secondary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus"
        >
          <input
            type="radio"
            name={name}
            value={n}
            checked={value === n}
            onChange={() => onChange(n)}
            className="sr-only"
          />
          <Ball filled={n <= value} px={SIZES.lg} />
          <span className="sr-only">
            {n} star{n > 1 ? "s" : ""}
          </span>
        </label>
      ))}
    </div>
  );
}
