/**
 * POST /api/tournaments/[id]/register — register for a division (PRD §7.1, §10).
 * Requires auth (the registrant). Claims a capacity spot (never oversell), starts
 * a destination-charge Checkout, and returns `{ checkoutUrl, regKey }` for the
 * client to redirect to Stripe. Full division → 409 (or a waitlist hold when
 * `waitlist: true`). DUPR/skill gate → 403.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { registerForDivision, type RegisterOptions } from "@/lib/data/tournaments";
import { guarded, jsonBody } from "@/app/api/_util";
import { reqStr, optNum, tourneyErr } from "@/app/api/tournaments/_util";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const { id } = await ctx.params;
    const body = await jsonBody(req);

    // Client sends `did`; also accept `divisionId` for symmetry with the data layer.
    const did = reqStr(
      { did: body.did ?? body.divisionId },
      "did",
      200,
    );
    const opts: RegisterOptions = {
      ...(typeof body.partnerUid === "string" && body.partnerUid ? { partnerUid: body.partnerUid } : {}),
      dupr: optNum(body, "dupr"),
      skill: optNum(body, "skill"),
      ...(body.waitlist === true ? { waitlist: true } : {}),
      ...(user.email ? { customerEmail: user.email } : {}),
    };

    try {
      const result = await registerForDivision(id, did, user.uid, opts);
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
      tourneyErr(err);
    }
  });
}
