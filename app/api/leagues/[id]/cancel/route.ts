/**
 * POST /api/leagues/[id]/cancel — cancel a league (PRD §7.2, §10). Requires auth
 * (the organizer). Mass-refunds every paid registration server-side (organizer
 * cancel ⇒ platform fee refunded too).
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { cancelLeague, getLeagueMeta } from "@/lib/data/leagues";
import { guarded, bad } from "@/app/api/_util";
import { leagueErr } from "@/app/api/leagues/_util";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const { id } = await ctx.params;

    const league = await getLeagueMeta(id);
    if (!league) bad("League not found", 404);
    if (league!.organizerId !== user.uid) bad("Only the organizer can cancel", 403);

    try {
      const result = await cancelLeague(id);
      return Response.json(result.league);
    } catch (err) {
      leagueErr(err);
    }
  });
}
