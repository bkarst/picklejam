"use client";

/**
 * FollowButton — follow a court to get its new-game alerts (§6.1, design 4.5).
 *
 * A GATED action (J8): following requires auth, so a signed-out click opens the
 * Auth modal and RESUMES the follow on success (`requireAuth(intent)`). The state
 * is optimistic — we flip immediately (UI §1) and roll back if the write fails.
 * Accessibility (CLAUDE.md/HIG): a real ≥44px button with `aria-pressed`; the
 * label always spells out the state, so the icon is never the sole signal.
 */

import { useState } from "react";
import type { JSX } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useFollowCourt } from "@/lib/api/community";
import { trackEvent } from "@/lib/analytics/client";

export function FollowButton({
  courtId,
  initialFollowing = false,
}: {
  courtId: string;
  initialFollowing?: boolean;
}): JSX.Element {
  const { user, requireAuth } = useAuth();
  const follow = useFollowCourt(courtId);
  const [following, setFollowing] = useState(initialFollowing);
  const [error, setError] = useState(false);

  const persist = async (next: boolean) => {
    const prev = following;
    setError(false);
    setFollowing(next); // optimistic
    try {
      await follow.mutateAsync(next);
      // Only a NEW follow is the `court_followed` intent (unfollows aren't tracked).
      if (next) trackEvent("court_followed", { courtId });
    } catch {
      setFollowing(prev); // rollback
      setError(true);
    }
  };

  const onClick = () => {
    if (following) {
      void persist(false);
      return;
    }
    if (!user) {
      // Resume the follow after sign-in.
      requireAuth(() => void persist(true));
      return;
    }
    void persist(true);
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        aria-pressed={following}
        onClick={onClick}
        className={`inline-flex h-11 items-center justify-center gap-2 rounded-full border px-5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
          following
            ? "border-accent bg-accent/10 text-accent hover:bg-accent/15"
            : "border-border bg-surface text-foreground hover:bg-surface-secondary"
        }`}
      >
        {following ? (
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        )}
        {following ? "Following" : "Follow"}
      </button>
      {error && (
        <span role="status" className="text-xs text-danger">
          Couldn&apos;t update — try again.
        </span>
      )}
    </div>
  );
}
