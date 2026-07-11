/**
 * GET /api/tournaments/[id] — a tournament + its divisions + registrations (+
 * bracket) in ONE Query (pattern 18). Public read. 404 if it doesn't exist.
 * PATCH /api/tournaments/[id] — organizer-only edit (currently the photo). 403 otherwise.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { getTournament, updateTournamentAvatar } from "@/lib/data/tournaments";
import { guarded, bad, jsonBody } from "@/app/api/_util";
import { tourneyErr } from "@/app/api/tournaments/_util";

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
      const tournament = await updateTournamentAvatar(id, user.uid, avatarUrl);
      return Response.json(tournament);
    } catch (err) {
      tourneyErr(err);
    }
  });
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return guarded(async () => {
    const { id } = await ctx.params;
    const detail = await getTournament(id);
    if (!detail) bad("Tournament not found", 404);
    // Client shape (lib/api/tournaments.ts `TournamentFull`) names the meta `tournament`.
    return Response.json({
      tournament: detail!.tourney,
      divisions: detail!.divisions,
      registrations: detail!.registrations,
      bracket: detail!.bracket,
    });
  });
}
