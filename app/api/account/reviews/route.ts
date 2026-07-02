/**
 * /api/account/reviews — the caller's reviews (PRD §6.4, §9.5 #4-adjacent).
 *
 * GET → the caller's reviews (newest-first) plus a `courts` lookup (name +
 * canonical URL) for the distinct courts referenced, so the "My reviews" page can
 * link and label. Editing/deleting a review goes through the per-court community
 * endpoints (useSubmitReview / useDeleteReview). Requires auth.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { getMyReviews } from "@/lib/data/reviews";
import { getCourt } from "@/lib/data/courts";
import { courtUrl } from "@/lib/urls";
import { guarded } from "../_util";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const reviews = await getMyReviews(user.uid);

    const courtIds = [...new Set(reviews.map((r) => r.courtId))];
    const courts: Record<string, { name: string; url: string }> = {};
    await Promise.all(
      courtIds.map(async (id) => {
        const court = await getCourt(id);
        if (court) courts[id] = { name: court.name, url: courtUrl(court) };
      }),
    );

    return Response.json({ reviews, courts });
  });
}
