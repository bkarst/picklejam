/**
 * GET /api/connect/status — the signed-in organizer's Stripe Connect state (PRD
 * §10). Refreshes the account from Stripe (charges/payouts enabled, details
 * submitted) so the Create-Tournament wizard's publish gate reflects reality.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { refreshConnectStatus } from "@/lib/data/connect";
import { guarded } from "@/app/api/_util";
import type { ConnectStatus } from "@/lib/stripe/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const account = await refreshConnectStatus(user.uid);
    const status: ConnectStatus = account?.status ?? "none";
    return Response.json({
      status,
      accountId: account?.accountId ?? null,
      chargesEnabled: account?.chargesEnabled ?? false,
      payoutsEnabled: account?.payoutsEnabled ?? false,
      detailsSubmitted: account?.detailsSubmitted ?? false,
    });
  });
}
