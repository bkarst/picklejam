/**
 * CourtCrewSection — the court-detail "Court Crew" band (§G12.1-I2), server-rendered with a
 * single client island for the viewer's own progress. Sits between the groups rail and the
 * reviews (local credibility above the reviews it boosts). Three parts: (a) Crew chips or a
 * mechanic-explaining empty state, (b) the authed viewer's crew-progress island, (c) a
 * top-5 month-board teaser linking to the full leaderboard (hidden when there are no tallies).
 */

import Link from "next/link";
import { CrewChip } from "./CrewChip";
import { BoardTable, toBoardRows } from "./BoardTable";
import { CrewProgressIsland } from "./CrewProgressIsland";
import type { CrewMember } from "@/lib/data/gamify-crew";
import type { LbRankItem } from "@/lib/db/types";

export function CourtCrewSection({
  courtId,
  crew,
  board,
  leaderboardHref,
}: {
  courtId: string;
  crew: CrewMember[];
  board: LbRankItem[];
  leaderboardHref: string;
}) {
  const teaser = toBoardRows(board.slice(0, 5));

  return (
    <section aria-labelledby="court-crew-heading">
      <h2 id="court-crew-heading" className="font-display text-xl font-bold text-foreground">Court Crew</h2>

      {crew.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {crew.map((m) => (
            <CrewChip key={m.uid} username={m.username} displayName={m.displayName} avatarUrl={m.avatarUrl} level={m.level} />
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">
          No Crew yet — 4 check-ins in a month makes you Crew of this court.
        </p>
      )}

      <CrewProgressIsland courtId={courtId} />

      {teaser.length > 0 && (
        <div className="mt-6">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-display text-base font-semibold text-foreground">This month</h3>
            <Link href={leaderboardHref} className="text-sm font-semibold text-accent hover:underline">
              Full leaderboard →
            </Link>
          </div>
          <div className="mt-2">
            <BoardTable rows={teaser} valueHeader="Check-in days" showMovement={false} />
          </div>
        </div>
      )}
    </section>
  );
}
