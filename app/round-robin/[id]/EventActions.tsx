"use client";

/**
 * EventActions — the client-side controls on a public event page (§6.8):
 *   • Share — Web Share API, falling back to copy-to-clipboard with feedback.
 *   • Claim — "This is my event" for a signed-in holder of the creator token
 *     (stored on the creating device as `rr-token-<id>`). Anonymous events stay
 *     anonymous; claiming just attaches an organizerId so it shows in My Events.
 *
 * The token gate keeps the no-login create path intact: no token on this device
 * ⇒ no claim affordance (you can still view + share).
 */

import { useEffect, useState } from "react";
import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useClaimRrEvent } from "@/lib/api/roundrobin";
import { roundRobinPath } from "@/lib/urls";

export function EventActions({
  eventId,
  claimed,
}: {
  eventId: string;
  claimed: boolean;
}): JSX.Element {
  const router = useRouter();
  const { user, requireAuth } = useAuth();
  const claimMut = useClaimRrEvent(eventId);

  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [claimError, setClaimError] = useState(false);

  // The creator token only exists on the device that made the event.
  useEffect(() => {
    try {
      // One-shot read of the creator token on mount (SSR-safe: null on the server,
      // read on the client after hydration to avoid a mismatch).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToken(localStorage.getItem(`rr-token-${eventId}`));
    } catch {
      /* storage unavailable */
    }
  }, [eventId]);

  const share = async () => {
    const url = `${window.location.origin}${roundRobinPath(eventId)}`;
    const shareData = { title: document.title, url };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        /* user cancelled — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — nothing else to do */
    }
  };

  const claim = () => {
    if (!token) return;
    requireAuth(() => {
      setClaimError(false);
      claimMut
        .mutateAsync({ token })
        .then(() => router.refresh())
        .catch(() => setClaimError(true));
    });
  };

  const showClaim = !claimed && token !== null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={share}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-secondary px-5 text-sm font-semibold text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {copied ? (
            <>
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
              Link copied!
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></svg>
              Share
            </>
          )}
        </button>
      </div>

      {showClaim && (
        <div className="rounded-xl border border-accent/40 bg-accent/5 p-4">
          <p className="text-sm font-semibold text-foreground">This is your event</p>
          <p className="mt-1 text-sm text-muted">
            {user ? "Save it to your account to find it later in My Events." : "Sign in to save it to your account."}
          </p>
          <button
            type="button"
            onClick={claim}
            disabled={claimMut.isPending}
            className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {claimMut.isPending ? "Saving…" : "Claim this event"}
          </button>
          {claimError && (
            <p role="alert" className="mt-2 text-sm text-danger">Couldn&apos;t claim it — please try again.</p>
          )}
        </div>
      )}
    </div>
  );
}
