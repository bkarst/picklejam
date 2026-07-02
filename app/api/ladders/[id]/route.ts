/**
 * GET /api/ladders/[id] — a ladder + its rungs (rank-ordered) + challenges in ONE
 * Query (pattern 22). Public read. 404 if it doesn't exist.
 */

import type { NextRequest } from "next/server";
import { getLadder } from "@/lib/data/ladders";
import { guarded, bad } from "@/app/api/_util";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return guarded(async () => {
    const { id } = await ctx.params;
    const detail = await getLadder(id);
    if (!detail) bad("Ladder not found", 404);
    return Response.json({
      ladder: detail!.ladder,
      rungs: detail!.rungs,
      challenges: detail!.challenges,
    });
  });
}
