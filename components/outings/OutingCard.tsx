/**
 * OutingCard — presentational summary of an outing/game (§6.7, design 10.1).
 *
 * Server-renderable (no "use client"): a game's time + timezone, its type badge
 * (Open Play / Private), the court it's at (links to the court page), the skill
 * range, spots-left / RSVP count, and the host. The whole card links through to
 * the outing detail (where RSVP lives), so it stays presentational.
 */

import type { JSX } from "react";
import Link from "next/link";
import type { OutingItem } from "@/lib/db/types";
import { outingPath } from "@/lib/urls";
import { formatTime, formatOutingDate, tzLabel, formatSkillRange } from "./format";

export interface OutingCardProps {
  outing: OutingItem;
  /** Hydrated court reference (name + canonical court page URL). */
  court?: { name: string; href: string } | null;
  /** Host display name (e.g. "Mike D."). */
  hostName?: string;
  /** Show the date alongside the time (list spans multiple days). */
  showDate?: boolean;
  className?: string;
}

function TypeBadge({ type }: { type: OutingItem["type"] }): JSX.Element {
  const open = type === "open";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-foreground ${
        open ? "bg-success/25" : "bg-secondary/20"
      }`}
    >
      {open ? "Open Play" : "Private"}
    </span>
  );
}

export function OutingCard({
  outing,
  court,
  hostName,
  showDate = false,
  className = "",
}: OutingCardProps): JSX.Element {
  const href = outingPath(outing.outingId);
  const going = outing.goingCount ?? 0;
  const spotsLabel =
    typeof outing.capacity === "number" && outing.capacity > 0
      ? `${going} / ${outing.capacity} going`
      : `${going} going`;
  const spotsLeft =
    typeof outing.capacity === "number" && outing.capacity > 0
      ? Math.max(0, outing.capacity - going)
      : null;
  const full = spotsLeft === 0;

  return (
    <div
      className={`group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-accent/40 sm:flex-row sm:items-center sm:gap-4 ${className}`}
    >
      {/* Time */}
      <div className="flex shrink-0 flex-col sm:w-24">
        <span className="font-display text-lg font-bold text-foreground">
          {formatTime(outing.startTs, outing.tz)}
        </span>
        <span className="text-xs text-muted">
          {showDate ? formatOutingDate(outing.startTs, outing.tz) : tzLabel(outing.startTs, outing.tz)}
        </span>
      </div>

      {/* Details */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={href}
            className="font-display font-bold text-foreground hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {outing.title}
          </Link>
          <TypeBadge type={outing.type} />
        </div>
        <p className="mt-0.5 truncate text-sm text-muted">
          {court ? (
            <Link
              href={court.href}
              className="hover:text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {court.name}
            </Link>
          ) : (
            "Court"
          )}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span>Skill {formatSkillRange(outing.skillMin, outing.skillMax)}</span>
          <span aria-hidden="true">·</span>
          <span className={full ? "font-semibold text-foreground" : ""}>
            {full ? "Full — join waitlist" : spotsLabel}
          </span>
          {hostName && (
            <>
              <span aria-hidden="true">·</span>
              <span>Hosted by {hostName}</span>
            </>
          )}
        </div>
      </div>

      {/* RSVP affordance → detail page */}
      <Link
        href={href}
        className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-secondary px-5 text-sm font-semibold text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {full ? "Join waitlist" : "RSVP"}
      </Link>
    </div>
  );
}
