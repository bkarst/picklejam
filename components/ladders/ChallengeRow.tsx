"use client";

/**
 * ChallengeRow — one ladder challenge through its lifecycle (§7.4): open →
 * accepted → reported → confirmed (or declined / expired). The two-party result
 * handshake mirrors league scores: one player reports, the other confirms → the
 * board auto re-ranks. OPTIMISTIC: respond/report/confirm update the row instantly
 * and revert on error. A response-window countdown is shown while a response is
 * pending. State is text + icon, never color alone.
 */

import { useState } from "react";
import type { JSX } from "react";
import { useRespondChallenge, useReportResult, useConfirmResult } from "@/lib/api/ladders";
import type { ChallengeItem, ChallengeStatus } from "@/lib/db/types";

const NUM =
  "h-11 w-16 rounded-xl border border-border bg-field px-3 text-center text-lg font-bold tabular-nums text-field-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** "2d 4h left", "6h left", or "Overdue". */
function countdown(dueIso: string): { text: string; overdue: boolean } {
  const ms = new Date(dueIso).getTime() - Date.now();
  if (Number.isNaN(ms)) return { text: "", overdue: false };
  if (ms <= 0) return { text: "Overdue", overdue: true };
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  const rem = hours % 24;
  return { text: days > 0 ? `${days}d ${rem}h left` : `${Math.max(1, hours)}h left`, overdue: false };
}

const STATUS_CHIP: Record<ChallengeStatus, { label: string; tone: string }> = {
  open: { label: "Awaiting response", tone: "bg-warning/15 text-warning-foreground" },
  accepted: { label: "Accepted — play & report", tone: "bg-accent/15 text-foreground" },
  declined: { label: "Declined", tone: "bg-surface-secondary text-muted" },
  reported: { label: "Awaiting confirm", tone: "bg-warning/15 text-warning-foreground" },
  confirmed: { label: "Confirmed", tone: "bg-success/15 text-foreground" },
  expired: { label: "Expired", tone: "bg-danger/15 text-danger" },
};

export interface ChallengeRowProps {
  lid: string;
  challenge: ChallengeItem;
  myUid: string;
  nameFor: (uid: string) => string;
}

export function ChallengeRow({ lid, challenge, myUid, nameFor }: ChallengeRowProps): JSX.Element {
  const respondMut = useRespondChallenge(lid);
  const reportMut = useReportResult(lid);
  const confirmMut = useConfirmResult(lid);

  const [status, setStatus] = useState<ChallengeStatus>(challenge.status);
  const [reportedBy, setReportedBy] = useState<string | undefined>(challenge.reportedBy);
  const [inCh, setInCh] = useState(challenge.scoreChallenger != null ? String(challenge.scoreChallenger) : "");
  const [inCd, setInCd] = useState(challenge.scoreChallenged != null ? String(challenge.scoreChallenged) : "");
  const [error, setError] = useState<string | null>(null);

  const iAmChallenger = challenge.challengerUid === myUid;
  const iAmChallenged = challenge.challengedUid === myUid;
  const iReported = reportedBy === myUid;
  const busy = respondMut.isPending || reportMut.isPending || confirmMut.isPending;
  const chip = STATUS_CHIP[status];
  const cd = countdown(challenge.dueDate);

  const respond = (accept: boolean) => {
    setError(null);
    const prev = status;
    setStatus(accept ? "accepted" : "declined"); // optimistic
    respondMut.mutateAsync({ cid: challenge.cid, accept }).catch((e: unknown) => {
      setStatus(prev);
      setError(e instanceof Error ? e.message : "Couldn't respond.");
    });
  };

  const report = () => {
    const sc = Number(inCh);
    const sd = Number(inCd);
    if (!Number.isInteger(sc) || !Number.isInteger(sd) || inCh === "" || inCd === "" || sc < 0 || sd < 0) {
      setError("Enter both scores.");
      return;
    }
    setError(null);
    const prev = status;
    setStatus("reported"); // optimistic
    setReportedBy(myUid);
    reportMut
      .mutateAsync({ cid: challenge.cid, scoreChallenger: sc, scoreChallenged: sd })
      .catch((e: unknown) => {
        setStatus(prev);
        setReportedBy(challenge.reportedBy);
        setError(e instanceof Error ? e.message : "Couldn't report the result.");
      });
  };

  const confirm = () => {
    setError(null);
    const prev = status;
    setStatus("confirmed"); // optimistic
    confirmMut.mutateAsync({ cid: challenge.cid }).catch((e: unknown) => {
      setStatus(prev);
      setError(e instanceof Error ? e.message : "Couldn't confirm the result.");
    });
  };

  const winnerName = challenge.winnerUid ? nameFor(challenge.winnerUid) : undefined;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {nameFor(challenge.challengerUid)}
            {iAmChallenger && <span className="ml-1 text-xs font-normal text-muted">(you)</span>}
            <span className="mx-1.5 text-muted">vs</span>
            {nameFor(challenge.challengedUid)}
            {iAmChallenged && <span className="ml-1 text-xs font-normal text-muted">(you)</span>}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Rung {challenge.challengerPos} challenging rung {challenge.challengedPos}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${chip.tone}`}>{chip.label}</span>
      </div>

      {/* Response-window countdown (while awaiting a response) */}
      {status === "open" && cd.text && (
        <p className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${cd.overdue ? "text-danger" : "text-muted"}`}>
          <svg viewBox="0 0 24 24" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
          {cd.overdue ? "Response overdue — may forfeit" : `${cd.text} to respond`}
        </p>
      )}

      {/* Actions */}
      <div className="mt-3">
        {status === "open" && iAmChallenged && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => respond(true)}
              disabled={busy}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-success px-5 text-sm font-semibold text-success-foreground transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => respond(false)}
              disabled={busy}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Decline
            </button>
          </div>
        )}

        {status === "open" && iAmChallenger && (
          <p className="text-sm text-muted">Waiting for {nameFor(challenge.challengedUid)} to respond.</p>
        )}

        {status === "accepted" && (
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted">{nameFor(challenge.challengerUid)}</span>
              <input className={NUM} inputMode="numeric" value={inCh} onChange={(e) => setInCh(e.target.value)} placeholder="0" />
            </label>
            <span className="pb-2.5 text-muted">–</span>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted">{nameFor(challenge.challengedUid)}</span>
              <input className={NUM} inputMode="numeric" value={inCd} onChange={(e) => setInCd(e.target.value)} placeholder="0" />
            </label>
            <button
              type="button"
              onClick={report}
              disabled={busy}
              className="ml-auto inline-flex h-11 items-center justify-center rounded-full bg-secondary px-5 text-sm font-semibold text-secondary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {reportMut.isPending ? "Reporting…" : "Report result"}
            </button>
          </div>
        )}

        {status === "reported" && iReported && (
          <p className="flex items-center gap-2 rounded-xl bg-warning/10 p-3 text-sm text-foreground">
            <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-warning" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
            Result reported — waiting for your opponent to confirm.
          </p>
        )}

        {status === "reported" && !iReported && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {challenge.scoreChallenger ?? inCh} – {challenge.scoreChallenged ?? inCd}
            </span>
            <button
              type="button"
              onClick={confirm}
              disabled={busy}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-success px-5 text-sm font-semibold text-success-foreground transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
              Confirm result
            </button>
          </div>
        )}

        {status === "confirmed" && (
          <p className="flex items-center gap-2 text-sm font-medium text-success">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
            {winnerName ? `${winnerName} won — board updated.` : "Result confirmed — board updated."}
          </p>
        )}

        {status === "declined" && <p className="text-sm text-muted">Challenge declined.</p>}
        {status === "expired" && <p className="text-sm text-danger">Expired — no response within the window.</p>}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export default ChallengeRow;
