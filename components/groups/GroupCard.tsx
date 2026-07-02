/**
 * GroupCard — a group/club summary row for the finders, rails, and "My groups".
 *
 * A plain `div`/`Link` (no HeroUI Card — CLAUDE.md) wrapping a full-card link with
 * a hover state. Presentational (server-renderable): visibility badge (text label
 * + icon, never color-alone), name, member count, home court / city, and an
 * optional membership pill (for "My groups"). Responsive: stacks on phones,
 * becomes a row on ≥sm.
 */

import type { JSX } from "react";
import Link from "next/link";
import type { GroupVisibility } from "@/lib/db/types";
import { visibilityMeta, memberCountLabel } from "./format";

export interface GroupCardProps {
  href: string;
  name: string;
  visibility: GroupVisibility;
  memberCount: number;
  /** e.g. "Austin, TX". */
  cityLabel?: string;
  /** e.g. "Zilker Pickleball Club" (the group's home court). */
  homeCourtName?: string;
  /** Short description (clamped to one line). */
  description?: string;
  /** Optional membership status pill for "My groups" (e.g. "Owner", "Pending"). */
  membershipLabel?: string;
}

function PeopleIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="size-5 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function LockIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function GlobeIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
    </svg>
  );
}

export function GroupCard({
  href,
  name,
  visibility,
  memberCount,
  cityLabel,
  homeCourtName,
  description,
  membershipLabel,
}: GroupCardProps): JSX.Element {
  const vis = visibilityMeta(visibility);
  const place = homeCourtName && cityLabel ? `${homeCourtName} · ${cityLabel}` : homeCourtName || cityLabel;

  return (
    <Link
      href={href}
      className="group flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-accent/50 hover:bg-surface-secondary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <PeopleIcon />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${vis.tone}`}>
              {visibility === "public" ? <GlobeIcon /> : <LockIcon />}
              {vis.label}
            </span>
            {membershipLabel && (
              <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-foreground">
                {membershipLabel}
              </span>
            )}
          </div>
          <h3 className="mt-1 truncate font-display text-lg font-bold text-foreground group-hover:text-accent">
            {name}
          </h3>
          <p className="mt-0.5 text-sm text-muted">{memberCountLabel(memberCount)}</p>
          {place && (
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
              <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              <span className="truncate">{place}</span>
            </p>
          )}
          {description && <p className="mt-1 line-clamp-1 text-sm text-muted">{description}</p>}
        </div>
      </div>

      <span className="inline-flex h-9 shrink-0 items-center self-start rounded-full border border-accent px-4 text-sm font-semibold text-accent transition-colors group-hover:bg-accent group-hover:text-accent-foreground sm:self-center">
        View group
      </span>
    </Link>
  );
}

export default GroupCard;
