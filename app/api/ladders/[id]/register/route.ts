/**
 * POST /api/ladders/[id]/register — join a ladder (PRD §7.4, §10). Requires auth
 * (the joining player). Starts a destination-charge Checkout and returns
 * `{ checkoutUrl }` for the client to redirect to Stripe. An optional `rating`
 * DUPR-seeds the player's placement on payment.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { registerForLadder, type RegisterLadderOptions } from "@/lib/data/ladders";
import { guarded, bad, jsonBodyOptional } from "@/app/api/_util";
import { publicEnv } from "@/lib/env";
import { optNum, ladderErr } from "@/app/api/ladders/_util";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return guarded(async () => {
    if (!publicEnv.paidEventsEnabled) bad("Paid events are not available", 404);
    const user = await requireAuth(req);
    const { id } = await ctx.params;
    const body = await jsonBodyOptional(req);

    const opts: RegisterLadderOptions = {
      ...(optNum(body, "rating") !== undefined ? { rating: optNum(body, "rating") } : {}),
      ...(user.email ? { customerEmail: user.email } : {}),
    };

    try {
      const result = await registerForLadder(id, user.uid, opts);
      return Response.json({ checkoutUrl: result.checkoutUrl }, { status: 201 });
    } catch (err) {
      ladderErr(err);
    }
  });
}
