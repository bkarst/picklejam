/**
 * POST /api/round-robin/[id]/claim — claim an anonymous event for the signed-in
 * user (PRD §6.8, Stage 5). REQUIRES AUTH **and** the creator token: the caller
 * must both be signed in and hold the `X-RR-Token`/`token` proving they created
 * it. Sets `organizerId` + the byOrganizer GSI1 keys so the event appears in
 * /account. Returns the updated `RrEventMeta`. Bad token / already-claimed → 403.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { claimRrEvent } from "@/lib/data/roundrobin";
import { guarded, bad, jsonBody } from "@/app/api/_util";
import { tokenFrom, rrErr } from "@/app/api/round-robin/_util";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return guarded(async () => {
    const { id } = await ctx.params;
    const user = await requireAuth(req);
    const body = await jsonBody(req);
    const token = tokenFrom(req, body);
    if (!token) bad("A creator token is required to claim this event");
    try {
      const meta = await claimRrEvent(id, user.uid, token);
      if (!meta) bad("Round-robin event not found", 404);
      return Response.json(meta);
    } catch (err) {
      rrErr(err);
    }
  });
}
