/**
 * GET /api/tournaments/[id] — a tournament + its divisions + registrations (+
 * bracket) in ONE Query (pattern 18). Public read. 404 if it doesn't exist.
 */

import type { NextRequest } from "next/server";
import { getTournament } from "@/lib/data/tournaments";
import { guarded, bad } from "@/app/api/_util";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return guarded(async () => {
    const { id } = await ctx.params;
    const detail = await getTournament(id);
    if (!detail) bad("Tournament not found", 404);
    // Client shape (lib/api/tournaments.ts `TournamentFull`) names the meta `tournament`.
    return Response.json({
      tournament: detail!.tourney,
      divisions: detail!.divisions,
      registrations: detail!.registrations,
      bracket: detail!.bracket,
    });
  });
}
