/**
 * POST /api/groups/invites/[token]/accept — accept an invite (PRD §6.9).
 *
 * Requires auth. The `[token]` segment is the invite handle `<groupId>.<token>`
 * minted by /api/groups/[id]/invites, so the group is resolved without a separate
 * lookup. A valid, unexpired token makes the caller an ACTIVE member (memberCount++);
 * a missing/expired/malformed token → 400. Returns the (now active) membership row.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { acceptInvite } from "@/lib/data/groups";
import { guarded, bad } from "@/app/api/_util";
import { mapGroupErrors } from "../../../_util";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
): Promise<Response> {
  return guarded(async () => {
    const { token: handle } = await ctx.params;
    const user = await requireAuth(req);

    const dot = handle.indexOf(".");
    if (dot <= 0 || dot === handle.length - 1) bad("Malformed invite token");
    const groupId = handle.slice(0, dot);
    const token = handle.slice(dot + 1);

    const member = await mapGroupErrors(() => acceptInvite(groupId, token, user.uid));
    return Response.json(member);
  });
}
