"use client";

/**
 * LevelRing — an SVG radial showing progress toward the next level (§G5, the primary
 * progress visual). `role="img"` with a full-text label so the fraction is announced;
 * the fill animates but honors `prefers-reduced-motion`. Colors come from tokens via
 * `currentColor` (no hardcoded hex). At max level the ring is full and shows a star.
 */

import type { ReactNode } from "react";

export function LevelRing({
  level,
  progress,
  size = 48,
  isMax = false,
  center,
  className = "",
}: {
  level: number;
  /** 0–1 toward the next level. */
  progress: number;
  size?: number;
  isMax?: boolean;
  /** Override the center content (e.g. RP-to-next text); defaults to the level number. */
  center?: ReactNode;
  className?: string;
}) {
  const stroke = size >= 96 ? 8 : size >= 64 ? 6 : 5;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, isMax ? 1 : progress));
  const label = isMax
    ? `Level ${level}, max level reached`
    : `Level ${level}, ${Math.round(pct * 100)}% to the next level`;

  return (
    <div
      role="img"
      aria-label={label}
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-foreground/15"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          className="text-accent transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-bold leading-none text-foreground"
        style={{ fontSize: Math.round(size * 0.32) }}
        aria-hidden="true"
      >
        {center ?? (isMax ? "★" : level)}
      </span>
    </div>
  );
}
