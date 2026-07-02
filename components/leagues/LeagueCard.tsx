/**
 * LeagueCard — a league/ladder summary row for the hub + city-finder lists
 * (design 12.3.1). A plain `div` (no HeroUI Card — CLAUDE.md) wrapping a full-card
 * link with a hover state. Reused for BOTH leagues and ladders via `kind` (the
 * icon + a11y label differ). Prices go through {@link formatMoney}; every extra
 * (price / spots) is optional so a bare finder item still renders cleanly.
 *
 * Responsive: stacks on phones, becomes a row on ≥sm. The status pill and the
 * "Registering/Draft" label never rely on color alone (text label included).
 */

import type { JSX } from "react";
import Link from "next/link";
import { formatMoney, type Money } from "@/lib/money";
import type { LeagueStatus } from "@/lib/db/types";
import { statusMeta } from "./format";

function TeamIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="size-5 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function LadderIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="size-5 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 3v18M17 3v18M7 7h10M7 12h10M7 17h10" />
    </svg>
  );
}

export interface LeagueCardProps {
  href: string;
  title: string;
  status: LeagueStatus;
  kind: "league" | "ladder";
  /** e.g. "May 12 – Jun 30, 2025" or "Starts May 5 · Ongoing". */
  dateLabel: string;
  /** e.g. "8 weeks · Doubles · Skill 3.0–4.5". */
  meta?: string;
  /** e.g. "Zilker Pickleball Club · Austin, TX". */
  place?: string;
  priceFrom?: Money;
  /** e.g. "24 / 32 spots left". */
  spotsText?: string;
}

export function LeagueCard({
  href,
  title,
  status,
  kind,
  dateLabel,
  meta,
  place,
  priceFrom,
  spotsText,
}: LeagueCardProps): JSX.Element {
  const s = statusMeta(status);
  return (
    <Link
      href={href}
      className="group flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-accent/50 hover:bg-surface-secondary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          {kind === "ladder" ? <LadderIcon /> : <TeamIcon />}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.tone}`}>{s.label}</span>
            <span className="text-xs font-medium uppercase tracking-wide text-muted">
              {kind === "ladder" ? "Ladder" : "League"}
            </span>
          </div>
          <h3 className="mt-1 truncate font-display text-lg font-bold text-foreground group-hover:text-accent">
            {title}
          </h3>
          <p className="mt-0.5 text-sm text-muted">
            {dateLabel}
            {meta ? ` · ${meta}` : ""}
          </p>
          {place && (
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
              <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              <span className="truncate">{place}</span>
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center">
        <div className="text-left sm:text-right">
          {priceFrom && (
            <p className="text-sm text-muted">
              from{" "}
              <span className="font-display text-base font-bold text-foreground">{formatMoney(priceFrom)}</span>
            </p>
          )}
          {spotsText && <p className="text-xs text-muted">{spotsText}</p>}
        </div>
        <span className="inline-flex h-9 items-center rounded-full border border-accent px-4 text-sm font-semibold text-accent transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
          {kind === "ladder" ? "View ladder" : "View league"}
        </span>
      </div>
    </Link>
  );
}

export default LeagueCard;
