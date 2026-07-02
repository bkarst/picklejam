/**
 * POST /api/ladders/[id]/challenges/[cid]/confirm — confirm a reported result (PRD
 * §7.4). Requires auth (the participant who did NOT report). Both-confirm finalizes
 * the match and re-ranks the ladder.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { confirmChallengeResult } from "@/lib/data/ladders";
import { guarded } from "@/app/api/_util";
import { ladderErr } from "@/app/api/ladders/_util";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; cid: string }> },
): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const { id, cid } = await ctx.params;

    try {
      const challenge = await confirmChallengeResult(id, cid, user.uid);
      return Response.json(challenge);
    } catch (err) {
      ladderErr(err);
    }
  });
}
