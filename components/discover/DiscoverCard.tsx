"use client";

/**
 * DiscoverCard — one result row in the unified finder (groups / leagues / ladders /
 * tournaments). A single tappable card linking to the entity's detail page, with the
 * three finder metrics surfaced as pills: size, average DUPR, and games last month
 * (the latter only where it applies). Never color-alone — every pill is labelled.
 */

import type { JSX } from "react";
import Link from "next/link";
import { activityApplies, sizeNoun, type DiscoverItem } from "@/lib/search/discover-filters";

const PLAY_MODE_LABEL: Record<string, string> = {
  singles: "Singles",
  doubles: "Doubles",
  team: "Team",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Format a `yyyy-mm-dd` start date as "Sep 1, 2026" without timezone drift. */
function formatStart(date: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const [, y, mo, d] = m;
  return `${MONTHS[Number(mo) - 1]} ${Number(d)}, ${y}`;
}

function Pill({ value, label }: { value: string | number; label: string }): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-secondary px-2.5 py-1 text-xs font-medium text-foreground">
      {value}
      <span className="font-normal text-muted">{label}</span>
    </span>
  );
}

export function DiscoverCard({ item }: { item: DiscoverItem }): JSX.Element {
  const start = item.startDate ? formatStart(item.startDate) : null;
  const meta = [item.cityLabel, item.detail].filter(Boolean).join(" · ");

  return (
    <Link
      href={item.url}
      className="group flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-base font-bold text-foreground group-hover:text-accent">
          {item.name}
        </h3>
        {start && <span className="shrink-0 pt-0.5 text-xs text-muted">{start}</span>}
      </div>

      <p className="text-sm text-muted">{meta}</p>

      <div className="mt-1 flex flex-wrap gap-1.5">
        <Pill value={item.size} label={sizeNoun(item.type, item.size)} />
        {item.avgDupr != null && <Pill value={item.avgDupr.toFixed(1)} label="avg DUPR" />}
        {activityApplies(item.type) && item.gamesLastMonth != null && (
          <Pill value={item.gamesLastMonth} label={item.gamesLastMonth === 1 ? "game / mo" : "games / mo"} />
        )}
        {item.playMode && PLAY_MODE_LABEL[item.playMode] && (
          <span className="inline-flex items-center rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted">
            {PLAY_MODE_LABEL[item.playMode]}
          </span>
        )}
      </div>
    </Link>
  );
}
