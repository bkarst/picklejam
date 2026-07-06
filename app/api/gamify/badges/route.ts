/**
 * GET /api/gamify/badges — the caller's badge collection (Gamification PRD §G6.3/§G12.7).
 *
 * Access pattern 31 (one Query on `BADGE#`) joined with per-family locked-with-progress
 * computed from the profile counters (endowed progress everywhere).
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { getGamifyProfile } from "@/lib/data/gamify";
import { getMyBadges } from "@/lib/data/gamify-badges";
import { emptySnapshot } from "@/lib/gamify/badges";
import { guarded } from "@/app/api/_util";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const profile = await getGamifyProfile(user.uid);
    const snapshot = profile
      ? { ...profile.counters, streakBest: profile.streakBest }
      : emptySnapshot();
    const view = await getMyBadges(user.uid, snapshot, profile?.showcase ?? []);
    return Response.json(view, { headers: { "Cache-Control": "no-store" } });
  });
}
