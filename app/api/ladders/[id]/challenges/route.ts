/**
 * POST /api/ladders/[id]/challenges — issue a challenge (PRD §7.4). Requires auth
 * (the challenger). Body: `{ challengedUid }`. The server validates eligibility
 * (target must be above within the ladder's challenge range) and rejects a
 * duplicate active challenge between the pair.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { issueChallenge } from "@/lib/data/ladders";
import { guarded, jsonBody } from "@/app/api/_util";
import { reqStr, ladderErr } from "@/app/api/ladders/_util";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const { id } = await ctx.params;
    const body = await jsonBody(req);
    const challengedUid = reqStr(body, "challengedUid", 200);

    try {
      const challenge = await issueChallenge(id, user.uid, challengedUid);
      return Response.json(challenge, { status: 201 });
    } catch (err) {
      ladderErr(err);
    }
  });
}
