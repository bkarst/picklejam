/**
 * POST /api/leagues/[id]/availability — set the caller's weekly availability /
 * sub-pool flag (PRD §7.2). Requires auth. Body: `{ week, status: in|out|sub, note? }`.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { setAvailability } from "@/lib/data/leagues";
import { guarded, bad, jsonBody } from "@/app/api/_util";
import { optStr, leagueErr } from "@/app/api/leagues/_util";
import type { AvailabilityStatus } from "@/lib/db/types";

export const dynamic = "force-dynamic";

const STATUSES: AvailabilityStatus[] = ["in", "out", "sub"];

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
    const status = body.status;
    if (!STATUSES.includes(status as AvailabilityStatus)) {
      bad("status must be in, out or sub");
    }

    try {
      const item = await setAvailability(
        id,
        user.uid,
        week as number,
        status as AvailabilityStatus,
        optStr(body, "note", 500),
      );
      return Response.json(item, { status: 201 });
    } catch (err) {
      leagueErr(err);
    }
  });
}
