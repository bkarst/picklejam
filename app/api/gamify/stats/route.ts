/**
 * GET /api/gamify/stats — the caller's this-month vs last-month personal stats (§G12.6 item 3,
 * §G12.9 "Your stats"). Two month-bounded ledger aggregates: RP · check-in days · matches ·
 * courts visited. `force-dynamic` + no-store so the panel is never a page stale.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { getMyMonthStats } from "@/lib/data/gamify";
import { guarded } from "@/app/api/_util";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const stats = await getMyMonthStats(user.uid);
    return Response.json(stats, { headers: { "Cache-Control": "no-store" } });
  });
}
