/**
 * CourtCrewSection — the court-detail "Court Crew" band (§G12.1-I2), server-rendered with a
 * single client island for the viewer's own progress. Sits between the groups rail and the
 * reviews. Check-ins are anonymous (§6.2), so Crew and the month board carry no identity:
 * three parts — (a) a Crew count + anonymous rating dots, or a mechanic-explaining empty
 * state, (b) the authed viewer's crew-progress island, (c) a top-5 month-board teaser
 * linking to the full leaderboard (hidden when there are no tallies).
 */

import Link from "next/link";
import { BoardTable } from "./BoardTable";
import { AnonPlayerDot, anonPlayerLabel } from "./AnonPlayer";
import { CrewProgressIsland } from "./CrewProgressIsland";
import type { CrewMember } from "@/lib/data/gamify-crew";
import type { AnonBoardRow } from "@/lib/data/gamify-boards";

export function CourtCrewSection({
  courtId,
  crew,
  board,
  leaderboardHref,
}: {
  courtId: string;
  crew: CrewMember[];
  board: AnonBoardRow[];
  leaderboardHref: string;
}) {
  const teaser = board.slice(0, 5);
  // Leaderboard (the "This month" board teaser) temporarily hidden on the court
  // page — flip to `true` to bring it back.
  const SHOW_LEADERBOARD = false;

  return (
    <section aria-labelledby="court-crew-heading">
      <h2 id="court-crew-heading" className="font-display text-xl font-bold text-foreground">Court Crew</h2>

      {crew.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="text-sm">
            <span className="font-semibold text-foreground">{crew.length}</span>{" "}
            <span className="text-muted">Crew at this court — 4+ check-in days a month</span>
          </p>
          <ul className="flex items-center -space-x-2" aria-label="Court Crew">
            {crew.map((m) => (
              <li key={m.uid} title={`${anonPlayerLabel(m.rating)} · ${m.days} check-in days`}>
                <AnonPlayerDot rating={m.rating} className="size-8 text-[11px] ring-2 ring-surface" />
                <span className="sr-only">{`${anonPlayerLabel(m.rating)} · ${m.days} check-in days`}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">
          No Crew yet — 4 check-ins in a month makes you Crew of this court.
        </p>
      )}

      <CrewProgressIsland courtId={courtId} />

      {SHOW_LEADERBOARD && teaser.length > 0 && (
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
