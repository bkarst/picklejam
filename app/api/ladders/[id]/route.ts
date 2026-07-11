/**
 * GET /api/ladders/[id] — a ladder + its rungs (rank-ordered) + challenges in ONE
 * Query (pattern 22). Public read. 404 if it doesn't exist.
 * PATCH /api/ladders/[id] — organizer-only edit (currently the photo). 403 otherwise.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { getLadder, updateLadderAvatar } from "@/lib/data/ladders";
import { guarded, bad, jsonBody } from "@/app/api/_util";
import { ladderErr } from "@/app/api/ladders/_util";

export const dynamic = "force-dynamic";

/** Read an optional `avatarUrl` (string to set, `null`/"" to clear) or 400. */
function readAvatarUrl(body: Record<string, unknown>): string | null {
  const raw = body.avatarUrl;
  if (raw !== null && typeof raw !== "string") bad("avatarUrl must be a string or null");
  if (typeof raw === "string" && raw.length > 2000) bad("avatarUrl too long");
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return guarded(async () => {
    const { id } = await ctx.params;
    const user = await requireAuth(req);
    const avatarUrl = readAvatarUrl(await jsonBody(req));
    try {
      const ladder = await updateLadderAvatar(id, user.uid, avatarUrl);
      return Response.json(ladder);
    } catch (err) {
      ladderErr(err);
    }
  });
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return guarded(async () => {
    const { id } = await ctx.params;
    const detail = await getLadder(id);
    if (!detail) bad("Ladder not found", 404);
    return Response.json({
      ladder: detail!.ladder,
      rungs: detail!.rungs,
      challenges: detail!.challenges,
    });
  });
}
