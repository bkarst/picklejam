/**
 * GET /api/round-robin/[id] — the full event (pattern 16: meta + entrants +
 * rounds + matches + standings) in ONE Query. Public read (no secret token in the
 * payload — `getRrEvent` returns the UI-facing `RrEventMeta`, not the creator
 * token). 404 if the event doesn't exist.
 */

import type { NextRequest } from "next/server";
import { getRrEvent } from "@/lib/data/roundrobin";
import { guarded, bad } from "@/app/api/_util";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return guarded(async () => {
    const { id } = await ctx.params;
    const full = await getRrEvent(id);
    if (!full) bad("Round-robin event not found", 404);
    return Response.json(full);
  });
}
