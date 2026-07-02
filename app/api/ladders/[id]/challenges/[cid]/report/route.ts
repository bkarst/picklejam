/**
 * POST /api/ladders/[id]/challenges/[cid]/report — report a match result (PRD
 * §7.4). Requires auth (a participant). Body: `{ scoreChallenger, scoreChallenged }`.
 * The higher score wins; the other party must then confirm.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { reportChallengeResult } from "@/lib/data/ladders";
import { guarded, bad, jsonBody } from "@/app/api/_util";
import { ladderErr } from "@/app/api/ladders/_util";

export const dynamic = "force-dynamic";

function reqScore(body: Record<string, unknown>, key: string): number {
  const v = body[key];
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) bad(`${key} must be a non-negative number`);
  return v as number;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; cid: string }> },
): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const { id, cid } = await ctx.params;
    const body = await jsonBody(req);
    const scoreChallenger = reqScore(body, "scoreChallenger");
    const scoreChallenged = reqScore(body, "scoreChallenged");

    try {
      const challenge = await reportChallengeResult(id, cid, user.uid, scoreChallenger, scoreChallenged);
      return Response.json(challenge);
    } catch (err) {
      ladderErr(err);
    }
  });
}
