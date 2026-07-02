/**
 * GET /api/account/ladders — the caller's incoming ladder challenges (§7.4). One
 * keyed GSI1 Query (`getMyChallenges`) — challenges where I'm the challenged player,
 * ordered by due date. Requires auth.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { getMyChallenges } from "@/lib/data/ladders";
import { guarded } from "../../_util";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const challenges = await getMyChallenges(user.uid);
    return Response.json({ challenges });
  });
}
