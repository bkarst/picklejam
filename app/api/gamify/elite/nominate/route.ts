/**
 * POST /api/gamify/elite/nominate — self-nominate for the current Elite year (§G11/§G12.17).
 * Idempotent (a create-only roster row): re-nominating returns the existing status, never
 * a duplicate. The eligibility bar is public and human-reviewed, so nomination is open to any
 * authed user — it enters the queue; approval is the admin gate.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { nominateElite } from "@/lib/data/gamify-elite";
import { currentEliteYear } from "@/lib/gamify/elite";
import { guarded } from "@/app/api/_util";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const year = currentEliteYear();
    const award = await nominateElite(user.uid, year);
    return Response.json({ year, status: award.status }, { headers: { "Cache-Control": "no-store" } });
  });
}
