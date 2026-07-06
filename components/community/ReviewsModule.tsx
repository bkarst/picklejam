"use client";

/**
 * ReviewsModule — the court "Reviews" block (design 4.5): the average rating +
 * count, the 5→1 histogram, a recent/helpful sort, the review cards, and a gated
 * "Write a review" (edit, if you already have one).
 *
 * `initialReviews` is rendered straight away (this component SSRs), so the review
 * text is in the crawlable HTML and matches any Review JSON-LD (§14.4). Writing a
 * review is a gated action — `requireAuth` opens the Auth modal for signed-out
 * users and resumes into the composer.
 */

import { useMemo, useState } from "react";
import type { JSX } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import type { ReviewItem } from "@/lib/db/types";
import { RatingHistogram, distributionOf } from "./RatingHistogram";
import { ReviewCard, type ReviewAuthor } from "./ReviewCard";
import { ReviewComposer } from "./ReviewComposer";
import { StarsDisplay } from "./Stars";

type Sort = "recent" | "helpful";
type Authors = Record<string, ReviewAuthor>;

function sortReviews(reviews: ReviewItem[], sort: Sort, authors: Authors): ReviewItem[] {
  const copy = [...reviews];
  if (sort === "helpful") {
    // Most-helpful, with a fixed Crew tiebreak (§G12.16) — a mild local-credibility nudge,
    // never a hidden multiplier: equal helpful counts break toward Crew reviewers.
    return copy.sort((a, b) => {
      const byHelpful = (b.helpfulCount ?? 0) - (a.helpfulCount ?? 0);
      if (byHelpful !== 0) return byHelpful;
      return Number(authors[b.uid]?.isCrew ?? false) - Number(authors[a.uid]?.isCrew ?? false);
    });
  }
  return copy.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

export function ReviewsModule({
  courtId,
  initialReviews,
  ratingAvg,
  reviewCount,
  mine,
  authors = {},
}: {
  courtId: string;
  initialReviews: ReviewItem[];
  ratingAvg: number;
  reviewCount: number;
  mine?: ReviewItem;
  /** Author-chip data by uid (§G12.16) — public reviewers only; absent ⇒ "Player", no chips. */
  authors?: Authors;
}): JSX.Element {
  const { requireAuth } = useAuth();
  const [sort, setSort] = useState<Sort>("recent");
  const [composerOpen, setComposerOpen] = useState(false);
  // Show the just-submitted review immediately (the SSR list won't refetch here).
  const [justSubmitted, setJustSubmitted] = useState<ReviewItem | null>(null);
  const effectiveMine = justSubmitted ?? mine;

  const distribution = useMemo(
    () => distributionOf(initialReviews.map((r) => r.rating1to5)),
    [initialReviews],
  );

  // Others' reviews (exclude "mine"/just-submitted so it isn't shown twice).
  const others = useMemo(
    () => sortReviews(initialReviews.filter((r) => !effectiveMine || r.sk !== effectiveMine.sk), sort, authors),
    [initialReviews, effectiveMine, sort, authors],
  );

  const openComposer = () => requireAuth(() => setComposerOpen(true));

  return (
    <section aria-labelledby="reviews-heading" className="flex flex-col gap-5">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        {/* Average + histogram */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-col items-center gap-1 sm:items-start">
            <h2 id="reviews-heading" className="sr-only">
              Reviews
            </h2>
            <span className="font-display text-4xl font-bold text-foreground">
              {reviewCount > 0 ? ratingAvg.toFixed(1) : "—"}
            </span>
            {reviewCount > 0 ? (
              <StarsDisplay rating={ratingAvg} size="md" />
            ) : (
              <span className="text-sm text-muted">No reviews yet</span>
            )}
            <span className="text-sm text-muted">
              {reviewCount} review{reviewCount === 1 ? "" : "s"}
            </span>
          </div>
          {initialReviews.length > 0 && (
            <div className="w-full min-w-48 sm:w-56">
              <RatingHistogram distribution={distribution} />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={openComposer}
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-secondary px-5 text-sm font-semibold text-secondary-foreground transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {effectiveMine ? "Edit your review" : "Write a review"}
        </button>
      </div>

      {composerOpen && (
        <ReviewComposer
          courtId={courtId}
          existing={effectiveMine ?? undefined}
          checkedIn={Boolean(effectiveMine?.checkinVerified)}
          onDone={(saved) => {
            if (saved) setJustSubmitted(saved);
            setComposerOpen(false);
          }}
          onCancel={() => setComposerOpen(false)}
        />
      )}

      {/* Sort */}
      {(others.length > 0 || effectiveMine) && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span id="reviews-sort-label" className="text-muted">
            Sort:
          </span>
          <div
            role="group"
            aria-labelledby="reviews-sort-label"
            className="inline-flex rounded-full border border-border bg-surface p-1"
          >
            {(["recent", "helpful"] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={sort === s}
                onClick={() => setSort(s)}
                className={`h-8 rounded-full px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                  sort === s
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground hover:bg-surface-secondary"
                }`}
              >
                {s === "recent" ? "Most recent" : "Most helpful"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cards — "mine"/just-submitted pinned first when present. */}
      {effectiveMine || others.length > 0 ? (
        <div className="flex flex-col">
          {effectiveMine && <ReviewCard review={effectiveMine} mine actions={<span className="text-xs font-medium text-accent">Your review</span>} />}
          {others.map((r) => (
            <ReviewCard key={r.sk || `${r.uid}-${r.createdAt}`} review={r} author={authors[r.uid]} />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted">
          No reviews yet. Be the first to share how these courts play.
        </p>
      )}
    </section>
  );
}
