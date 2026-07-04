"use client";

/**
 * RunConsole — fast, phone-first score entry for the organizer (§6.8, 11.4).
 *
 * Reads the event with `useRrEvent` and the creator token from localStorage
 * (`rr-token-<id>`). With a token, each match is editable via <MatchScoreRow>
 * (keyboard-accessible, ≥44pt targets); saves are OPTIMISTIC — the typed score
 * stays on screen while `useRecordScore` persists, and a failure surfaces a retry
 * without losing the number. Dynamic formats get "End round → next", which calls
 * `useAdvanceRound` to generate the next round from the confirmed scores.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import Link from "next/link";
import { Skeleton, Tooltip } from "@heroui/react";
import { useRrEvent, useRecordScore, useAdvanceRound } from "@/lib/api/roundrobin";
import { trackEvent } from "@/lib/analytics/client";
import { MatchScoreRow, formatMeta } from "@/components/roundrobin";
import { roundRobinPath } from "@/lib/urls";
import type { Entrant } from "@/lib/roundrobin/types";

function fmtClock(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function ConsoleSkeleton(): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-16 w-full rounded-2xl" />
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-20 w-full rounded-2xl" />
      ))}
    </div>
  );
}

export function RunConsole({ eventId }: { eventId: string }): JSX.Element {
  const { data, isLoading, isError, refetch } = useRrEvent(eventId);
  const recordMut = useRecordScore(eventId);
  const advanceMut = useAdvanceRound(eventId);

  const [token, setToken] = useState<string | null>(null);
  const [roundIdx, setRoundIdx] = useState(0);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [errorId, setErrorId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const initedRef = useRef(false);

  useEffect(() => {
    try {
      // One-shot mount read (SSR-safe: null on server, read on client post-hydration).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToken(localStorage.getItem(`rr-token-${eventId}`));
    } catch {
      /* storage unavailable */
    }
  }, [eventId]);

  // Jump to the first round that still has unscored matches, once, on load.
  useEffect(() => {
    if (!data || initedRef.current) return;
    initedRef.current = true;
    const idx = data.rounds.findIndex((r) => r.matches.some((m) => m.status !== "scored"));
    setRoundIdx(idx >= 0 ? idx : Math.max(0, data.rounds.length - 1));
  }, [data]);

  // Round stopwatch — resets whenever the viewed round changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setElapsed(0);
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [roundIdx]);

  const names = useMemo(
    () => new Map<string, string>(((data?.entrants ?? []) as Entrant[]).map((e) => [e.id, e.name])),
    [data],
  );

  if (isLoading) return <ConsoleSkeleton />;

  if (isError || !data) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-surface p-6">
        <p className="text-foreground">We couldn&apos;t load this event.</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Try again
        </button>
      </div>
    );
  }

  const { event, rounds } = data;
  const editable = token !== null && event.status !== "complete";
  const meta = formatMeta(event.format);
  const roundCount = rounds.length;
  const idx = Math.min(roundIdx, Math.max(0, roundCount - 1));
  const round = rounds[idx];
  const atLast = idx >= roundCount - 1;
  // Advancing is only valid once the current round is FULLY scored — mirrors the server
  // guard in advanceRound. Without this, "Next" was enabled with unscored matches, and
  // one tap finalized the event with no champion (permanently bricking it).
  const roundFullyScored = !!round && round.matches.every((m) => m.status === "scored");
  const canAdvance =
    editable && event.dynamic && atLast && event.status !== "complete" && roundFullyScored;

  const save = (matchId: string, scoreA: number, scoreB: number) => {
    if (!token) return;
    setErrorId(null);
    setSavingIds((s) => new Set(s).add(matchId));
    recordMut
      .mutateAsync({ score: { matchId, scoreA, scoreB }, token })
      .then(() =>
        // Carry the creator token (§2.1 N2) so scores attribute to the anon organizer.
        trackEvent("round_robin_scored", { eventId, matchId, rrCreatorToken: token }),
      )
      .catch(() => setErrorId(matchId))
      .finally(() =>
        setSavingIds((s) => {
          const next = new Set(s);
          next.delete(matchId);
          return next;
        }),
      );
  };

  const goNext = () => {
    if (!atLast) {
      setRoundIdx(idx + 1);
      return;
    }
    if (canAdvance) {
      advanceMut
        .mutateAsync({ token: token! })
        .then(() => setRoundIdx(idx + 1))
        .catch(() => setErrorId("__advance"));
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRoundIdx(Math.max(0, idx - 1))}
              disabled={idx <= 0}
              aria-label="Previous round"
              className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
              <span className="hidden sm:inline">Prev</span>
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={atLast && !canAdvance}
              aria-label="Next round"
              className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <span className="hidden sm:inline">Next</span>
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </button>
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              Round {round ? round.round : idx + 1} <span className="text-muted">/ {roundCount || 1}</span>
            </h1>
            <p className="text-sm text-muted">
              {meta.name} · {event.mode === "doubles" ? "Doubles" : "Singles"} · {event.courts} court
              {event.courts === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <svg viewBox="0 0 24 24" className="size-5 text-success" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M9 2h6" /></svg>
            <span className="font-display text-lg font-bold tabular-nums text-foreground" aria-label="Round time">
              {fmtClock(elapsed)}
            </span>
          </div>
          <Link
            href={roundRobinPath(eventId)}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3v18h18M7 15l4-4 3 3 5-6" /></svg>
            Standings
          </Link>
        </div>
      </div>

      {/* Spectator notice */}
      {!token && (
        <p className="rounded-xl border border-border bg-surface-secondary p-4 text-sm text-muted">
          You&apos;re viewing this as a spectator. Only the organizer (on the device that created the
          event) can enter scores.{" "}
          <Link href={roundRobinPath(eventId)} className="font-semibold text-accent hover:underline">
            View the public board
          </Link>
          .
        </p>
      )}

      {/* Matches */}
      {!round || round.matches.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-muted">
          No matches in this round yet.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-4 px-3 text-xs font-semibold uppercase tracking-wide text-muted">
            <span>Court</span>
            <span />
            <span className="text-center">Score</span>
            <span />
            <span className="text-right">{editable ? "Save" : ""}</span>
          </div>
          <ul className="flex flex-col gap-3">
            {round.matches.map((m) => (
              <MatchScoreRow
                key={m.id}
                match={m}
                names={names}
                editable={editable}
                saving={savingIds.has(m.id)}
                onSave={(a, b) => save(m.id, a, b)}
              />
            ))}
          </ul>
        </>
      )}

      {errorId && (
        <p role="alert" className="text-sm text-danger">
          {errorId === "__advance"
            ? "Couldn't start the next round. Please try again."
            : "Couldn't save that score. Check your connection and tap Save again."}
        </p>
      )}

      {/* Byes / subs */}
      {round && round.byes.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center">
          <span className="inline-flex items-center gap-2 font-semibold text-foreground">
            <span className="inline-flex size-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3M5 12a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2M6 19v2M18 19v2" /></svg>
            </span>
            Sitting this round (bye)
          </span>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {round.byes.map((id) => (
              <li key={id} className="text-sm font-medium text-muted">
                {names.get(id) ?? id}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer: status + advance */}
      <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted">
          <span className="inline-flex items-center gap-2">
            <span className={`inline-block size-2.5 rounded-full ${event.status === "complete" ? "bg-muted" : "bg-success"}`} aria-hidden="true" />
            {event.status === "complete" ? "Event complete" : "Round in progress"}
          </span>
          {editable && (
            <span className="inline-flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" className="size-4 text-success" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m9 12 2 2 4-4" /></svg>
              Scores save when you tap Save
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Roster edits are on the roadmap; shown as coming-soon per design 11.4. */}
          <Tooltip delay={0} closeDelay={0}>
            <Tooltip.Trigger
              aria-label="Add late player — coming soon"
              aria-disabled="true"
              className="inline-flex h-11 cursor-not-allowed items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-muted opacity-70"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6" /></svg>
              <span className="hidden sm:inline">Add player</span>
            </Tooltip.Trigger>
            <Tooltip.Content className="rounded-lg bg-overlay px-2 py-1 text-xs text-foreground shadow-overlay">
              Coming soon
              <Tooltip.Arrow />
            </Tooltip.Content>
          </Tooltip>

          {(canAdvance || !atLast) && (
            <button
              type="button"
              onClick={goNext}
              disabled={advanceMut.isPending}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-secondary px-6 text-base font-semibold text-secondary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {advanceMut.isPending ? (
                "Starting…"
              ) : (
                <>
                  {atLast ? "End round → next" : "Next round"}
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
