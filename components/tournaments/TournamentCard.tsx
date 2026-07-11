/**
 * TournamentCard — a tournament summary for the hub + city-finder lists (§7.1).
 * A plain `div` (no HeroUI Card — CLAUDE.md) with a hover state; the whole card is
 * a link to the detail page. Shows the status chip, title, date range, venue/city,
 * and a "from $X" price via {@link formatMoney}. Empty-safe (no price ⇒ no price
 * line).
 */

import type { JSX } from "react";
import Link from "next/link";
import { formatMoney, type Money } from "@/lib/money";
import { tournamentPath } from "@/lib/urls";
import type { TourneyItem } from "@/lib/db/types";
import { EntityAvatar } from "@/components/ui/EntityAvatar";
import { formatDateRange, statusMeta } from "./format";

function TrophyIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="size-5 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2z" />
    </svg>
  );
}

export function TournamentCard({
  tournament,
  priceFrom,
  cityLabel,
}: {
  tournament: TourneyItem;
  priceFrom?: Money;
  /** e.g. "Lenexa, KS" — falls back to the tournament's venue name. */
  cityLabel?: string;
}): JSX.Element {
  const status = statusMeta(tournament.status);
  const place = cityLabel ?? tournament.venueName;

  return (
    <Link
      href={tournamentPath(tournament.tid)}
      className="group flex gap-3 rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-accent/50 hover:bg-surface-secondary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <EntityAvatar
        name={tournament.title}
        avatarUrl={tournament.avatarUrl}
        fallback={<TrophyIcon />}
        className="mt-0.5 size-10"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.tone}`}>
            {status.label}
          </span>
          {priceFrom && (
            <span className="text-right text-sm text-muted">
              from{" "}
              <span className="font-display text-base font-bold text-foreground">
                {formatMoney(priceFrom)}
              </span>
            </span>
          )}
        </div>

        <h3 className="font-display text-lg font-bold text-foreground group-hover:text-accent">
          {tournament.title}
        </h3>

        <div className="mt-auto flex flex-col gap-1 text-sm text-muted">
          <span className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            {formatDateRange(tournament.startDate, tournament.endDate)}
          </span>
          {place && (
            <span className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              <span className="truncate">{place}</span>
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default TournamentCard;
