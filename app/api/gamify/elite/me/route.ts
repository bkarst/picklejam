/**
 * GET /api/gamify/elite/me — the caller's Elite status for the current year (§G12.17). Powers
 * the `/elite` self-nomination CTA (none → "Nominate"; nominated → "You're on the list";
 * approved → "You're Elite"). `force-dynamic` + no-store — status must never be a page stale.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { getMyEliteStatus } from "@/lib/data/gamify-elite";
import { currentEliteYear } from "@/lib/gamify/elite";
import { guarded } from "@/app/api/_util";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const status = await getMyEliteStatus(user.uid, currentEliteYear());
    return Response.json(status, { headers: { "Cache-Control": "no-store" } });
  });
}
