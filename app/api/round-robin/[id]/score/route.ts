/**
 * POST /api/round-robin/[id]/score — record a match score (PRD §6.8, Stage 5).
 *
 * NO AUTH, TOKEN-GATED: the caller proves control with the `X-RR-Token` header
 * (the anonymous creator token) — or a claimed owner's Bearer. The data layer
 * writes the score and re-materializes standings synchronously, returning the
 * fresh full event. Bad token → 403; unknown match/event → 404.
 */

import type { NextRequest } from "next/server";
import { recordScore } from "@/lib/data/roundrobin";
import { guarded, jsonBody } from "@/app/api/_util";
import { reqStr, reqInt, tokenFrom, optionalUid, rrErr } from "@/app/api/round-robin/_util";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return guarded(async () => {
    const { id } = await ctx.params;
    const body = await jsonBody(req);
    const matchId = reqStr(body, "matchId", 100);
    const scoreA = reqInt(body, "scoreA");
    const scoreB = reqInt(body, "scoreB");
    const token = tokenFrom(req, body);
    const uid = await optionalUid(req);
    try {
      const full = await recordScore(id, { matchId, scoreA, scoreB }, { token, uid });
      return Response.json(full);
    } catch (err) {
      rrErr(err);
    }
  });
}
