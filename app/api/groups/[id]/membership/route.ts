/**
 * DELETE /api/groups/[id]/membership — the caller leaves a group / cancels a
 * pending request (PRD §6.9).
 *
 * Requires auth. The sole owner can't leave (transfer or delete instead → 403).
 * Leaving an active membership decrements memberCount.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { leaveGroup } from "@/lib/data/groups";
import { guarded } from "@/app/api/_util";
import { mapGroupErrors } from "../../_util";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return guarded(async () => {
    const { id } = await ctx.params;
    const user = await requireAuth(req);
    await mapGroupErrors(() => leaveGroup(id, user.uid));
    return Response.json({ ok: true });
  });
}
