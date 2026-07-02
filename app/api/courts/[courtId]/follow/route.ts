/**
 * /api/courts/[courtId]/follow — follow / unfollow a court (PRD §6.1).
 *
 * POST   → follow (idempotent).
 * DELETE → unfollow (idempotent).
 *
 * Both require auth; `requireAuth` 401s propagate via `guarded`.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { followCourt, unfollowCourt } from "@/lib/data/follows";
import { guarded } from "@/app/api/_util";

export const dynamic = "force-dynamic";

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
