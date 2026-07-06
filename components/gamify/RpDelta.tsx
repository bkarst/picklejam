"use client";

/**
 * RpDelta — a signed Rally-Points delta (`+25 RP` / `−15 RP`).
 *
 * Sign is conveyed by BOTH a ▲/▼ icon AND color (never color alone — G2.4 rule 5 /
 * CLAUDE.md accessibility). The visible `+`/`−` in the text keeps it screen-reader clear;
 * the arrow is decorative (`aria-hidden`).
 */

export function RpDelta({
  points,
  showUnit = true,
  className = "",
}: {
  points: number;
  /** Append " RP" (off for compact chips that label the unit elsewhere). */
  showUnit?: boolean;
  className?: string;
}) {
  const positive = points >= 0;
  const color = positive ? "text-success" : "text-danger";
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold tabular-nums ${color} ${className}`}>
      <span aria-hidden="true">{positive ? "▲" : "▼"}</span>
      <span>
        {positive ? "+" : "−"}
        {Math.abs(points)}
        {showUnit ? " RP" : ""}
      </span>
    </span>
  );
}
