/**
 * CourtStatusLine — the court-detail status line (§G12.1-I1): one muted line carrying up to
 * two facts, the current Court Captain (`🏆 June Captain: 4.0 player`) and the Trailblazer
 * (`First check-in: 4.0 player · Mar 2026`). Server-rendered and JS-off complete, from the
 * court-meta denormalized fields. Both facts derive from check-ins and check-ins are
 * anonymous (§6.2) — `getCourtStatus` supplies at most a headline rating, never identity,
 * so nothing here links or names. Each fact omits independently; renders nothing when both
 * are unset. Wraps at 390px.
 */

import { monthName, monthYearLabel } from "@/lib/gamify/time";
import { anonPlayerLabel } from "./AnonPlayer";
import type { CourtStatus } from "@/lib/data/gamify-crew";

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
          <span aria-hidden="true">🏆</span> {monthName(status.captain.month)} Captain:{" "}
          <span className="font-medium text-foreground">{anonPlayerLabel(status.captain.rating)}</span>
        </span>
      )}
      {status.trailblazer && (
        <span className="inline-flex items-center gap-1">
          First check-in:{" "}
          <span className="font-medium text-foreground">{anonPlayerLabel(status.trailblazer.rating)}</span>
          {status.trailblazer.at && <span>· {monthYearLabel(isoMonth(status.trailblazer.at))}</span>}
        </span>
      )}
    </p>
  );
}
