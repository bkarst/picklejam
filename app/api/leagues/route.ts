/**
 * POST /api/leagues — create a DRAFT league (PRD §7.2). Requires auth; the caller
 * becomes the organizer. Not publicly discoverable until `publish` (Connect-gated).
 * GET the finder from the SSG layer, not here.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { createLeague, type CreateLeagueInput } from "@/lib/data/leagues";
import { guarded, bad, jsonBody } from "@/app/api/_util";
import { publicEnv } from "@/lib/env";
import { MAX_TITLE, MAX_DESC, reqStr, optStr, optInt, leagueErr } from "@/app/api/leagues/_util";
import type { FeeMode } from "@/lib/money";

export const dynamic = "force-dynamic";

const FEE_MODES: FeeMode[] = ["absorb", "passThrough"];
const PLAY_MODES = ["singles", "doubles", "team"] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    if (!publicEnv.paidEventsEnabled) bad("Paid events are not available", 404);
    const user = await requireAuth(req);
    const body = await jsonBody(req);

    const title = reqStr(body, "title", MAX_TITLE);
    const cityKey = reqStr(body, "cityKey", 200);
    const startDate = reqStr(body, "startDate", 10);
    if (!DATE_RE.test(startDate)) bad("startDate must be yyyy-mm-dd");

    const feeMode = body.feeMode === undefined ? undefined : (body.feeMode as FeeMode);
    if (feeMode !== undefined && !FEE_MODES.includes(feeMode)) bad("Invalid feeMode");
    const playMode = body.playMode === undefined ? undefined : body.playMode;
    if (playMode !== undefined && !PLAY_MODES.includes(playMode as (typeof PLAY_MODES)[number])) {
      bad("Invalid playMode");
    }

    const input: CreateLeagueInput = {
      organizerId: user.uid,
      title,
      cityKey,
      startDate,
      endDate: optStr(body, "endDate", 10),
      seasonWeeks: optInt(body, "seasonWeeks"),
      courtId: optStr(body, "courtId", 200),
      venueName: optStr(body, "venueName", 200),
      description: optStr(body, "description", MAX_DESC),
      avatarUrl: optStr(body, "avatarUrl", 2000),
      currency: optStr(body, "currency", 8),
      // Only feeMode is organizer-configurable; the platform fee (PLATFORM_FEE) is
      // server-authoritative, so we intentionally don't read feePercentBps/feeFixed.
      feeMode,
      ...(playMode ? { playMode: playMode as (typeof PLAY_MODES)[number] } : {}),
    };

    try {
      const league = await createLeague(input);
      return Response.json(league, { status: 201 });
    } catch (err) {
      leagueErr(err);
    }
  });
}
