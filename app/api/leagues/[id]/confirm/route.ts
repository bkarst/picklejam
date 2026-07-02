/**
 * POST /api/leagues/[id]/confirm — confirm (or dispute) a reported fixture (PRD
 * §7.3, party two). Requires auth (the OTHER participant). Confirms → `confirmed`
 * and re-materializes standings; `agree: false` flags a `conflict` (a mismatch).
 * Body: `{ week, mid, agree? }` (agree defaults to true).
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { confirmScore } from "@/lib/data/leagues";
import { guarded, bad, jsonBody } from "@/app/api/_util";
import { reqStr, leagueErr } from "@/app/api/leagues/_util";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const { id } = await ctx.params;
    const body = await jsonBody(req);

    const week = body.week;
    if (typeof week !== "number" || !Number.isInteger(week) || week < 1) {
      bad("week must be a positive integer");
    }
    const mid = reqStr(body, "mid", 200);
    const agree = body.agree === undefined ? true : body.agree === true;

    try {
      const match = await confirmScore(id, week as number, mid, user.uid, { agree });
      return Response.json(match);
    } catch (err) {
      leagueErr(err);
    }
  });
}
