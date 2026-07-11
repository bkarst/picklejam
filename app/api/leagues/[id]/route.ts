/**
 * GET /api/leagues/[id] — a league + its divisions + teams + registrations +
 * schedule + standings in ONE Query (pattern 21). Public read. 404 if missing.
 * PATCH /api/leagues/[id] — organizer-only edit (currently the photo). 403 otherwise.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { getLeague, updateLeagueAvatar } from "@/lib/data/leagues";
import { guarded, bad, jsonBody } from "@/app/api/_util";
import { leagueErr } from "@/app/api/leagues/_util";

export const dynamic = "force-dynamic";

/** Read an optional `avatarUrl` (string to set, `null`/"" to clear) or 400. */
function readAvatarUrl(body: Record<string, unknown>): string | null {
  const raw = body.avatarUrl;
  if (raw !== null && typeof raw !== "string") bad("avatarUrl must be a string or null");
  if (typeof raw === "string" && raw.length > 2000) bad("avatarUrl too long");
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return guarded(async () => {
    const { id } = await ctx.params;
    const user = await requireAuth(req);
    const avatarUrl = readAvatarUrl(await jsonBody(req));
    try {
      const league = await updateLeagueAvatar(id, user.uid, avatarUrl);
      return Response.json(league);
    } catch (err) {
      leagueErr(err);
    }
  });
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return guarded(async () => {
    const { id } = await ctx.params;
    const detail = await getLeague(id);
    if (!detail) bad("League not found", 404);
    return Response.json({
      league: detail!.league,
      divisions: detail!.divisions,
      teams: detail!.teams,
      registrations: detail!.registrations,
      schedule: detail!.schedule,
      standings: detail!.standings,
      availability: detail!.availability,
    });
  });
}
