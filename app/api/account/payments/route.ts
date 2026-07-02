/**
 * GET /api/account/payments — the caller's payment receipts (§10). One keyed
 * Query on the user's PAYMENT# rows (`getMyPayments`). Requires auth.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { getMyPayments } from "@/lib/data/payments";
import { guarded } from "../../_util";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const payments = await getMyPayments(user.uid);
    return Response.json({ payments });
  });
}
