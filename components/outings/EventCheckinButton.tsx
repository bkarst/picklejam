"use client";

/**
 * EventCheckinButton — "I'm here" for an outing (§6.2/§6.7, design 10.2).
 *
 * Renders only around game time (2h before start → 6h after, or until end) so
 * the affordance appears exactly when arriving makes sense. Checking in posts a
 * COURT check-in carrying the `outingId`: the server marks the caller's RSVP
 * ARRIVED and fans the anonymous "a player checked in" notification out to the
 * host group + the court's followers.
 *
 * Signed-out visitors get the auth modal via `requireAuth` (same gate as RSVP);
 * the update is optimistic with a rollback + retry on failure (UI §1).
 */

import { useEffect, useState } from "react";
import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useCheckIn } from "@/lib/api/community";
import { isEventCheckinOpen } from "@/lib/outings/timing";

export function EventCheckinButton({
  outingId,
  courtId,
  startTs,
  endTs,
}: {
  outingId: string;
  courtId: string;
  startTs: string;
  endTs?: string;
}): JSX.Element | null {
  const { requireAuth } = useAuth();
  const router = useRouter();
  const checkIn = useCheckIn(courtId);
  // Per-viewer state can't come from the ISR shell (same reason the page doesn't
  // pass RsvpControl an initialRsvp) — optimistic-local only.
  const [arrived, setArrived] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  // Time-gate the affordance in an effect (SSR renders nothing → no hydration
  // mismatch at the window boundary); a minute tick opens/closes it live. The
  // SAME shared window (lib/outings/timing) is enforced server-side, so the
  // button never promises what the API would refuse.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const compute = () => setOpen(isEventCheckinOpen(startTs, endTs, Date.now()));
    compute();
    const t = setInterval(compute, 60_000);
    return () => clearInterval(t);
  }, [startTs, endTs]);
  if (!open) return null;

  const submit = () => {
    setError(false);
    setSubmitting(true);
    setArrived(true); // optimistic
    checkIn
      .mutateAsync({ outingId })
      .then(() => router.refresh()) // pull the fresh "Arrived" attendee list
      .catch(() => {
        setArrived(false);
        setError(true);
      })
      .finally(() => setSubmitting(false));
  };

  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-5">
      {arrived ? (
        <p role="status" className="flex items-center gap-2 text-sm font-medium text-foreground">
          <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-success" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          You&apos;re checked in — have a great game!
        </p>
      ) : (
        <>
          <h2 className="font-display text-lg font-bold text-foreground">At the court?</h2>
          <button
            type="button"
            onClick={() => requireAuth(submit)}
            disabled={submitting}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 10c0 4.4-8 12-8 12s-8-7.6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {submitting ? "Checking in…" : "I'm here — check in"}
          </button>
          <p className="text-xs text-muted">
            Lets your group know a player has arrived. Your name is never shared.
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          Couldn&apos;t check you in.{" "}
          <button type="button" onClick={() => requireAuth(submit)} className="font-semibold underline">
            Try again
          </button>
        </p>
      )}
    </section>
  );
}
