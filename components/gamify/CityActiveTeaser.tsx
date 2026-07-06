/**
 * CityActiveTeaser — the "Most active this month" city-directory module (§G12.8-I2). Top-3
 * of the city RP board (server-rendered from `RANK#` rows), compact for the narrow aside,
 * linking to the full city leaderboard. The parent hides it below 3 ranked players.
 */

import Link from "next/link";
import { LevelChip } from "./LevelChip";
import { GamifyAvatar } from "./GamifyAvatar";
import type { LbRankItem } from "@/lib/db/types";

export function CityActiveTeaser({ board, cityName, leaderboardHref }: { board: LbRankItem[]; cityName: string; leaderboardHref: string }) {
  const top = board.slice(0, 3);
  return (
    <section className="rounded-2xl border border-border bg-surface p-4" aria-labelledby="city-active-heading">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="city-active-heading" className="font-display text-lg font-bold text-foreground">Most active this month</h2>
        <Link href={leaderboardHref} className="text-sm font-semibold text-accent hover:underline">Full →</Link>
      </div>
      <ol className="mt-3 flex flex-col gap-3">
        {top.map((r) => (
          <li key={r.rank} className="flex items-center gap-2.5">
            <span className="w-4 shrink-0 text-sm font-semibold tabular-nums text-muted">{r.rank}</span>
            <GamifyAvatar name={r.displayName} avatarUrl={r.avatarUrl} className="size-8 shrink-0 text-xs" />
            <div className="min-w-0 flex-1">
              {r.username ? (
                <Link href={`/players/${r.username}`} className="block truncate text-sm font-medium text-foreground hover:text-accent hover:underline">
                  {r.displayName}
                </Link>
              ) : (
                <span className="block truncate text-sm font-medium text-foreground">{r.displayName}</span>
              )}
              {r.level != null && <LevelChip level={r.level} size="sm" className="mt-0.5" />}
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{r.value.toLocaleString()}</span>
          </li>
        ))}
      </ol>
      <p className="sr-only">The most active players in {cityName} this month, ranked by Rally Points.</p>
    </section>
  );
}
