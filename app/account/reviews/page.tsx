"use client";

/**
 * My reviews (/account/reviews) — the caller's reviews (§6.4), each editable
 * (inline composer) and deletable (optimistic removal + rollback). noindex is
 * inherited from the /account layout. Loading = Skeleton; empty state points
 * people at the directory to review a court they've played.
 */

import { useState } from "react";
import type { JSX, ReactNode } from "react";
import Link from "next/link";
import { Skeleton } from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import { useDeleteReview } from "@/lib/api/community";
import { useMyReviews, accountListKeys, type CourtRef } from "@/lib/api/account-lists";
import { ReviewCard } from "@/components/community/ReviewCard";
import { ReviewComposer } from "@/components/community/ReviewComposer";
import type { ReviewItem } from "@/lib/db/types";

function ActionButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 items-center rounded-full border border-border px-3 text-xs font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      {children}
    </button>
  );
}

function ReviewRow({ review, court }: { review: ReviewItem; court?: CourtRef }): JSX.Element | null {
  const del = useDeleteReview(review.courtId);
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: accountListKeys.reviews });

  const remove = async () => {
    setRemoved(true); // optimistic
    setError(false);
    try {
      await del.mutateAsync();
      void refresh();
    } catch {
      setRemoved(false); // rollback
      setConfirming(false);
      setError(true);
    }
  };

  if (removed) return null;

  return (
    <li className="rounded-2xl border border-border bg-surface p-4">
      {court && (
        <p className="mb-1 text-sm text-muted">
          Review of{" "}
          <Link href={court.url} className="font-medium text-accent hover:underline">
            {court.name}
          </Link>
        </p>
      )}

      {editing ? (
        <ReviewComposer
          courtId={review.courtId}
          existing={review}
          checkedIn={Boolean(review.checkinVerified)}
          onDone={() => {
            setEditing(false);
            void refresh();
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <ReviewCard
            review={review}
            mine
            actions={
              <>
                <ActionButton onClick={() => setEditing(true)}>Edit</ActionButton>
                {confirming ? (
                  <>
                    <ActionButton onClick={() => setConfirming(false)}>Cancel</ActionButton>
                    <button
                      type="button"
                      onClick={remove}
                      className="inline-flex h-9 items-center rounded-full bg-danger px-3 text-xs font-semibold text-danger-foreground transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    >
                      Confirm delete
                    </button>
                  </>
                ) : (
                  <ActionButton onClick={() => setConfirming(true)}>Delete</ActionButton>
                )}
              </>
            }
          />
          {error && (
            <p role="status" className="mt-1 text-xs text-danger">
              Couldn&apos;t delete — try again.
            </p>
          )}
        </>
      )}
    </li>
  );
}

export default function MyReviewsPage(): JSX.Element {
  const { data, isLoading } = useMyReviews();

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48 rounded-lg" />
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  const { reviews, courts } = data;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">My reviews</h1>

      {reviews.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border p-6 text-sm text-muted">
          <p>You haven&apos;t written any reviews yet. Share how a court plays to help other players.</p>
          <Link
            href="/courts"
            className="inline-flex h-11 items-center rounded-full bg-accent px-5 font-semibold text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Find courts
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {reviews.map((review) => (
            <ReviewRow key={review.sk} review={review} court={courts[review.courtId]} />
          ))}
        </ul>
      )}
    </div>
  );
}
