"use client";

/**
 * MatchConfirmRow — one weekly fixture with the §7.3 two-party score handshake:
 * one side REPORTS the score, the other side CONFIRMS (or disputes → conflict).
 * OPTIMISTIC: on report the row flips to "waiting for confirm" immediately; on
 * confirm it flips to "final" immediately, reverting on error. Feedback is instant
 * (CLAUDE.md). Inputs are labelled; state is text + icon, never color alone.
 */

import { useState } from "react";
import type { JSX } from "react";
import { useReportScore, useConfirmScore } from "@/lib/api/leagues";
import type { ScheduleMatchItem, MatchConfirmStatus } from "@/lib/db/types";

const NUM =
  "h-11 w-16 rounded-xl border border-border bg-field px-3 text-center text-lg font-bold tabular-nums text-field-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

export interface MatchConfirmRowProps {
  lid: string;
  match: ScheduleMatchItem;
  /** Which side the current user's team is on. */
  mySide: "A" | "B";
  nameA: string;
  nameB: string;
}

export function MatchConfirmRow({ lid, match, mySide, nameA, nameB }: MatchConfirmRowProps): JSX.Element {
  const reportMut = useReportScore(lid);
  const confirmMut = useConfirmScore(lid);

  // Optimistic local view of the handshake so the row updates before the server.
  const [status, setStatus] = useState<MatchConfirmStatus>(match.confirmStatus);
  const [reportedBy, setReportedBy] = useState<string | undefined>(match.reportedBy);
  const [a, setA] = useState<number | undefined>(match.scoreA);
  const [b, setB] = useState<number | undefined>(match.scoreB);
  const [inA, setInA] = useState(match.scoreA != null ? String(match.scoreA) : "");
  const [inB, setInB] = useState(match.scoreB != null ? String(match.scoreB) : "");
  const [error, setError] = useState<string | null>(null);

  const iReported = reportedBy === mySide;
  const busy = reportMut.isPending || confirmMut.isPending;

  const submitReport = () => {
    const na = Number(inA);
    const nb = Number(inB);
    if (!Number.isInteger(na) || !Number.isInteger(nb) || na < 0 || nb < 0 || inA === "" || inB === "") {
      setError("Enter both scores.");
      return;
    }
    setError(null);
    const prev = { status, a, b, reportedBy };
    setStatus("reported"); // optimistic
    setReportedBy(mySide);
    setA(na);
    setB(nb);
    reportMut
      .mutateAsync({ week: match.week, mid: match.mid, scoreA: na, scoreB: nb })
      .catch((e: unknown) => {
        setStatus(prev.status);
        setReportedBy(prev.reportedBy);
        setA(prev.a);
        setB(prev.b);
        setError(e instanceof Error ? e.message : "Couldn't submit the score.");
      });
  };

  const confirm = (agree: boolean) => {
    setError(null);
    const prev = status;
    setStatus(agree ? "confirmed" : "conflict"); // optimistic
    confirmMut.mutateAsync({ week: match.week, mid: match.mid, agree }).catch((e: unknown) => {
      setStatus(prev);
      setError(e instanceof Error ? e.message : "Couldn't confirm the score.");
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Week {match.week}</span>
        <StatusChip status={status} />
      </div>

      {/* Teams */}
      <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2">
        <span className="min-w-0 truncate text-sm font-semibold text-foreground">
          {nameA}
          {mySide === "A" && <span className="ml-1 text-xs font-normal text-muted">(you)</span>}
        </span>
        {status === "scheduled" ? (
          <label className="justify-self-end">
            <span className="sr-only">Score for {nameA}</span>
            <input className={NUM} inputMode="numeric" value={inA} onChange={(e) => setInA(e.target.value)} placeholder="0" />
          </label>
        ) : (
          <span className="justify-self-end text-lg font-bold tabular-nums text-foreground">{a ?? "–"}</span>
        )}

        <span className="min-w-0 truncate text-sm font-semibold text-foreground">
          {nameB}
          {mySide === "B" && <span className="ml-1 text-xs font-normal text-muted">(you)</span>}
        </span>
        {status === "scheduled" ? (
          <label className="justify-self-end">
            <span className="sr-only">Score for {nameB}</span>
            <input className={NUM} inputMode="numeric" value={inB} onChange={(e) => setInB(e.target.value)} placeholder="0" />
          </label>
        ) : (
          <span className="justify-self-end text-lg font-bold tabular-nums text-foreground">{b ?? "–"}</span>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4">
        {status === "scheduled" && (
          <button
            type="button"
            onClick={submitReport}
            disabled={busy}
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-secondary px-5 text-sm font-semibold text-secondary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {reportMut.isPending ? "Submitting…" : "Submit score"}
          </button>
        )}

        {status === "reported" && iReported && (
          <p className="flex items-center gap-2 rounded-xl bg-warning/10 p-3 text-sm text-foreground">
            <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-warning" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
            Score submitted — waiting for your opponent to confirm.
          </p>
        )}

        {status === "reported" && !iReported && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => confirm(true)}
              disabled={busy}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-success px-5 text-sm font-semibold text-success-foreground transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
              Confirm score
            </button>
            <button
              type="button"
              onClick={() => confirm(false)}
              disabled={busy}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Dispute
            </button>
          </div>
        )}

        {status === "confirmed" && (
          <p className="flex items-center gap-2 text-sm font-medium text-success">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
            Final — both teams confirmed.
          </p>
        )}

        {status === "conflict" && (
          <p role="alert" className="flex items-center gap-2 rounded-xl bg-danger/10 p-3 text-sm text-foreground">
            <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-danger" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /></svg>
            Scores don&apos;t match. Please re-check with your opponent or contact the organizer.
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: MatchConfirmStatus }): JSX.Element {
  const map: Record<MatchConfirmStatus, { label: string; tone: string }> = {
    scheduled: { label: "Scheduled", tone: "bg-surface-secondary text-muted" },
    reported: { label: "Awaiting confirm", tone: "bg-warning/15 text-warning-foreground" },
    confirmed: { label: "Confirmed", tone: "bg-success/15 text-foreground" },
    conflict: { label: "Conflict", tone: "bg-danger/15 text-danger" },
  };
  const m = map[status];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${m.tone}`}>{m.label}</span>;
}

export default MatchConfirmRow;
