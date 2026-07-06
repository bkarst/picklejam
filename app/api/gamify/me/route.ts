/**
 * GET /api/gamify/me — the caller's gamification view (Gamification PRD §G12.0).
 *
 * Profile + prefs + effective visibility (prefs.enabled AND not-holdout). A deliberate
 * side-effectful GET: it self-heals the stored IANA tz from the `?tz=` the client reads
 * off `Intl.DateTimeFormat().resolvedOptions().timeZone` (§G13.0). `force-dynamic` +
 * no-store so the value is never a page stale.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { getGamifyMe } from "@/lib/data/gamify";
import { guarded } from "@/app/api/_util";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const tz = req.nextUrl.searchParams.get("tz") ?? undefined;
    const view = await getGamifyMe(user.uid, { browserTz: tz });
    return Response.json(view, { headers: { "Cache-Control": "no-store" } });
  });
}
