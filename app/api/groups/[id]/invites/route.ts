/**
 * POST /api/groups/[id]/invites — mint a shareable invite (PRD §6.9, §14.6).
 *
 * Requires auth AND owner/admin (guarded in the data layer → 403). Optional
 * `{ email }` records the intended recipient. Returns `{ invite, url }` where the
 * invite carries `token` + `expiresAt` + `ttl` (DynamoDB TTL sweeps it once it
 * lapses) and `url` is the shareable accept link. The link segment encodes
 * `<groupId>.<token>` so /api/groups/invites/[token]/accept can resolve the group.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { createInvite } from "@/lib/data/groups";
import { guarded, jsonBodyOptional } from "@/app/api/_util";
import { mapGroupErrors } from "../../_util";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return guarded(async () => {
    const { id } = await ctx.params;
    const user = await requireAuth(req);
    const body = await jsonBodyOptional(req);
    const email =
      typeof body.email === "string" && body.email.trim() ? body.email.trim() : undefined;

    const invite = await mapGroupErrors(() =>
      createInvite(id, user.uid, email !== undefined ? { email } : undefined),
    );

    const handle = `${id}.${invite.token}`;
    const url = `${new URL(req.url).origin}/groups/invites/${handle}`;
    return Response.json({ invite, url }, { status: 201 });
  });
}
