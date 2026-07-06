/**
 * PATCH /api/gamify/showcase — pin up to 3 badges to the public profile (§G6.3).
 * Optimistic on the client (revert on error); only earned families should be sent, but
 * unknown ids are harmless (the render filters to real families).
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { updateShowcase } from "@/lib/data/gamify";
import { guarded, bad, jsonBody } from "@/app/api/_util";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const body = await jsonBody(req);
    if (!Array.isArray(body.showcase) || !body.showcase.every((s) => typeof s === "string")) {
      bad("showcase must be an array of badge family ids");
    }
    const showcase = await updateShowcase(user.uid, body.showcase as string[]);
    return Response.json({ showcase });
  });
}
