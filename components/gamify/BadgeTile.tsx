"use client";

/**
 * BadgeTile — a badge in the collection / trophy case (§G6.3). Earned tiles show the
 * tier ring + name; LOCKED tiles render dimmed WITH a progress bar (endowed progress —
 * "7/10 courts", never a wall of grey). Tier is named in text, not color alone. The
 * `sm` variant is icon-only with a tooltip. Art is a placeholder emoji until G23.
 */

import { GamifyTooltip } from "./GamifyTooltip";

const TIER_RING: Record<number, string> = {
  1: "ring-warning/60", // Bronze
  2: "ring-foreground/40", // Silver
  3: "ring-accent/70", // Gold
  4: "ring-primary/60", // Platinum
};

export function BadgeTile({
  name,
  icon = "🏅",
  tier = 0,
  tierName,
  earned = false,
  progress,
  hidden = false,
  size = "md",
  className = "",
}: {
  name: string;
  icon?: string;
  /** 1–4 (0 = one-off / not earned). */
  tier?: number;
  tierName?: string;
  earned?: boolean;
  /** Locked-state progress toward the next tier. */
  progress?: { count: number; target: number; unit?: string };
  /** Hidden badge — render a "?" silhouette, never expose criteria. */
  hidden?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const ring = earned ? (TIER_RING[tier] ?? "ring-accent/70") : "ring-foreground/15";
  const glyph = hidden && !earned ? "❓" : icon;
  const disc = (
    <span
      className={`inline-flex items-center justify-center rounded-full ring-2 ${ring} ${
        earned ? "" : "opacity-50 grayscale"
      } ${size === "sm" ? "h-8 w-8 text-lg" : "h-14 w-14 text-2xl"}`}
      aria-hidden="true"
    >
      {glyph}
    </span>
  );

  if (size === "sm") {
    return (
      <GamifyTooltip
        content={
          <span className="text-xs">
            {hidden && !earned ? "Hidden badge" : `${name}${tierName ? ` — ${tierName}` : ""}`}
          </span>
        }
        ariaLabel={hidden && !earned ? "Hidden badge" : `${name}${tierName ? `, ${tierName}` : ""}`}
        className={`inline-flex ${className}`}
      >
        {disc}
      </GamifyTooltip>
    );
  }

  const pct = progress && progress.target > 0 ? Math.min(1, progress.count / progress.target) : 0;
  return (
    <div className={`flex w-24 flex-col items-center gap-1.5 text-center ${className}`}>
      {disc}
      <p className="text-xs font-medium leading-tight text-foreground">{hidden && !earned ? "Hidden" : name}</p>
      {earned && tierName ? (
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{tierName}</p>
      ) : progress && !hidden ? (
        <div className="w-full">
          <div
            role="progressbar"
            aria-valuenow={progress.count}
            aria-valuemin={0}
            aria-valuemax={progress.target}
            aria-label={`${name}: ${progress.count} of ${progress.target} ${progress.unit ?? ""}`.trim()}
            className="h-1 w-full overflow-hidden rounded-full bg-foreground/10"
          >
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct * 100}%` }} />
          </div>
          <p className="mt-0.5 text-[11px] tabular-nums text-muted">
            {progress.count}/{progress.target} {progress.unit}
          </p>
        </div>
      ) : null}
    </div>
  );
}
