/**
 * POST /api/tournaments/[id]/cancel — cancel a tournament + MASS-REFUND every paid
 * registration (PRD §10). Organizer-initiated, so the platform application fee is
 * refunded too. Requires auth (the organizer).
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { cancelTournament, getTournamentMeta } from "@/lib/data/tournaments";
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
    if (tourney!.organizerId !== user.uid) bad("Only the organizer can cancel", 403);

    try {
      const result = await cancelTournament(id);
      // Return the cancelled TOURNEY (client `useCancelTournament` reads TourneyItem)
      // with the refund count carried alongside.
      return Response.json({ ...result.tourney, refunded: result.refunded });
    } catch (err) {
      tourneyErr(err);
    }
  });
}
