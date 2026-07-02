/**
 * UpcomingGamesGrid — a court's Today→+6d week of games (§6.7), for the court
 * detail page. Presentational: the integrator queries `getCourtGames(courtId)`,
 * buckets them into 7 day columns, and passes them in. Each column lists that
 * day's games (time / skill / spots) and offers a "+ add a game" on-ramp linking
 * to the outing wizard prefilled with this court (organizer growth loop).
 */

import type { JSX } from "react";
import Link from "next/link";
import type { OutingItem } from "@/lib/db/types";
import { outingPath } from "@/lib/urls";
import { formatTime, formatSkillRange } from "./format";

export interface UpcomingGamesDay {
  /** ISO date (`2026-07-01`) or `yyyymmdd` for the column. */
  date: string;
  games: OutingItem[];
}

export interface UpcomingGamesGridProps {
  days: UpcomingGamesDay[];
  /** Court id — the "+ add a game" links to `/outings/new?court=<id>`. */
  courtId: string;
}

function parseDate(s: string): Date {
  if (/^\d{8}$/.test(s)) {
    return new Date(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8)));
  }
  // Treat a bare date string as local midnight (avoid a UTC day-shift).
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00` : s;
  return new Date(iso);
}

function isToday(d: Date): boolean {
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function AddGameLink({ courtId, block }: { courtId: string; block?: boolean }): JSX.Element {
  const href = `/outings/new?court=${encodeURIComponent(courtId)}`;
  if (block) {
    return (
      <Link
        href={href}
        className="flex flex-1 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border p-3 text-center text-xs font-medium text-muted transition-colors hover:border-accent/50 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        add a game
      </Link>
    );
  }
  return (
    <Link
      href={href}
      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      add a game
    </Link>
  );
}

export function UpcomingGamesGrid({ days, courtId }: UpcomingGamesGridProps): JSX.Element {
  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
      {days.map(({ date, games }) => {
        const d = parseDate(date);
        const today = isToday(d);
        return (
          <div key={date} className="flex min-w-[9rem] flex-1 flex-col gap-2">
            <div
              className={`rounded-lg px-2 py-1 text-center text-xs font-semibold ${
                today ? "bg-accent text-accent-foreground" : "text-muted"
              }`}
            >
              <span className="block">{d.toLocaleDateString("en-US", { weekday: "short" })}</span>
              <span className="font-display text-sm">
                {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </div>

            {games.length === 0 ? (
              <AddGameLink courtId={courtId} block />
            ) : (
              <div className="flex flex-col gap-2">
                {games.map((g) => (
                  <Link
                    key={g.outingId}
                    href={outingPath(g.outingId)}
                    className="flex flex-col gap-0.5 rounded-xl border border-border bg-surface p-2.5 transition-colors hover:border-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    <span className="font-display text-sm font-bold text-foreground">
                      {formatTime(g.startTs, g.tz)}
                    </span>
                    <span className="truncate text-xs text-muted">{g.title}</span>
                    <span className="text-[11px] text-muted">
                      {formatSkillRange(g.skillMin, g.skillMax)}
                      {typeof g.capacity === "number" && g.capacity > 0
                        ? ` · ${g.goingCount ?? 0}/${g.capacity}`
                        : ""}
                    </span>
                  </Link>
                ))}
                <AddGameLink courtId={courtId} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
