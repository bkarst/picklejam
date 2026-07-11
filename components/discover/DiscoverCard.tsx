"use client";

/**
 * DiscoverCard — one result row in the unified finder (groups / leagues / ladders /
 * tournaments). A single tappable card linking to the entity's detail page, with the
 * three finder metrics surfaced as pills: size, average DUPR, and games last month
 * (the latter only where it applies). Never color-alone — every pill is labelled.
 */

import type { JSX } from "react";
import Link from "next/link";
import { activityApplies, sizeNoun, type DiscoverItem, type DiscoverEntityType } from "@/lib/search/discover-filters";
import { EntityAvatar } from "@/components/ui/EntityAvatar";

const PLAY_MODE_LABEL: Record<string, string> = {
  singles: "Singles",
  doubles: "Doubles",
  team: "Team",
};

/** The fallback glyph shown in the avatar when an entity has no photo — one per type. */
function typeIcon(type: DiscoverEntityType): JSX.Element {
  const cls = "size-5 text-primary";
  const common = { viewBox: "0 0 24 24", className: cls, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (type === "ladders") return <svg {...common}><path d="M7 3v18M17 3v18M7 7h10M7 12h10M7 17h10" /></svg>;
  if (type === "tournaments") return <svg {...common}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2z" /></svg>;
  // groups + leagues → the people/team glyph
  return <svg {...common}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
}

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
      className="group flex gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <EntityAvatar
        name={item.name}
        avatarUrl={item.avatarUrl}
        fallback={typeIcon(item.type)}
        className="mt-0.5 size-10"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
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
      </div>
    </Link>
  );
}
