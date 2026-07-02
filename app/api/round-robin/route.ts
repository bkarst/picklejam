/**
 * POST /api/round-robin — create a Round-Robin event (PRD §6.8, Stage 5).
 *
 * NO AUTH: this is the anonymous create path. The engine validates the config;
 * the data layer mints an `eventId` + secret `creatorToken` and persists the
 * whole event (best-effort, non-atomic — see lib/data/roundrobin header). The
 * response `{ eventId, creatorToken }` lets the browser score/advance/claim later.
 */

import type { NextRequest } from "next/server";
import { createRrEvent } from "@/lib/data/roundrobin";
import { guarded, jsonBody } from "@/app/api/_util";
import { MAX_TITLE, reqStr, parseConfig, rrErr } from "@/app/api/round-robin/_util";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const body = await jsonBody(req);
    const title = reqStr(body, "title", MAX_TITLE);
    const config = parseConfig(body.config);
    try {
      const result = await createRrEvent({ title, config });
      return Response.json(result, { status: 201 });
    } catch (err) {
      rrErr(err);
    }
  });
}
