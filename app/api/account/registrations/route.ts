/**
 * GET /api/account/registrations — the caller's tournament registrations (§7.1,
 * §9.5 #19). One keyed GSI1 Query (`getMyRegistrations`). Requires auth.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { getMyRegistrations } from "@/lib/data/tournaments";
import { guarded } from "../../_util";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const registrations = await getMyRegistrations(user.uid);
    return Response.json({ registrations });
  });
}
