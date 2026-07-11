/**
 * RatingBadge — a court's aggregate rating, shown as five pickleball-ball "dots"
 * (brand ball motif, reused from the logo) followed by the numeric rating and
 * review count.
 *
 * Accessibility (CLAUDE.md / HIG): the balls are decorative (`aria-hidden`); the
 * meaning is ALWAYS carried by the numeric text + an `aria-label`, so rating is
 * never conveyed by color/shape alone. With zero reviews we render a muted
 * "No reviews yet" instead of an empty, misleading star row.
 */

import type { JSX } from "react";

const SIZES = {
  sm: { ball: 12, gap: "gap-0.5", text: "text-xs" },
  md: { ball: 16, gap: "gap-1", text: "text-sm" },
} as const;

/** One pickleball dot: a filled Pickle-Green ball, or an empty ring. */
function Ball({ filled, px }: { filled: boolean; px: number }) {
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

export function RatingBadge({
  rating,
  reviewCount,
  size = "md",
}: {
  rating: number;
  reviewCount: number;
  size?: "sm" | "md";
}): JSX.Element {
  const s = SIZES[size];

  if (reviewCount === 0) {
    return (
      <span className={`inline-flex items-center ${s.text} text-muted`}>No reviews yet</span>
    );
  }

  const filled = Math.round(rating);
  const label = `Rated ${rating.toFixed(1)} out of 5, ${reviewCount} ${
    reviewCount === 1 ? "review" : "reviews"
  }`;

  return (
    <span role="img" className={`inline-flex items-center ${s.gap} ${s.text}`} aria-label={label}>
      <span className={`inline-flex items-center ${s.gap}`} aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <Ball key={i} filled={i < filled} px={s.ball} />
        ))}
      </span>
      <span aria-hidden="true" className="ml-1 font-semibold text-foreground">
        {rating.toFixed(1)}
      </span>
      <span aria-hidden="true" className="text-muted">
        ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
      </span>
    </span>
  );
}
