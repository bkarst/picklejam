/**
 * POST /api/tournaments/[id]/divisions — add a division (PRD §7.1). Requires auth
 * (the organizer). Price is integer minor units (§14.5); capacity + DUPR/skill
 * gate are optional.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { addDivision, getTournamentMeta, type AddDivisionInput } from "@/lib/data/tournaments";
import { guarded, bad, jsonBody } from "@/app/api/_util";
import { reqStr, optNum, optInt, reqPrice, tourneyErr } from "@/app/api/tournaments/_util";

export const dynamic = "force-dynamic";

const GENDERS = ["mens", "womens", "mixed", "open"] as const;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const { id } = await ctx.params;
    const body = await jsonBody(req);

    const tourney = await getTournamentMeta(id);
    if (!tourney) bad("Tournament not found", 404);
    if (tourney!.organizerId !== user.uid) bad("Only the organizer can add divisions", 403);

    const playMode = body.playMode;
    if (playMode !== "singles" && playMode !== "doubles") bad("playMode must be singles or doubles");
    const gender = typeof body.gender === "string" ? body.gender : undefined;
    if (gender !== undefined && !GENDERS.includes(gender as (typeof GENDERS)[number])) {
      bad("Invalid gender");
    }

    const input: AddDivisionInput = {
      name: reqStr(body, "name", 120),
      price: reqPrice(body, tourney!.currency),
      capacity: optInt(body, "capacity"),
      skillMin: optNum(body, "skillMin"),
      skillMax: optNum(body, "skillMax"),
      duprMin: optNum(body, "duprMin"),
      duprMax: optNum(body, "duprMax"),
      playMode: playMode as "singles" | "doubles",
      ...(gender ? { gender: gender as (typeof GENDERS)[number] } : {}),
      ...(typeof body.stripePriceId === "string" ? { stripePriceId: body.stripePriceId } : {}),
    };

    try {
      const division = await addDivision(id, input);
      return Response.json(division, { status: 201 });
    } catch (err) {
      tourneyErr(err);
    }
  });
}
