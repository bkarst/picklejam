"use client";

/**
 * MatchScoreRow — one match's fast score entry in the run console (§6.8, 11.4).
 *
 * Gate requirement: score entry is fully KEYBOARD ACCESSIBLE — each side is a
 * real `<input type="number">` flanked by −/+ stepper buttons, all ≥44×44pt.
 * Local edits are immediate; `onSave` hands the numbers to the parent, which does
 * the optimistic write + rollback. A `conflict` status shows a clear badge (not
 * color alone). Read-only mode (spectators / the public page) hides the controls.
 */

import { useState } from "react";
import type { JSX } from "react";
import type { Match, Side } from "@/lib/roundrobin/types";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("") || "?";
}

function clamp(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(99, Math.round(n)));
}

function TeamLabel({
  side,
  names,
  align = "left",
}: {
  side: Side;
  names: Map<string, string>;
  align?: "left" | "right";
}): JSX.Element {
  const list = side.map((id) => names.get(id) ?? id);
  return (
    <div className={`flex min-w-0 items-center gap-2 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      <span className="flex shrink-0 -space-x-1.5" aria-hidden="true">
        {side.map((id) => (
          <span
            key={id}
            className="inline-flex size-7 items-center justify-center rounded-full border border-surface bg-surface-secondary text-[10px] font-semibold text-muted"
          >
            {initials(names.get(id) ?? id)}
          </span>
        ))}
      </span>
      <span className="min-w-0 truncate font-medium text-foreground">{list.join(" / ")}</span>
    </div>
  );
}

function ScoreStepper({
  value,
  onChange,
  label,
  editable,
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
  editable: boolean;
}): JSX.Element {
  if (!editable) {
    return <span className="min-w-9 text-center font-display text-2xl font-bold tabular-nums text-foreground">{value}</span>;
  }
  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        onClick={() => onChange(clamp(value - 1))}
        className="inline-flex size-11 items-center justify-center rounded-xl border border-border text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={99}
        value={String(value)}
        aria-label={label}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        className="h-11 w-12 rounded-lg border border-transparent bg-transparent text-center font-display text-2xl font-bold tabular-nums text-foreground focus-visible:border-border focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        aria-label={`Increase ${label}`}
        onClick={() => onChange(clamp(value + 1))}
        className="inline-flex size-11 items-center justify-center rounded-xl border border-border text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      </button>
    </div>
  );
}

export function MatchScoreRow({
  match,
  names,
  editable = false,
  saving = false,
  onSave,
}: {
  match: Match;
  names: Map<string, string>;
  editable?: boolean;
  saving?: boolean;
  onSave?: (scoreA: number, scoreB: number) => void;
}): JSX.Element {
  // Keyed by `match.id` at the call site, so a different match ⇒ a fresh instance
  // (state re-initialised here) — no in-render reset needed.
  const [scoreA, setScoreA] = useState(match.scoreA ?? 0);
  const [scoreB, setScoreB] = useState(match.scoreB ?? 0);

  const conflict = match.status === "conflict";
  const scored = match.status === "scored";
  const dirty = scoreA !== (match.scoreA ?? 0) || scoreB !== (match.scoreB ?? 0);
  const teamA = names.get(match.sideA[0]) ?? "Side A";
  const teamB = names.get(match.sideB[0]) ?? "Side B";

  return (
    <li className="grid grid-cols-1 items-center gap-3 rounded-2xl border border-border bg-surface p-3 sm:grid-cols-[auto_1fr_auto_1fr_auto] sm:gap-4">
      <span className="inline-flex h-9 min-w-16 items-center justify-center gap-1.5 self-start rounded-lg bg-accent px-2.5 text-sm font-semibold text-accent-foreground sm:self-auto">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M12 4v16M3 12h18" /></svg>
        {match.court ? match.court : (match.label ?? "—")}
      </span>

      <TeamLabel side={match.sideA} names={names} />

      <div className="flex items-center justify-center gap-2">
        <ScoreStepper value={scoreA} onChange={setScoreA} label={`Score for ${teamA}`} editable={editable} />
        <span aria-hidden="true" className="text-xl font-bold text-muted">–</span>
        <ScoreStepper value={scoreB} onChange={setScoreB} label={`Score for ${teamB}`} editable={editable} />
      </div>

      <TeamLabel side={match.sideB} names={names} align="right" />

      <div className="flex items-center justify-end gap-2">
        {conflict && (
          <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-1 text-xs font-semibold text-danger">
            <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4M12 17h.01" /><circle cx="12" cy="12" r="9" /></svg>
            Conflict
          </span>
        )}
        {editable ? (
          <button
            type="button"
            onClick={() => onSave?.(scoreA, scoreB)}
            disabled={saving || (scored && !dirty && !conflict)}
            className="inline-flex h-11 min-w-24 items-center justify-center gap-2 rounded-xl bg-success px-4 text-sm font-semibold text-success-foreground transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {saving ? (
              "Saving…"
            ) : scored && !dirty ? (
              <>
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                Saved
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8M7 3v5h8" /></svg>
                Save
              </>
            )}
          </button>
        ) : scored ? (
          <span className="text-xs font-medium text-muted">Final</span>
        ) : null}
      </div>
    </li>
  );
}
