/**
 * /api/courts/[courtId]/follow — follow / unfollow a court (PRD §6.1).
 *
 * GET    → { following } for the caller (false when signed out — a read probe, not a 401).
 * POST   → follow (idempotent).
 * DELETE → unfollow (idempotent).
 *
 * POST/DELETE require auth; `requireAuth` 401s propagate via `guarded`.
 */

import type { NextRequest } from "next/server";
import { requireAuth, verifyRequest } from "@/lib/auth/verify";
import { followCourt, unfollowCourt, isFollowing } from "@/lib/data/follows";
import { guarded } from "@/app/api/_util";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ courtId: string }> },
): Promise<Response> {
  return guarded(async () => {
    const { courtId } = await ctx.params;
    // Anonymous / invalid token → not following (this is a read probe, so no 401).
    const user = await verifyRequest(req).catch(() => null);
    const following = user ? await isFollowing(user.uid, courtId) : false;
    return Response.json({ following });
  });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ courtId: string }> },
): Promise<Response> {
  return guarded(async () => {
    const { courtId } = await ctx.params;
    const user = await requireAuth(req);
    await followCourt(user.uid, courtId);
    return Response.json({ following: true });
  });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ courtId: string }> },
): Promise<Response> {
  return guarded(async () => {
    const { courtId } = await ctx.params;
    const user = await requireAuth(req);
    await unfollowCourt(user.uid, courtId);
    return Response.json({ following: false });
  });
}
