/**
 * POST /api/tournaments/[id]/publish — publish a tournament (PRD §7.1, §10).
 * **Connect-gated**: 403 unless the organizer's Connect account is `complete`; 400
 * unless ≥1 division exists. Requires auth (the organizer).
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { publishTournament, getTournamentMeta } from "@/lib/data/tournaments";
import { guarded, bad } from "@/app/api/_util";
import { tourneyErr } from "@/app/api/tournaments/_util";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const { id } = await ctx.params;

    const tourney = await getTournamentMeta(id);
    if (!tourney) bad("Tournament not found", 404);
    if (tourney!.organizerId !== user.uid) bad("Only the organizer can publish", 403);

    try {
      const published = await publishTournament(id);
      return Response.json(published);
    } catch (err) {
      tourneyErr(err);
    }
  });
}
