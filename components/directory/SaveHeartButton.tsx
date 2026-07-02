"use client";

/**
 * SaveHeartButton — the Hot-Pink "save / follow" heart shown on court cards.
 *
 * A GATED action (J8): saving requires auth. Signed out → the click opens the
 * Auth modal and RESUMES the save on success (`requireAuth(intent)`).
 *
 * When a `courtId` is given, the heart persists a real court FOLLOW via
 * `useFollowCourt` — optimistic (flip immediately, UI §1) with rollback on
 * failure. Without a `courtId` it stays a local visual toggle (e.g. previews).
 * Real ≥44×44 button, accessible label + `aria-pressed`; the icon is never the
 * sole signal of state.
 */

import { useState } from "react";
import type { JSX } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useFollowCourt } from "@/lib/api/community";

export function SaveHeartButton({
  name,
  courtId,
  initialFollowing = false,
}: {
  name: string;
  courtId?: string;
  initialFollowing?: boolean;
}): JSX.Element {
  const { user, requireAuth } = useAuth();
  // Hook is always called (Rules of Hooks); it's only fired when a courtId exists.
  const follow = useFollowCourt(courtId ?? "");
  const [saved, setSaved] = useState(initialFollowing);

  const persist = async (next: boolean) => {
    const prev = saved;
    setSaved(next); // optimistic
    try {
      await follow.mutateAsync(next);
    } catch {
      setSaved(prev); // rollback
    }
  };

  const onClick = () => {
    if (saved) {
      // Un-save: persist when wired to a court, else just toggle locally.
      if (courtId) void persist(false);
      else setSaved(false);
      return;
    }
    // Save is gated: resume after sign-in (or run now if already signed in).
    const doSave = () => {
      if (courtId) void persist(true);
      else setSaved(true);
    };
    if (courtId && user) doSave();
    else requireAuth(doSave);
  };

  return (
    <button
      type="button"
      data-testid="save-court"
      aria-label={saved ? `Saved ${name}` : `Save ${name}`}
      aria-pressed={saved}
      onClick={onClick}
      className="inline-flex size-11 items-center justify-center rounded-full text-secondary transition-colors hover:bg-secondary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-6"
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
      </svg>
    </button>
  );
}
