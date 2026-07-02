"use client";

/**
 * Saved courts (/account/courts) — the courts the caller follows (§6.1), linking
 * back to each court, with an inline unfollow (optimistic removal + rollback).
 * noindex is inherited from the /account layout. Loading = Skeleton; empty state
 * points people at the directory.
 */

import { useState } from "react";
import type { JSX } from "react";
import Link from "next/link";
import { Skeleton } from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import { useFollowCourt } from "@/lib/api/community";
import { useFollowedCourts, accountListKeys, type FollowedCourt } from "@/lib/api/account-lists";
import { RatingBadge } from "@/components/directory/RatingBadge";

function SavedCourtRow({ court }: { court: FollowedCourt }): JSX.Element | null {
  const follow = useFollowCourt(court.courtId);
  const qc = useQueryClient();
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState(false);

  const unfollow = async () => {
    setRemoved(true); // optimistic
    setError(false);
    try {
      await follow.mutateAsync(false);
      void qc.invalidateQueries({ queryKey: accountListKeys.followedCourts });
    } catch {
      setRemoved(false); // rollback
      setError(true);
    }
  };

  if (removed) return null;

  return (
    <li className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
      <div className="min-w-0">
        <Link href={court.url} className="font-semibold text-accent hover:underline">
          {court.name}
        </Link>
        <p className="text-sm text-muted">
          {court.totalCourts} {court.totalCourts === 1 ? "court" : "courts"}
        </p>
        <div className="mt-1">
          <RatingBadge rating={court.ratingAvg} reviewCount={court.reviewCount} size="sm" />
        </div>
        {error && (
          <p role="status" className="mt-1 text-xs text-danger">
            Couldn&apos;t unfollow — try again.
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={unfollow}
        className="inline-flex h-11 shrink-0 items-center rounded-full border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        Unfollow
      </button>
    </li>
  );
}

export default function SavedCourtsPage(): JSX.Element {
  const { data: courts, isLoading } = useFollowedCourts();

  if (isLoading || !courts) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48 rounded-lg" />
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Saved courts</h1>

      {courts.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border p-6 text-sm text-muted">
          <p>You aren&apos;t following any courts yet. Follow a court to get its new-game alerts.</p>
          <Link
            href="/courts"
            className="inline-flex h-11 items-center rounded-full bg-accent px-5 font-semibold text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Find courts
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {courts.map((court) => (
            <SavedCourtRow key={court.courtId} court={court} />
          ))}
        </ul>
      )}
    </div>
  );
}
