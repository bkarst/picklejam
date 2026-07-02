/**
 * POST /api/groups/[id]/join — join / request to join a group (PRD §6.9).
 *
 * Requires auth. Honours the join policy: open ⇒ active immediately, request ⇒
 * pending (owners/admins notified), invite ⇒ 403 (a token is required). Returns the
 * resulting membership row (its `status` tells the client active vs pending).
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { joinGroup } from "@/lib/data/groups";
import { guarded } from "@/app/api/_util";
import { mapGroupErrors } from "../../_util";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return guarded(async () => {
    const { id } = await ctx.params;
    const user = await requireAuth(req);
    const { member } = await mapGroupErrors(() => joinGroup(id, user.uid));
    return Response.json(member);
  });
}
