/**
 * POST /api/round-robin/[id]/advance — advance a DYNAMIC event to its next round
 * (PRD §6.8, Stage 5). NO AUTH, TOKEN-GATED (`X-RR-Token`, or a claimed owner's
 * Bearer). Returns `{ round }` — the newly-generated round, or `null` when the
 * event is now complete. 400 on a static event; 403 on a bad token.
 */

import type { NextRequest } from "next/server";
import { advanceRound } from "@/lib/data/roundrobin";
import { guarded, jsonBodyOptional } from "@/app/api/_util";
import { tokenFrom, optionalUid, rrErr } from "@/app/api/round-robin/_util";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return guarded(async () => {
    const { id } = await ctx.params;
    const body = await jsonBodyOptional(req);
    const token = tokenFrom(req, body);
    const uid = await optionalUid(req);
    try {
      const round = await advanceRound(id, { token, uid });
      return Response.json({ round });
    } catch (err) {
      rrErr(err);
    }
  });
}
