/**
 * POST /api/leagues/[id]/divisions — add a division / flight (PRD §7.2). Requires
 * auth (the organizer). Price is integer minor units (§14.5); capacity + DUPR/skill
 * gate are optional.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { addLeagueDivision, getLeagueMeta, type AddLeagueDivisionInput } from "@/lib/data/leagues";
import { guarded, bad, jsonBody } from "@/app/api/_util";
import { reqStr, optNum, optInt, reqPrice, leagueErr } from "@/app/api/leagues/_util";

export const dynamic = "force-dynamic";

const PLAY_MODES = ["singles", "doubles", "team"] as const;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const { id } = await ctx.params;
    const body = await jsonBody(req);

    const league = await getLeagueMeta(id);
    if (!league) bad("League not found", 404);
    if (league!.organizerId !== user.uid) bad("Only the organizer can add divisions", 403);

    const playMode = body.playMode;
    if (!PLAY_MODES.includes(playMode as (typeof PLAY_MODES)[number])) {
      bad("playMode must be singles, doubles or team");
    }

    const input: AddLeagueDivisionInput = {
      name: reqStr(body, "name", 120),
      price: reqPrice(body, league!.currency),
      capacity: optInt(body, "capacity"),
      skillMin: optNum(body, "skillMin"),
      skillMax: optNum(body, "skillMax"),
      duprMin: optNum(body, "duprMin"),
      duprMax: optNum(body, "duprMax"),
      playMode: playMode as (typeof PLAY_MODES)[number],
    };

    try {
      const division = await addLeagueDivision(id, input);
      return Response.json(division, { status: 201 });
    } catch (err) {
      leagueErr(err);
    }
  });
}
