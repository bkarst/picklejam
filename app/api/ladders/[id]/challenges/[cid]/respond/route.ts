/**
 * POST /api/ladders/[id]/challenges/[cid]/respond — respond to a challenge (PRD
 * §7.4). Requires auth (the challenged player). Body: `{ accept: boolean }`.
 * Concurrent responses are made safe by a conditional write (409 to the loser).
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { respondChallenge } from "@/lib/data/ladders";
import { guarded, bad, jsonBody } from "@/app/api/_util";
import { ladderErr } from "@/app/api/ladders/_util";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; cid: string }> },
): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const { id, cid } = await ctx.params;
    const body = await jsonBody(req);
    if (typeof body.accept !== "boolean") bad("accept must be a boolean");

    try {
      const challenge = await respondChallenge(id, cid, user.uid, body.accept);
      return Response.json(challenge);
    } catch (err) {
      ladderErr(err);
    }
  });
}
