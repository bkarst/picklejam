/**
 * AnonPlayer — the anonymous-player display kit for check-in surfaces (§6.2: check-ins
 * never surface identity; the only per-player fact shown is a rating, when available).
 * `AnonPlayerDot` is the avatar stand-in (rating number, else a neutral person glyph);
 * `anonPlayerLabel` is the matching text ("4.0 player" / "A player").
 */

import type { JSX } from "react";

export function anonPlayerLabel(rating?: number): string {
  return rating != null ? `${rating.toFixed(1)} player` : "A player";
}

export function AnonPlayerDot({
  rating,
  className = "size-8 text-[11px]",
}: {
  rating?: number;
  /** Size/ring overrides — keep a `size-*` and a text size for the rating digits. */
  className?: string;
}): JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent ${className}`}
    >
      {rating != null ? (
        <span className="font-bold leading-none">{rating.toFixed(1)}</span>
      ) : (
        <svg viewBox="0 0 24 24" className="size-1/2" fill="currentColor">
          <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4.4 0-8 2.7-8 6v2h16v-2c0-3.3-3.6-6-8-6z" />
        </svg>
      )}
    </span>
  );
}
