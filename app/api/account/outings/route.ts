/**
 * GET /api/account/outings — the caller's outings (PRD §6.7).
 *
 * Returns the games they're Hosting and Attending, plus a `courts` lookup (name +
 * canonical URL) for the referenced courts so the "My games" page can link and
 * label without a second round-trip. Requires auth.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { getMyOutings } from "@/lib/data/outings";
import { getCourt } from "@/lib/data/courts";
import { courtUrl } from "@/lib/urls";
import { guarded } from "../_util";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const { hosting, attending } = await getMyOutings(user.uid);
    // The data layer hydrates `attending` as { outing, rsvp }[]; the client list
    // only needs the outings, so flatten to OUTING items for a stable contract.
    const attendingOutings = attending.map((a) => a.outing);

    const courtIds = [...new Set([...hosting, ...attendingOutings].map((o) => o.courtId))];
    const courts: Record<string, { name: string; url: string }> = {};
    await Promise.all(
      courtIds.map(async (id) => {
        const court = await getCourt(id);
        if (court) courts[id] = { name: court.name, url: courtUrl(court) };
      }),
    );

    return Response.json({ hosting, attending: attendingOutings, courts });
  });
}
