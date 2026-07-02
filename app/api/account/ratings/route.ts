/**
 * /api/account/ratings — the caller's skill ratings (PRD §6.3, §9.5 #13).
 *
 * GET    → the caller's ratings.
 * PUT    → upsert a self-entered RATING#<system> ({system, value}); `verified:false`.
 * DELETE → remove one system (?system=).
 *
 * All require auth; `requireAuth` 401s propagate via `guarded`.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import {
  getUserRatings,
  buildRatingItem,
  upsertRating,
  deleteRating,
  isRatingSystem,
} from "@/lib/data/users";
import { guarded, bad, jsonBody } from "../_util";

export const dynamic = "force-dynamic";

/** Sanity bounds spanning every supported system (DUPR ~2–8, UTRP 1–6.5, etc.). */
const MIN_RATING = 0;
const MAX_RATING = 10;

export async function GET(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const ratings = await getUserRatings(user.uid);
    return Response.json({ ratings });
  });
}

export async function PUT(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const body = await jsonBody(req);

    if (!isRatingSystem(body.system)) bad("invalid rating system");
    const value = body.value;
    if (typeof value !== "number" || !Number.isFinite(value) || value <= MIN_RATING || value > MAX_RATING) {
      bad(`value must be a number in (${MIN_RATING}, ${MAX_RATING}]`);
    }

    const item = buildRatingItem({
      uid: user.uid,
      system: body.system,
      value: value as number,
      verified: false, // self-entered
      source: "self",
    });
    await upsertRating(item);
    return Response.json(item);
  });
}

export async function DELETE(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const system = req.nextUrl.searchParams.get("system");
    if (!isRatingSystem(system)) bad("invalid rating system");
    await deleteRating(user.uid, system);
    return Response.json({ ok: true });
  });
}
