"use client";

/**
 * QuestRow — a quest line: icon · title · progress bar (x/y) · reward chip (§G9).
 * The `compact` variant drops the bar (dashboard module). Progress uses an accessible
 * `role="progressbar"`; the bar fill animates but honors reduced motion.
 */

import type { ReactNode } from "react";
import { RpDelta } from "./RpDelta";

export function QuestRow({
  title,
  count,
  target,
  rewardRp,
  icon,
  done = false,
  compact = false,
  className = "",
}: {
  title: string;
  count: number;
  target: number;
  rewardRp: number;
  icon?: ReactNode;
  done?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const pct = target > 0 ? Math.min(1, count / target) : 0;
  const complete = done || count >= target;
  return (
    <div className={`flex items-center gap-3 ${compact ? "py-1.5" : "py-2"} ${className}`}>
      <span aria-hidden="true" className="text-lg leading-none">
        {icon ?? "🎯"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={`truncate text-sm ${complete ? "text-muted line-through" : "font-medium text-foreground"}`}>
            {title}
          </p>
          <RpDelta points={rewardRp} className="shrink-0 text-xs" />
        </div>
        {!compact && (
          <div className="mt-1.5 flex items-center gap-2">
            <div
              role="progressbar"
              aria-valuenow={Math.min(count, target)}
              aria-valuemin={0}
              aria-valuemax={target}
              aria-label={`${title}: ${count} of ${target}`}
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/10"
            >
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out motion-reduce:transition-none"
                style={{ width: `${pct * 100}%` }}
              />
            </div>
            <span className="shrink-0 text-xs tabular-nums text-muted">
              {Math.min(count, target)}/{target}
            </span>
          </div>
        )}
      </div>
      {complete && (
        <span className="text-success" aria-label="completed">
          ✓
        </span>
      )}
    </div>
  );
}
