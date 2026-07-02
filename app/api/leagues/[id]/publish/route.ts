/**
 * POST /api/leagues/[id]/publish — publish a league (PRD §7.2, §10). Requires auth
 * (the organizer). Connect-gated: the server enforces a `complete` Connect account
 * + ≥1 division and projects the discovery keys (GSI2/GSI3).
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { publishLeague, getLeagueMeta } from "@/lib/data/leagues";
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
    if (league!.organizerId !== user.uid) bad("Only the organizer can publish", 403);

    try {
      const published = await publishLeague(id);
      return Response.json(published);
    } catch (err) {
      leagueErr(err);
    }
  });
}
