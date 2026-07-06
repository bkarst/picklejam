/**
 * CourtStatusLine — the court-detail status line (§G12.1-I1): one muted line carrying up to
 * two facts, the current Court Captain (`🏆 June Captain: @maria`) and the Trailblazer
 * (`First check-in: @sam · Mar 2026`). Server-rendered and JS-off complete, from the
 * court-meta denormalized fields (privacy already applied in `getCourtStatus` — a suppressed
 * name arrives as "A player" with no username, so it renders plain and unlinked). Each fact
 * omits independently; renders nothing when both are unset. Wraps to two lines at 390px.
 */

import Link from "next/link";
import { monthName, monthYearLabel } from "@/lib/gamify/time";
import type { CourtStatus, CourtStatusPerson } from "@/lib/data/gamify-crew";

function PersonName({ p }: { p: CourtStatusPerson }) {
  if (p.username) {
    return (
      <Link href={`/players/${p.username}`} className="font-medium text-accent hover:underline">
        {p.displayName}
      </Link>
    );
  }
  return <span className="font-medium text-foreground">{p.displayName}</span>;
}

/** ISO timestamp → `yyyymm` (locale-free). */
function isoMonth(iso: string): string {
  return iso.slice(0, 4) + iso.slice(5, 7);
}

export function CourtStatusLine({ status }: { status: CourtStatus }) {
  if (!status.captain && !status.trailblazer) return null;
  return (
    <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
      {status.captain && (
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true">🏆</span> {monthName(status.captain.month)} Captain: <PersonName p={status.captain} />
        </span>
      )}
      {status.trailblazer && (
        <span className="inline-flex items-center gap-1">
          First check-in: <PersonName p={status.trailblazer} />
          {status.trailblazer.at && <span>· {monthYearLabel(isoMonth(status.trailblazer.at))}</span>}
        </span>
      )}
    </p>
  );
}
