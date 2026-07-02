/**
 * POST /api/leagues/[id]/score — report a weekly fixture's score (PRD §7.3, party
 * one). Requires auth (a participant). Sets the score, marks the fixture
 * `reported`, and notifies the opponent to confirm. Body: `{ week, mid, scoreA, scoreB }`.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { reportScore } from "@/lib/data/leagues";
import { guarded, bad, jsonBody } from "@/app/api/_util";
import { reqStr, leagueErr } from "@/app/api/leagues/_util";

export const dynamic = "force-dynamic";

function reqInt(body: Record<string, unknown>, key: string): number {
  const v = body[key];
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
    bad(`${key} must be a non-negative integer`);
  }
  return v as number;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const { id } = await ctx.params;
    const body = await jsonBody(req);

    const week = reqInt(body, "week");
    const mid = reqStr(body, "mid", 200);
    const scoreA = reqInt(body, "scoreA");
    const scoreB = reqInt(body, "scoreB");

    try {
      const match = await reportScore(id, week, mid, user.uid, scoreA, scoreB);
      return Response.json(match, { status: 201 });
    } catch (err) {
      leagueErr(err);
    }
  });
}
