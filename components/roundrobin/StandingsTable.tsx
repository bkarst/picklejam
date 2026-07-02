/**
 * StandingsTable — the ranked leaderboard for an event (§6.8, design 11.x).
 *
 * A native semantic `<table>`: fully server-rendered crawlable HTML with no client
 * JS, so the public board hydrates identically (an interactive react-aria grid is
 * unnecessary for a read-only leaderboard and caused a prod hydration mismatch).
 * Accessible via `<th scope>` — the rank column is `col`, the name is the per-row
 * header. Standings are pre-ranked by the engine's tiebreak ladder; the leader is
 * flagged with a trophy icon AND the rank number (never color alone).
 */

import type { JSX } from "react";
import type { Entrant, Standing } from "@/lib/roundrobin/types";

const TH = "px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted";
const TD = "px-3 py-2.5 tabular-nums";

export function StandingsTable({
  standings,
  entrants,
  championId,
  caption = "Standings",
}: {
  standings: Standing[];
  entrants: Entrant[];
  championId?: string | null;
  caption?: string;
}): JSX.Element {
  const names = new Map(entrants.map((e) => [e.id, e.name]));

  if (standings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
        Standings will appear here once the first scores are in.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="bg-surface-secondary/50">
            <th scope="col" className={`w-12 text-left ${TH}`}>#</th>
            <th scope="col" className={`text-left ${TH}`}>
              {caption === "Standings" ? "Player / Team" : caption}
            </th>
            <th scope="col" className={`text-right ${TH}`}>W</th>
            <th scope="col" className={`text-right ${TH}`}>L</th>
            <th scope="col" className={`text-right ${TH}`}>+/−</th>
            <th scope="col" className={`text-right ${TH}`}>GP</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s) => {
            const isLeader = championId ? s.entrantId === championId : s.rank === 1;
            return (
              <tr key={s.entrantId} className={`border-t border-border ${isLeader ? "bg-accent/5" : ""}`}>
                <td className={`text-left font-semibold text-foreground ${TD}`}>{s.rank}</td>
                <th scope="row" className={`text-left font-medium text-foreground ${TD}`}>
                  <span className="flex items-center gap-1.5">
                    {isLeader && (
                      <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Leader">
                        <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3" />
                      </svg>
                    )}
                    <span className="truncate">{names.get(s.entrantId) ?? s.entrantId}</span>
                  </span>
                </th>
                <td className={`text-right text-foreground ${TD}`}>{s.wins}</td>
                <td className={`text-right text-muted ${TD}`}>{s.losses}</td>
                <td className={`text-right text-muted ${TD}`}>
                  {s.pointDiff > 0 ? `+${s.pointDiff}` : s.pointDiff}
                </td>
                <td className={`text-right text-muted ${TD}`}>{s.played}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
