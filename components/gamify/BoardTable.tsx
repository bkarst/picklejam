/**
 * BoardTable — a leaderboard as a native, read-only `<table>` (§G12.0). Per the Stage-5
 * hydration lesson we hand-roll the table rather than use the HeroUI client `Table`, so it
 * server-renders and is JS-off complete. Columns: rank · player (avatar + profile link +
 * `LevelChip sm`) · value · movement vs prior month. Movement never relies on color alone —
 * a ▲/▼ glyph carries the meaning. The viewer's own row is highlighted when `highlightUid`
 * matches. Rows come from `RANK#` projections (public, `leaderboards≠hidden` only).
 */

import Link from "next/link";
import { LevelChip } from "./LevelChip";
import { GamifyAvatar } from "./GamifyAvatar";
import type { LbRankItem } from "@/lib/db/types";

export interface BoardRow {
  rank: number;
  uid: string;
  username?: string;
  displayName: string;
  avatarUrl?: string;
  level?: number;
  value: number;
  movement?: number;
}

/** Project `RANK#` rows to `BoardRow`s (the shared shape every board view renders). */
export function toBoardRows(items: LbRankItem[]): BoardRow[] {
  return items.map((r) => ({
    rank: r.rank,
    uid: r.uid,
    username: r.username,
    displayName: r.displayName,
    avatarUrl: r.avatarUrl,
    level: r.level,
    value: r.value,
    movement: r.movement,
  }));
}

function Movement({ movement }: { movement?: number }) {
  if (movement === undefined) return <span className="text-muted" aria-label="new this month">new</span>;
  if (movement === 0) return <span className="text-muted" aria-label="no change">—</span>;
  const up = movement > 0;
  return (
    <span className={up ? "text-success" : "text-danger"} aria-label={`${up ? "up" : "down"} ${Math.abs(movement)}`}>
      {up ? "▲" : "▼"}
      {Math.abs(movement)}
    </span>
  );
}

export function BoardTable({
  rows,
  valueHeader,
  highlightUid,
  showMovement = true,
}: {
  rows: BoardRow[];
  /** Header for the value column (e.g. "Check-in days", "Rally Points"). */
  valueHeader: string;
  highlightUid?: string;
  showMovement?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th scope="col" className="w-12 py-2 pr-2 font-medium">#</th>
            <th scope="col" className="py-2 pr-2 font-medium">Player</th>
            <th scope="col" className="py-2 pr-2 text-right font-medium">{valueHeader}</th>
            {showMovement && <th scope="col" className="w-16 py-2 text-right font-medium">Move</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const mine = highlightUid && r.uid === highlightUid;
            return (
              <tr key={r.rank} className={`border-b border-border/60 ${mine ? "bg-accent/10" : ""}`}>
                <td className="py-2.5 pr-2 font-semibold tabular-nums text-muted">{r.rank}</td>
                <td className="py-2.5 pr-2">
                  <div className="flex items-center gap-2">
                    <GamifyAvatar name={r.displayName} avatarUrl={r.avatarUrl} className="size-7 shrink-0 text-[10px]" />
                    {r.username ? (
                      <Link href={`/players/${r.username}`} className="truncate font-medium text-foreground hover:text-accent hover:underline">
                        {r.displayName}
                      </Link>
                    ) : (
                      <span className="truncate font-medium text-foreground">{r.displayName}</span>
                    )}
                    {r.level != null && <LevelChip level={r.level} size="sm" className="hidden sm:inline-flex" />}
                  </div>
                </td>
                <td className="py-2.5 pr-2 text-right font-semibold tabular-nums text-foreground">{r.value.toLocaleString()}</td>
                {showMovement && (
                  <td className="py-2.5 text-right tabular-nums">
                    <Movement movement={r.movement} />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
