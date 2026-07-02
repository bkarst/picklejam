/**
 * /api/account/checkins — the caller's check-in history (PRD §6.2, §9.5 #6).
 *
 * GET → the caller's check-ins (newest-first) plus a `courts` lookup (name +
 * canonical URL) for the distinct courts referenced, so the "My check-ins" page
 * can link and label without a second round-trip. Requires auth.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { getMyCheckins } from "@/lib/data/checkins";
import { getCourt } from "@/lib/data/courts";
import { courtUrl } from "@/lib/urls";
import { guarded } from "../_util";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const checkins = await getMyCheckins(user.uid);

    const courtIds = [...new Set(checkins.map((c) => c.courtId))];
    const courts: Record<string, { name: string; url: string }> = {};
    await Promise.all(
      courtIds.map(async (id) => {
        const court = await getCourt(id);
        if (court) courts[id] = { name: court.name, url: courtUrl(court) };
      }),
    );

    return Response.json({ checkins, courts });
  });
}
