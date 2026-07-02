/**
 * POST /api/account/ratings/dupr — DUPR read-only "connect" (PRD §13, decision 9).
 *
 * STUB: DUPR is read-only for v1 — we never write ratings back to DUPR, and there
 * is NO live DUPR call here. Real DUPR OAuth + a rating pull is a PARTNERSHIP TODO
 * (§13 decision 9); this endpoint just records a verified RATING#DUPR from the
 * `{duprId, value}` the client supplies (later replaced by the OAuth'd fetch).
 *
 * Requires auth; `requireAuth` 401s propagate via `guarded`.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { buildRatingItem, upsertRating } from "@/lib/data/users";
import { guarded, bad, jsonBody } from "../../_util";

export const dynamic = "force-dynamic";

const MIN_RATING = 0;
const MAX_RATING = 10;

export async function POST(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const body = await jsonBody(req);

    const duprId = body.duprId;
    if (typeof duprId !== "string" || !duprId.trim()) bad("duprId required");
    const value = body.value;
    if (typeof value !== "number" || !Number.isFinite(value) || value <= MIN_RATING || value > MAX_RATING) {
      bad(`value must be a number in (${MIN_RATING}, ${MAX_RATING}]`);
    }

    // TODO(partnership): replace with a real DUPR OAuth connect + rating pull.
    // No external API is called here (§13 decision 9 — DUPR is read-only for v1).
    const item = buildRatingItem({
      uid: user.uid,
      system: "DUPR",
      value: value as number,
      verified: true, // sourced from DUPR
      source: "dupr",
    });
    await upsertRating(item);
    return Response.json(item);
  });
}
