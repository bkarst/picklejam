/**
 * POST /api/connect — start (or resume) Stripe Connect (Express) onboarding for
 * the signed-in organizer (PRD §10). Ensures a Connect account exists, then mints
 * a fresh onboarding link and returns `{ url }` for the client to redirect to.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { getOrCreateConnectAccount, connectOnboardingLink } from "@/lib/data/connect";
import { publicEnv } from "@/lib/env";
import { guarded } from "@/app/api/_util";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    await getOrCreateConnectAccount(user.uid, user.email);
    const { url } = await connectOnboardingLink(user.uid, {
      refreshUrl: `${publicEnv.siteUrl}/organize/connect?refresh=1`,
      returnUrl: `${publicEnv.siteUrl}/organize/connect?return=1`,
    });
    return Response.json({ url });
  });
}
