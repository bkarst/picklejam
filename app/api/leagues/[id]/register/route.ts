/**
 * POST /api/leagues/[id]/register — register for a division (PRD §7.2, §10).
 * Requires auth (the registrant). Claims a capacity spot (never oversell), starts a
 * destination-charge Checkout, and returns `{ checkoutUrl, regKey }` for the client
 * to redirect to Stripe. Full division → 409. DUPR/skill gate → 403. Supports
 * team / doubles-partner (partner-pending) / free-agent solo entries.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { registerForLeague, type LeagueRegisterOptions } from "@/lib/data/leagues";
import { guarded, bad, jsonBody } from "@/app/api/_util";
import { publicEnv } from "@/lib/env";
import { reqStr, leagueErr } from "@/app/api/leagues/_util";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return guarded(async () => {
    if (!publicEnv.paidEventsEnabled) bad("Paid events are not available", 404);
    const user = await requireAuth(req);
    const { id } = await ctx.params;
    const body = await jsonBody(req);

    // Client sends `did`; also accept `divisionId` for symmetry with the data layer.
    const did = reqStr({ did: body.did ?? body.divisionId }, "did", 200);
    // NB: any `dupr`/`skill` in the body is IGNORED — the division rating gate is
    // resolved server-side from the caller's stored RATING# rows (see registerForLeague),
    // so a forged rating in the request can't unlock an ineligible division.
    const opts: LeagueRegisterOptions = {
      ...(typeof body.teamId === "string" && body.teamId ? { teamId: body.teamId } : {}),
      ...(typeof body.partnerUid === "string" && body.partnerUid
        ? { partnerUid: body.partnerUid }
        : {}),
      ...(body.freeAgent === true ? { freeAgent: true } : {}),
      ...(user.email ? { customerEmail: user.email } : {}),
    };

    try {
      const result = await registerForLeague(id, did, user.uid, opts);
      return Response.json(
        {
          checkoutUrl: result.checkoutUrl,
          regKey: result.regKey,
          status: result.status,
          registration: result.registration,
        },
        { status: 201 },
      );
    } catch (err) {
      leagueErr(err);
    }
  });
}
