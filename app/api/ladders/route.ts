/**
 * POST /api/ladders — create a DRAFT ladder (PRD §7.4). Requires auth; the caller
 * becomes the organizer. The ladder is not publicly discoverable until `publish`
 * (Connect-gated). The public finder/detail read from the SSG layer, not here.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { createLadder, type CreateLadderInput } from "@/lib/data/ladders";
import { guarded, bad, jsonBody } from "@/app/api/_util";
import { MAX_TITLE, MAX_DESC, reqStr, optStr, optInt, reqPrice, ladderErr } from "@/app/api/ladders/_util";
import type { FeeMode } from "@/lib/money";

export const dynamic = "force-dynamic";

const FEE_MODES: FeeMode[] = ["absorb", "passThrough"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const body = await jsonBody(req);

    const title = reqStr(body, "title", MAX_TITLE);
    const cityKey = reqStr(body, "cityKey", 200);
    const startDate = reqStr(body, "startDate", 10);
    if (!DATE_RE.test(startDate)) bad("startDate must be yyyy-mm-dd");

    const feeMode = body.feeMode === undefined ? undefined : (body.feeMode as FeeMode);
    if (feeMode !== undefined && !FEE_MODES.includes(feeMode)) bad("Invalid feeMode");
    const playMode = body.playMode === undefined ? undefined : body.playMode;
    if (playMode !== undefined && playMode !== "singles" && playMode !== "doubles") {
      bad("playMode must be singles or doubles");
    }

    const currency = optStr(body, "currency", 8) ?? "usd";
    const input: CreateLadderInput = {
      organizerId: user.uid,
      title,
      cityKey,
      startDate,
      courtId: optStr(body, "courtId", 200),
      venueName: optStr(body, "venueName", 200),
      description: optStr(body, "description", MAX_DESC),
      currency,
      feeMode,
      feePercentBps: optInt(body, "feePercentBps"),
      feeFixed: optInt(body, "feeFixed"),
      ...(body.price !== undefined ? { price: reqPrice(body, currency) } : {}),
      challengeRange: optInt(body, "challengeRange"),
      responseWindowDays: optInt(body, "responseWindowDays"),
      ...(playMode ? { playMode: playMode as "singles" | "doubles" } : {}),
    };

    try {
      const ladder = await createLadder(input);
      return Response.json(ladder, { status: 201 });
    } catch (err) {
      ladderErr(err);
    }
  });
}
