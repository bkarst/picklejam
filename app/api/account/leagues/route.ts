/**
 * GET /api/account/leagues — the caller's league registrations (§7.2, GSI1). One
 * keyed GSI1 Query (`getMyLeagueRegistrations`) + a BatchGet hydration. Requires auth.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { getMyLeagueRegistrations } from "@/lib/data/leagues";
import { guarded } from "../../_util";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const registrations = await getMyLeagueRegistrations(user.uid);
    return Response.json({ registrations });
  });
}
