"use client";

/**
 * StreakChip — the weekly Play-Streak indicator (§G8). A flame-free bouncing-ball chain
 * glyph (placeholder art until G23) + `N wk`, with a tooltip showing the longest streak
 * and banked Rain Checks (filled/empty dots — distinguished by SHAPE, not color alone).
 */

import { GamifyTooltip } from "./GamifyTooltip";

function ChainGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 16" width="28" height="12" aria-hidden="true" className={className}>
      {[6, 20, 34].map((cx, i) => (
        <circle key={cx} cx={cx} cy={i === 2 ? 6 : 10} r="4" fill="currentColor" opacity={0.5 + i * 0.25} />
      ))}
      <path d="M6 10 Q13 2 20 10 Q27 2 34 6" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
    </svg>
  );
}

export function StreakChip({
  weeks,
  best,
  rainChecks = 0,
  className = "",
}: {
  weeks: number;
  best?: number;
  rainChecks?: number;
  className?: string;
}) {
  const tip = (
    <span className="flex flex-col gap-1 text-xs">
      <span>{best !== undefined ? `Longest: ${best} weeks` : `${weeks}-week streak`}</span>
      {rainChecks > 0 && (
        <span className="flex items-center gap-1">
          Rain Checks:
          <span aria-hidden="true">{"🌧".repeat(rainChecks)}</span>
          <span className="sr-only">{rainChecks} banked</span>
        </span>
      )}
    </span>
  );
  return (
    <GamifyTooltip
      content={tip}
      ariaLabel={`Play streak: ${weeks} weeks${best !== undefined ? `, longest ${best}` : ""}`}
      className={`inline-flex items-center gap-1.5 text-accent ${className}`}
    >
      <ChainGlyph />
      <span className="text-sm font-semibold tabular-nums text-foreground">{weeks} wk</span>
    </GamifyTooltip>
  );
}
