/**
 * RatingHistogram — the 5→1 star breakdown bars beside a court's average rating
 * (design 4.5 "Reviews" module). Presentational + server-renderable.
 *
 * Accessibility (CLAUDE.md / HIG): the whole thing is one labelled group and each
 * row carries a text label ("5 stars, N reviews"); the bars are decorative fills,
 * so the distribution is never conveyed by bar length/color alone.
 */

import type { JSX } from "react";

/** Per-star counts, keyed 1–5. Missing keys are treated as zero. */
export type RatingDistribution = Partial<Record<1 | 2 | 3 | 4 | 5, number>>;

/** Tally a set of 1–5 ratings into a {@link RatingDistribution}. */
export function distributionOf(ratings: number[]): RatingDistribution {
  const dist: RatingDistribution = {};
  for (const r of ratings) {
    const star = Math.round(r) as 1 | 2 | 3 | 4 | 5;
    if (star >= 1 && star <= 5) dist[star] = (dist[star] ?? 0) + 1;
  }
  return dist;
}

export function RatingHistogram({
  distribution,
}: {
  distribution: RatingDistribution;
}): JSX.Element {
  const rows = ([5, 4, 3, 2, 1] as const).map((star) => ({
    star,
    count: distribution[star] ?? 0,
  }));
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <ul aria-label="Rating breakdown" className="flex flex-col gap-1.5">
      {rows.map(({ star, count }) => {
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <li key={star} className="flex items-center gap-2 text-sm">
            <span className="flex w-3 shrink-0 justify-end tabular-nums text-muted" aria-hidden="true">
              {star}
            </span>
            <span aria-hidden="true" className="shrink-0 text-muted">
              ★
            </span>
            <span
              className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface-secondary"
              aria-hidden="true"
            >
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-accent"
                style={{ width: `${pct}%` }}
              />
            </span>
            <span className="w-8 shrink-0 text-right tabular-nums text-muted">{count}</span>
            <span className="sr-only">
              {star} star{star > 1 ? "s" : ""}: {count} review{count === 1 ? "" : "s"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
