"use client";

/**
 * CheckInSheet — the "Check In" action on a court (§6.2, design 4.5).
 *
 * Signed in  → check in with an optional note, skill, and "looking to play".
 * Signed out → "Check in without an account" (anonymous — an anon token is
 *              persisted by the hook), plus an upsell to create a profile so you
 *              become visible and can get invited (`requireAuth(intent,"signup")`).
 *
 * Every action gets immediate feedback (UI §1): the submit shows a pending state,
 * and on success we swap to a confirmation with the updated "today" count.
 */

import { useEffect, useId, useState } from "react";
import type { JSX } from "react";
import { ToggleButtonGroup, ToggleButton, Switch } from "@heroui/react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useCheckIn } from "@/lib/api/community";

const SKILL_OPTIONS = ["2.5", "3.0", "3.5", "4.0", "4.5", "5.0"] as const;
const MAX_NOTE = 200;

export function CheckInSheet({
  courtId,
  courtName,
}: {
  courtId: string;
  courtName?: string;
}): JSX.Element {
  const { user, requireAuth } = useAuth();
  const checkIn = useCheckIn(courtId);
  const titleId = useId();

  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [skill, setSkill] = useState<number | null>(null);
  const [lookingToPlay, setLookingToPlay] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  const [result, setResult] = useState<{ count: number; anonymous: boolean } | null>(null);

  const signedIn = !!user;

  // Esc closes; lock scroll while open (mirrors AuthModal).
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const reset = () => {
    setNote("");
    setSkill(null);
    setLookingToPlay(true);
    setSubmitting(false);
    setError(false);
    setResult(null);
  };

  const close = () => {
    setOpen(false);
    // Reset after the sheet is dismissed so the confirmation isn't seen flashing away.
    setTimeout(reset, 200);
  };

  const submit = async () => {
    setSubmitting(true);
    setError(false);
    try {
      const res = await checkIn.mutateAsync({
        note: note.trim() || undefined,
        skill: skill ?? undefined,
        lookingToPlay,
        anonymous: !signedIn,
      });
      setResult({ count: res.todayCount, anonymous: !signedIn });
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const upsell = () => {
    close();
    requireAuth(undefined, "signup");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-secondary px-5 text-sm font-semibold text-secondary-foreground transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        Check In
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="absolute inset-0 bg-backdrop" aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-border bg-overlay p-5 shadow-overlay sm:max-w-md sm:rounded-2xl sm:p-6"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 id={titleId} className="font-display text-xl font-bold text-foreground">
                {result ? "You're checked in!" : "Check in"}
                {courtName && !result && (
                  <span className="mt-0.5 block text-sm font-normal text-muted">{courtName}</span>
                )}
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={close}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>

            {result ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 rounded-xl bg-success/10 p-4 text-success">
                  <svg viewBox="0 0 24 24" className="size-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 13l4 4L19 7" /></svg>
                  <p className="text-sm font-medium" role="status">
                    <span className="font-bold">{result.count}</span> checked in today.
                  </p>
                </div>

                {result.anonymous && (
                  <div className="rounded-xl border border-border p-4">
                    <p className="font-semibold text-foreground">Create a profile</p>
                    <p className="mt-1 text-sm text-muted">
                      Be visible to other players and get invited to games.
                    </p>
                    <button
                      type="button"
                      onClick={upsell}
                      className="mt-3 inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    >
                      Create a profile
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={close}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {!signedIn && (
                  <div className="rounded-xl border border-accent/40 bg-accent/5 p-3 text-sm">
                    <p className="text-muted">
                      Checking in without an account keeps you anonymous.{" "}
                      <button
                        type="button"
                        onClick={upsell}
                        className="font-semibold text-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                      >
                        Create a profile to be visible &amp; get invited.
                      </button>
                    </p>
                  </div>
                )}

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Note (optional)</span>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE))}
                    rows={2}
                    placeholder="Anyone up for doubles?"
                    className="w-full resize-none rounded-xl border border-border bg-field px-4 py-2.5 text-field-foreground placeholder:text-field-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  />
                </label>

                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">Skill (optional)</span>
                  <ToggleButtonGroup
                    aria-label="Your skill level"
                    selectionMode="single"
                    isDetached
                    selectedKeys={skill !== null ? new Set([skill.toFixed(1)]) : new Set()}
                    onSelectionChange={(keys) => {
                      const first = [...keys][0];
                      setSkill(first ? Number(first) : null);
                    }}
                    className="flex flex-wrap gap-1.5"
                  >
                    {SKILL_OPTIONS.map((s) => (
                      <ToggleButton key={s} id={s} className="h-11 min-w-14 rounded-full px-3">
                        {s}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </div>

                <Switch isSelected={lookingToPlay} onChange={setLookingToPlay}>
                  <Switch.Content>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                    <span className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">Looking to play</span>
                      <span className="text-xs text-muted">Let others know you want a game.</span>
                    </span>
                  </Switch.Content>
                </Switch>

                {error && (
                  <p role="alert" className="text-sm text-danger">
                    Couldn&apos;t check you in — please try again.
                  </p>
                )}

                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-secondary px-5 text-sm font-semibold text-secondary-foreground transition-colors hover:opacity-90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  {submitting
                    ? "Checking in…"
                    : signedIn
                      ? "Check in"
                      : "Check in without an account"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
