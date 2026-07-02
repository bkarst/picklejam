/**
 * GET /api/leagues/[id] — a league + its divisions + teams + registrations +
 * schedule + standings in ONE Query (pattern 21). Public read. 404 if missing.
 */

import type { NextRequest } from "next/server";
import { getLeague } from "@/lib/data/leagues";
import { guarded, bad } from "@/app/api/_util";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return guarded(async () => {
    const { id } = await ctx.params;
    const detail = await getLeague(id);
    if (!detail) bad("League not found", 404);
    return Response.json({
      league: detail!.league,
      divisions: detail!.divisions,
      teams: detail!.teams,
      registrations: detail!.registrations,
      schedule: detail!.schedule,
      standings: detail!.standings,
      availability: detail!.availability,
    });
  });
}
