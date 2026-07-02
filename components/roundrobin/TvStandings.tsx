/**
 * TvStandings — a big, glanceable standings board for a TV / projector at the
 * venue (§6.8: "TV mode"). Oversized type, high contrast, and NO motion (safe for
 * a room full of people and for prefers-reduced-motion). Presentational + server
 * renderable; the public event page swaps to this when `?tv=1`.
 */

import type { JSX } from "react";
import type { Entrant, Standing } from "@/lib/roundrobin/types";

export function TvStandings({
  title,
  standings,
  entrants,
  championId,
  subtitle,
}: {
  title: string;
  standings: Standing[];
  entrants: Entrant[];
  championId?: string | null;
  subtitle?: string;
}): JSX.Element {
  const names = new Map(entrants.map((e) => [e.id, e.name]));
  const rows = standings.slice(0, 16);

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-5xl flex-col px-4 py-8 sm:px-8">
      <div className="mb-6 flex flex-col gap-1 border-b border-border pb-6">
        <h1 className="font-display text-4xl font-bold text-foreground sm:text-6xl">{title}</h1>
        {subtitle && <p className="text-lg text-muted sm:text-2xl">{subtitle}</p>}
      </div>

      {rows.length === 0 ? (
        <p className="text-2xl text-muted">Waiting for the first scores…</p>
      ) : (
        <ol className="flex flex-col gap-2 sm:gap-3">
          {rows.map((s) => {
            const isLeader = championId ? s.entrantId === championId : s.rank === 1;
            return (
              <li
                key={s.entrantId}
                className={`flex items-center gap-4 rounded-2xl px-4 py-3 sm:px-6 sm:py-4 ${
                  isLeader ? "bg-accent/10" : "odd:bg-surface"
                }`}
              >
                <span
                  className={`flex size-12 shrink-0 items-center justify-center rounded-full font-display text-2xl font-bold sm:size-16 sm:text-4xl ${
                    isLeader ? "bg-accent text-accent-foreground" : "bg-surface-secondary text-foreground"
                  }`}
                  aria-label={`Rank ${s.rank}`}
                >
                  {s.rank}
                </span>
                <span className="min-w-0 flex-1 truncate font-display text-2xl font-bold text-foreground sm:text-4xl">
                  {names.get(s.entrantId) ?? s.entrantId}
                  {isLeader && championId && (
                    <span className="ml-2 align-middle text-lg font-semibold text-accent sm:text-2xl">
                      Champion
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-right font-display text-xl tabular-nums text-foreground sm:text-3xl">
                  {s.wins}
                  <span className="text-muted">–</span>
                  {s.losses}
                </span>
                <span className="hidden w-20 shrink-0 text-right text-lg tabular-nums text-muted sm:block sm:text-2xl">
                  {s.pointDiff > 0 ? `+${s.pointDiff}` : s.pointDiff}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
