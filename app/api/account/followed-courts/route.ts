/**
 * /api/account/followed-courts — the caller's followed courts (PRD §6.1, §9.5).
 *
 * GET → the caller's court follows, each hydrated with the court's name, city,
 * canonical URL, and rating summary (via `getCourt`) so the "Saved courts" page
 * can render + link without a second round-trip. Requires auth.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { getFollowedCourts } from "@/lib/data/follows";
import { getCourt } from "@/lib/data/courts";
import { courtUrl } from "@/lib/urls";
import { guarded } from "../_util";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const follows = await getFollowedCourts(user.uid);

    const hydrated = await Promise.all(
      follows.map(async (f) => {
        const court = await getCourt(f.courtId);
        if (!court) return null;
        return {
          courtId: court.courtId,
          name: court.name,
          url: courtUrl(court),
          cityKey: court.cityKey,
          totalCourts: court.totalCourts,
          ratingAvg: court.ratingAvg ?? 0,
          reviewCount: court.reviewCount ?? 0,
          followedAt: f.createdAt,
        };
      }),
    );

    const courts = hydrated.filter((c): c is NonNullable<typeof c> => c !== null);
    return Response.json({ courts });
  });
}
