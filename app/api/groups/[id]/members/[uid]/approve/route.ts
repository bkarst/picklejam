/**
 * POST /api/groups/[id]/members/[uid]/approve — approve or decline a pending
 * member (PRD §6.9).
 *
 * Requires auth AND owner/admin (guarded in the data layer → 403). Body
 * `{ decision: "approve" | "decline" }` (default "approve"). Approve moves
 * pending→active (memberCount++); decline removes the pending row.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { approveMember, declineMember } from "@/lib/data/groups";
import { guarded, jsonBodyOptional } from "@/app/api/_util";
import { mapGroupErrors } from "../../../../_util";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; uid: string }> },
): Promise<Response> {
  return guarded(async () => {
    const { id, uid } = await ctx.params;
    const actor = await requireAuth(req);
    const body = await jsonBodyOptional(req);
    const decision = body.decision === "decline" ? "decline" : "approve";

    if (decision === "decline") {
      await mapGroupErrors(() => declineMember(id, actor.uid, uid));
      return Response.json({ ok: true, status: "declined" });
    }
    const member = await mapGroupErrors(() => approveMember(id, actor.uid, uid));
    return Response.json(member);
  });
}
