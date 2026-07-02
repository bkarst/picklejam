"use client";

/**
 * EntrantsEditor — add / remove the players (or teams) in a round robin (§6.8,
 * design 11.2). Zero-friction: type a name + Enter, or paste a whole list from a
 * spreadsheet. Optional per-entrant ratings feed the engine's seeding/pairing.
 *
 * Controlled: the parent owns the `DraftEntrant[]` and maps it to engine
 * `Entrant`s at submit time. Every action gives immediate feedback (the chip
 * appears at once); the input keeps focus so a whole roster is fast to enter.
 */

import { useId, useRef, useState } from "react";
import type { JSX } from "react";

export interface DraftEntrant {
  /** Stable client-side key (not the engine entrant id). */
  id: string;
  name: string;
  /** Optional DUPR-style rating; 0/undefined = "new player". */
  rating?: number;
}

let seq = 0;
/** A fresh draft entrant with a stable key. */
export function makeDraftEntrant(name: string, rating?: number): DraftEntrant {
  seq += 1;
  return { id: `d${seq}`, name, rating };
}

const RATING_OPTIONS = ["2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0", "5.5"];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}

/** Split a pasted blob into names (newline / comma / tab separated). */
export function parsePastedNames(raw: string): string[] {
  return raw
    .split(/[\n,\t]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function EntrantsEditor({
  value,
  onChange,
  noun = "player",
}: {
  value: DraftEntrant[];
  onChange: (next: DraftEntrant[]) => void;
  noun?: "player" | "team";
}): JSX.Element {
  const [draft, setDraft] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [showRatings, setShowRatings] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const add = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onChange([...value, makeDraftEntrant(trimmed)]);
  };

  const addFromInput = () => {
    if (!draft.trim()) return;
    add(draft);
    setDraft("");
    inputRef.current?.focus();
  };

  const remove = (id: string) => onChange(value.filter((e) => e.id !== id));

  const setRating = (id: string, rating: number | undefined) =>
    onChange(value.map((e) => (e.id === id ? { ...e, rating } : e)));

  const addPasted = () => {
    const names = parsePastedNames(pasteText);
    if (names.length > 0) onChange([...value, ...names.map((n) => makeDraftEntrant(n))]);
    setPasteText("");
    setPasteOpen(false);
  };

  const label = noun === "team" ? "team" : "player";

  return (
    <div className="flex flex-col gap-3">
      {/* Current entrants */}
      {value.length > 0 && (
        <ul id={listId} className="flex flex-wrap gap-2" aria-label={`Added ${label}s`}>
          {value.map((e) => (
            <li
              key={e.id}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-2 text-sm"
            >
              <span
                aria-hidden="true"
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-xs font-semibold text-muted"
              >
                {initials(e.name)}
              </span>
              <span className="font-medium text-foreground">{e.name}</span>
              <button
                type="button"
                onClick={() => remove(e.id)}
                aria-label={`Remove ${e.name}`}
                className="inline-flex size-6 items-center justify-center rounded-full text-muted transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add a name */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(ev) => setDraft(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") {
                ev.preventDefault();
                addFromInput();
              }
            }}
            aria-label={`Add a ${label}`}
            placeholder={`Add a ${label}…`}
            className="h-11 w-full rounded-xl border border-border bg-field pl-4 pr-12 text-field-foreground placeholder:text-field-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
          <button
            type="button"
            onClick={addFromInput}
            disabled={!draft.trim()}
            aria-label={`Add ${label}`}
            className="absolute right-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        </div>
        <button
          type="button"
          onClick={() => setPasteOpen((o) => !o)}
          aria-expanded={pasteOpen}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M9 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3" /></svg>
          Paste a list
        </button>
      </div>

      {/* Paste-a-list disclosure */}
      {pasteOpen && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3">
          <label className="text-sm font-medium text-foreground" htmlFor={`${listId}-paste`}>
            Paste names — one per line, or comma-separated
          </label>
          <textarea
            id={`${listId}-paste`}
            value={pasteText}
            onChange={(ev) => setPasteText(ev.target.value)}
            rows={4}
            placeholder={"Alex Johnson\nTaylor Nguyen\nJamie Lee"}
            className="w-full resize-none rounded-lg border border-border bg-field px-3 py-2 text-sm text-field-foreground placeholder:text-field-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setPasteOpen(false);
                setPasteText("");
              }}
              className="inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={addPasted}
              disabled={parsePastedNames(pasteText).length === 0}
              className="inline-flex h-9 items-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Add {parsePastedNames(pasteText).length || ""} {label}
              {parsePastedNames(pasteText).length === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      )}

      {/* Ratings (optional) */}
      {value.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowRatings((s) => !s)}
            aria-expanded={showRatings}
            className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <svg viewBox="0 0 24 24" className={`size-4 transition-transform ${showRatings ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            {showRatings ? "Hide ratings" : "Add ratings (optional)"}
          </button>
          {showRatings && (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {value.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <span className="min-w-0 truncate text-sm font-medium text-foreground">{e.name}</span>
                  <select
                    aria-label={`Rating for ${e.name}`}
                    value={e.rating ? String(e.rating) : ""}
                    onChange={(ev) =>
                      setRating(e.id, ev.target.value ? Number(ev.target.value) : undefined)
                    }
                    className="h-9 shrink-0 rounded-lg border border-border bg-field px-2 text-sm text-field-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    <option value="">New</option>
                    {RATING_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
