"use client";

/**
 * GamifyProgressModule — the "Your progress" dashboard card (§G12.5-I1), first in the
 * grid. Returns null when gamification is suppressed (prefs off / holdout) so the grid
 * reflows to its as-built layout. A fresh account shows the Level-1 ring with the
 * welcome-bonus fill (endowed progress, §G2.2). Weekly quests are the P2 second module.
 */

import Link from "next/link";
import type { JSX } from "react";
import { Skeleton } from "@heroui/react";
import { useMyGamify } from "@/lib/api/gamify";
import { LevelRing } from "@/components/gamify/LevelRing";
import { StreakChip } from "@/components/gamify/StreakChip";

export function GamifyProgressModule(): JSX.Element | null {
  const { data: me, isLoading } = useMyGamify();

  if (isLoading) return <Skeleton className="h-36 w-full rounded-2xl" />;
  if (!me || !me.enabled) return null;

  const p = me.profile;
  const level = p?.level ?? 1;
  const monthRp = p?.monthRp ?? 0;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold text-foreground">Your progress</h2>
        <Link href="/account/progress" className="shrink-0 text-sm font-semibold text-accent hover:underline">
          View progress →
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <LevelRing level={level} progress={p?.progress ?? 0.25} size={56} isMax={p?.isMaxLevel} />
        <div className="min-w-0">
          <p className="font-semibold text-foreground">
            Lv {level} · {p?.levelName ?? "Paddle Rookie"}
          </p>
          <p className="text-sm text-muted">
            {(p?.rp ?? 0).toLocaleString()} RP
            {monthRp > 0 ? ` · +${monthRp} this month` : ""}
          </p>
          {p && p.streakWeeks > 0 && (
            <div className="mt-1.5">
              <StreakChip weeks={p.streakWeeks} best={p.streakBest} rainChecks={p.rainChecks} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
