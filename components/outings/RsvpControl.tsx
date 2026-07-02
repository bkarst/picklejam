"use client";

/**
 * RsvpControl — "Are you going?" for an outing (§6.7, design 10.2).
 *
 * Going / Maybe / Can't as a segmented control, an optional guest-count stepper,
 * and a primary action. When the game is full it flips to a WAITLIST join and
 * shows your position. RSVP is a gated action: signed-out visitors get the auth
 * modal via `requireAuth`, which resumes the RSVP on success (J8).
 *
 * Updates are OPTIMISTIC (UI §1): the committed state changes immediately, and on
 * failure we roll back to the previous RSVP and surface a retry.
 */

import { useState } from "react";
import type { JSX } from "react";
import { ToggleButtonGroup, ToggleButton } from "@heroui/react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRsvp, useCancelRsvp } from "@/lib/api/outings";
import type { RsvpStatus } from "@/lib/db/types";

type Choice = "going" | "maybe" | "declined";

interface Committed {
  status: RsvpStatus;
  guestCount?: number;
  waitlistPos?: number;
}

export interface RsvpControlProps {
  outingId: string;
  capacity?: number;
  goingCount: number;
  waitlistCount?: number;
  waitlistEnabled?: boolean;
  guestPolicy?: "none" | "allowed";
  /** The caller's existing RSVP, if any (from the server-rendered detail page). */
  initialRsvp?: Committed | null;
}

const MAX_GUESTS = 4;

const CHOICE_LABELS: Record<Choice, string> = {
  going: "Going",
  maybe: "Maybe",
  declined: "Can't",
};

export function RsvpControl({
  outingId,
  capacity,
  goingCount,
  waitlistCount = 0,
  waitlistEnabled = false,
  guestPolicy = "none",
  initialRsvp = null,
}: RsvpControlProps): JSX.Element {
  const { requireAuth } = useAuth();
  const rsvpMut = useRsvp(outingId);
  const cancelMut = useCancelRsvp(outingId);

  const [committed, setCommitted] = useState<Committed | null>(initialRsvp);
  const [choice, setChoice] = useState<Choice>(
    initialRsvp && initialRsvp.status !== "declined"
      ? initialRsvp.status === "maybe"
        ? "maybe"
        : "going"
      : initialRsvp?.status === "declined"
        ? "declined"
        : "going",
  );
  const [guests, setGuests] = useState<number>(initialRsvp?.guestCount ?? 0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  const guestsAllowed = guestPolicy === "allowed" && (choice === "going" || choice === "maybe");
  const alreadyGoing = committed?.status === "going";
  const full = typeof capacity === "number" && capacity > 0 && goingCount >= capacity;
  const joiningWaitlist = choice === "going" && full && !alreadyGoing && waitlistEnabled;
  const blockedFull = choice === "going" && full && !alreadyGoing && !waitlistEnabled;

  const primaryLabel =
    choice === "going"
      ? joiningWaitlist
        ? "Join Waitlist"
        : "I'm Going!"
      : choice === "maybe"
        ? "Save"
        : "Can't make it";

  const submit = () => {
    const prev = committed;
    const effectiveStatus: RsvpStatus = joiningWaitlist ? "waitlist" : choice;
    const optimistic: Committed = {
      status: effectiveStatus,
      guestCount: guestsAllowed ? guests : undefined,
      waitlistPos: effectiveStatus === "waitlist" ? waitlistCount + 1 : undefined,
    };
    setError(false);
    setSubmitting(true);
    setCommitted(optimistic);
    rsvpMut
      .mutateAsync({
        status: effectiveStatus,
        ...(guestsAllowed ? { guestCount: guests } : {}),
      })
      .catch(() => {
        setCommitted(prev); // roll back
        setError(true);
      })
      .finally(() => setSubmitting(false));
  };

  const remove = () => {
    const prev = committed;
    setError(false);
    setSubmitting(true);
    setCommitted(null);
    cancelMut
      .mutateAsync()
      .catch(() => {
        setCommitted(prev);
        setError(true);
      })
      .finally(() => setSubmitting(false));
  };

  const onPrimary = () => requireAuth(submit);

  const committedLine = (() => {
    if (!committed) return null;
    switch (committed.status) {
      case "going":
        return `You're going!${committed.guestCount ? ` +${committed.guestCount} guest${committed.guestCount === 1 ? "" : "s"}` : ""}`;
      case "maybe":
        return "You said maybe.";
      case "waitlist":
        return committed.waitlistPos
          ? `You're on the waitlist — #${committed.waitlistPos}.`
          : "You're on the waitlist.";
      case "declined":
        return "You can't make it.";
      default:
        return null;
    }
  })();

  return (
    <section
      aria-labelledby="rsvp-heading"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5"
    >
      <h2 id="rsvp-heading" className="font-display text-lg font-bold text-foreground">
        Are you going?
      </h2>

      <ToggleButtonGroup
        aria-label="Your RSVP"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={new Set([choice])}
        onSelectionChange={(keys) => {
          const first = [...keys][0];
          if (first) setChoice(first as Choice);
        }}
        className="grid grid-cols-3 gap-1 rounded-full bg-surface-secondary p-1"
      >
        {(["going", "maybe", "declined"] as const).map((c) => (
          <ToggleButton key={c} id={c} className="h-11 rounded-full text-sm font-semibold">
            {CHOICE_LABELS[c]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <div className="flex flex-wrap items-end gap-4">
        {guestsAllowed && (
          <div className="flex flex-col gap-1.5">
            <span id="rsvp-guests-label" className="text-sm font-medium text-foreground">
              Guests
            </span>
            <div
              role="group"
              aria-labelledby="rsvp-guests-label"
              className="inline-flex items-center gap-1 rounded-full border border-border p-1"
            >
              <button
                type="button"
                aria-label="Fewer guests"
                disabled={guests <= 0}
                onClick={() => setGuests((g) => Math.max(0, g - 1))}
                className="inline-flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface-secondary disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
              </button>
              <span aria-live="polite" className="min-w-8 text-center font-semibold text-foreground">
                {guests}
              </span>
              <button
                type="button"
                aria-label="More guests"
                disabled={guests >= MAX_GUESTS}
                onClick={() => setGuests((g) => Math.min(MAX_GUESTS, g + 1))}
                className="inline-flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface-secondary disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onPrimary}
          disabled={submitting || blockedFull}
          className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-secondary px-6 text-sm font-semibold text-secondary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {submitting ? "Saving…" : primaryLabel}
        </button>
      </div>

      {joiningWaitlist && (
        <p className="text-sm text-muted">This game is full — you&apos;ll join the waitlist.</p>
      )}
      {blockedFull && (
        <p className="text-sm text-muted">This game is full and isn&apos;t taking a waitlist.</p>
      )}

      {committedLine && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-success/15 px-4 py-3">
          <p role="status" className="flex items-center gap-2 text-sm font-medium text-foreground">
            <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-success" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
            {committedLine}
          </p>
          <button
            type="button"
            onClick={remove}
            disabled={submitting}
            className="shrink-0 text-sm font-semibold text-muted underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Remove
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-danger">
          Couldn&apos;t save your RSVP.{" "}
          <button type="button" onClick={onPrimary} className="font-semibold underline">
            Try again
          </button>
        </p>
      )}
    </section>
  );
}
