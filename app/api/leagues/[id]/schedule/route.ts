/**
 * POST /api/leagues/[id]/schedule — generate the weekly round-robin fixtures from
 * the paid roster (PRD §7.2). Requires auth (the organizer). Regenerating
 * overwrites (deterministic per roster).
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { generateSchedule, getLeagueMeta } from "@/lib/data/leagues";
import { guarded, bad } from "@/app/api/_util";
import { leagueErr } from "@/app/api/leagues/_util";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const { id } = await ctx.params;

    const league = await getLeagueMeta(id);
    if (!league) bad("League not found", 404);
    if (league!.organizerId !== user.uid) bad("Only the organizer can generate the schedule", 403);

    try {
      const schedule = await generateSchedule(id);
      return Response.json({ schedule }, { status: 201 });
    } catch (err) {
      leagueErr(err);
    }
  });
}
