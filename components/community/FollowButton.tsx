"use client";

/**
 * FollowButton — the "Favorite" action on a court page (design 4.5).
 *
 * Presented as a FAVORITE (heart icon + "Favorite" / "Favorited"), matching the
 * save-heart on court cards — NOT "Follow" language (see CLAUDE.md). Under the
 * hood it still persists a court *follow* (`useFollowCourt` → new-game alerts,
 * §6.1); only the iconography and copy are "favorite".
 *
 * A GATED action (J8): favoriting requires auth, so a signed-out click opens the
 * Auth modal and RESUMES it on success (`requireAuth(intent)`). The state is
 * optimistic — we flip immediately (UI §1) and roll back if the write fails.
 * Accessibility (CLAUDE.md/HIG): a real ≥44px button with `aria-pressed`; the
 * label always spells out the state, so the icon is never the sole signal.
 *
 * The server page can't know the viewer's state (auth is a client Bearer), so a
 * signed-in button hydrates itself via {@link useIsFollowing} and flips to
 * "Favorited" once that resolves — which is what surfaces the un-favorite affordance.
 */

import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useFollowCourt, useIsFollowing } from "@/lib/api/community";
import { trackEvent } from "@/lib/analytics/client";

export function FollowButton({
  courtId,
  initialFollowing = false,
  className = "flex flex-col items-start gap-1",
  triggerClassName = "",
}: {
  courtId: string;
  initialFollowing?: boolean;
  /** Wrapper classes — override to stretch the button (e.g. `flex w-full flex-col gap-1`). */
  className?: string;
  /** Extra classes appended to the button (e.g. `w-full` inside a panel). */
  triggerClassName?: string;
}): JSX.Element {
  const { user, requireAuth } = useAuth();
  const follow = useFollowCourt(courtId);
  const { data: serverFollowing } = useIsFollowing(courtId);
  const [following, setFollowing] = useState(initialFollowing);
  const [error, setError] = useState(false);
  // Once the user acts, this button owns its state (optimistic + rollback); until
  // then, adopt the server's answer so an already-followed court shows "Following".
  const interacted = useRef(false);

  useEffect(() => {
    if (!interacted.current && serverFollowing !== undefined) setFollowing(serverFollowing);
  }, [serverFollowing]);

  const persist = async (next: boolean) => {
    interacted.current = true;
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
    <div className={className}>
      <button
        type="button"
        aria-pressed={following}
        onClick={onClick}
        className={`inline-flex h-11 items-center justify-center gap-2 rounded-full border px-5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
          following
            ? "border-secondary/40 bg-secondary/10 text-foreground hover:bg-secondary/15"
            : "border-border bg-surface text-foreground hover:bg-surface-secondary"
        } ${triggerClassName}`}
      >
        {/* Favorite heart — matches the save-heart on court cards; filled once favorited. */}
        <svg
          viewBox="0 0 24 24"
          className="size-5 text-secondary"
          fill={following ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
        </svg>
        {following ? "Favorited" : "Favorite"}
      </button>
      {error && (
        <span role="status" className="text-xs text-danger">
          Couldn&apos;t update — try again.
        </span>
      )}
    </div>
  );
}
