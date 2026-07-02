"use client";

/**
 * SaveHeartButton — the Hot-Pink "save / follow" heart shown on court cards.
 *
 * STAGE 1 STUB: Follow/save persistence lands in Stage 3. For now this only
 * toggles local visual state so the tap gives immediate feedback (UI §1). It is
 * a real ≥44×44 button with an accessible label and `aria-pressed`; the heart
 * icon is never the sole signal of state.
 */

import { useState } from "react";
import type { JSX } from "react";

export function SaveHeartButton({ name }: { name: string }): JSX.Element {
  const [saved, setSaved] = useState(false);

  return (
    <button
      type="button"
      aria-label={saved ? `Saved ${name}` : `Save ${name}`}
      aria-pressed={saved}
      onClick={() => setSaved((v) => !v)}
      className="inline-flex size-11 items-center justify-center rounded-full text-secondary transition-colors hover:bg-secondary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-6"
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
      </svg>
    </button>
  );
}
