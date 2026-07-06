/**
 * GET /api/gamify/court/[courtId]/me — the caller's court-scoped gamify state (§G12.1-I2b,
 * §G12.3 item 4). Returns this-month check-in days at the court + Crew status, from the
 * `CRTLB` tallies (the viewer reads their OWN tally even when private/below the RANK cut).
 * `force-dynamic` + no-store — a viewer's own tally must never be a page stale.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { getCourt } from "@/lib/data/courts";
import { getCrewProgress } from "@/lib/data/gamify-crew";
import { courtLocalDay } from "@/lib/directory/court-local-day";
import { guarded, bad } from "@/app/api/_util";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ courtId: string }> }): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const { courtId } = await ctx.params;
    const court = await getCourt(courtId);
    if (!court) bad("Court not found", 404);

    const month = courtLocalDay(court).slice(0, 6);
    const { monthDays, isCrew } = await getCrewProgress(courtId, user.uid, month);
    return Response.json({ month, monthDays, isCrew }, { headers: { "Cache-Control": "no-store" } });
  });
}
