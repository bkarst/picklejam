/**
 * POST /api/ladders/[id]/publish — publish a ladder (PRD §7.4, §10).
 * **Connect-gated**: 403 unless the organizer's Connect account is `complete`.
 * Requires auth (the organizer).
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { publishLadder, getLadderMeta } from "@/lib/data/ladders";
import { guarded, bad } from "@/app/api/_util";
import { ladderErr } from "@/app/api/ladders/_util";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const { id } = await ctx.params;

    const ladder = await getLadderMeta(id);
    if (!ladder) bad("Ladder not found", 404);
    if (ladder!.organizerId !== user.uid) bad("Only the organizer can publish", 403);

    try {
      const published = await publishLadder(id);
      return Response.json(published);
    } catch (err) {
      ladderErr(err);
    }
  });
}
