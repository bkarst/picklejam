"use client";

/**
 * BadgeDetailSheet — the badge detail modal (§G12.7). Mirrors the check-in sheet's
 * bottom-sheet-on-mobile / centered-on-desktop pattern. Shows the large badge, its tier +
 * flavor, criteria-with-progress (endowed progress), the earned date, a **Pin to showcase**
 * toggle (max 3 — disabled with an explanation when the showcase is full and this badge
 * isn't already in it), and **Share** (copies the `/og/badge/…` card URL, fires `badge_shared`).
 */

import { useEffect, useId, useState } from "react";
import { BadgeTile } from "./BadgeTile";
import { trackEvent } from "@/lib/analytics/client";
import type { BadgeCollectionEntry } from "@/lib/gamify/view";

function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export function BadgeDetailSheet({
  entry,
  pinned,
  showcaseFull,
  onTogglePin,
  onClose,
}: {
  entry: BadgeCollectionEntry;
  pinned: boolean;
  /** 3 badges already pinned (and this one isn't one of them). */
  showcaseFull: boolean;
  onTogglePin: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const [copied, setCopied] = useState(false);
  const earned = entry.tier > 0;
  const canPin = pinned || !showcaseFull;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const share = async () => {
    const url = `${window.location.origin}/og/badge/${encodeURIComponent(entry.familyId)}?tier=${entry.tier}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — non-fatal */
    }
    trackEvent("badge_shared", { familyId: entry.familyId, tier: entry.tier });
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-backdrop" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-border bg-overlay p-6 shadow-overlay sm:max-w-sm sm:rounded-2xl"
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>

        <div className="flex flex-col items-center text-center">
          <BadgeTile
            name={entry.name}
            tier={entry.tier}
            tierName={entry.tierName}
            earned={earned}
            progress={entry.progress ? { count: entry.progress.count, target: entry.progress.nextThreshold } : undefined}
          />
          <h2 id={titleId} className="mt-2 font-display text-xl font-bold text-foreground">{entry.name}</h2>
          {earned ? (
            <p className="text-sm font-semibold text-accent">{entry.tierName}</p>
          ) : (
            <p className="text-sm text-muted">Not earned yet</p>
          )}
          <p className="mt-2 text-sm text-muted">{entry.flavor}</p>
        </div>

        {/* Criteria + progress (endowed progress). */}
        {entry.progress && (
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>{earned ? "Next tier" : "Progress"}</span>
              <span className="tabular-nums">{entry.progress.count} / {entry.progress.nextThreshold}</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={Math.min(entry.progress.count, entry.progress.nextThreshold)}
              aria-valuemin={0}
              aria-valuemax={entry.progress.nextThreshold}
              className="mt-1.5 h-2 overflow-hidden rounded-full bg-foreground/10"
            >
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(1, entry.progress.count / entry.progress.nextThreshold) * 100}%` }} />
            </div>
          </div>
        )}

        {earned && entry.awardedAt && (
          <p className="mt-4 text-center text-xs text-muted">Earned {formatDate(entry.awardedAt)}</p>
        )}

        {/* Actions — pin + share, earned badges only. */}
        {earned && (
          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={onTogglePin}
              disabled={!canPin}
              title={!canPin ? "You've pinned 3 badges — unpin one first." : undefined}
              className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                pinned ? "bg-surface-secondary text-foreground hover:opacity-90" : "bg-accent text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
              }`}
            >
              {pinned ? "Unpin from showcase" : "Pin to showcase"}
            </button>
            {!canPin && <p className="text-center text-xs text-muted">You&apos;ve pinned 3 badges — unpin one first.</p>}
            <button
              type="button"
              onClick={share}
              className="inline-flex h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {copied ? "Link copied ✓" : "Share"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
