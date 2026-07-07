/**
 * GET /api/geo/nearest?lat=&lng= — resolve a coordinate to its nearest discoverable
 * city (§9.7). Powers the finder's "Use my location" affordance: the browser gives
 * us lat/lng, we hand back the nearest `cityKey` + label (never storing coords in a
 * URL). Public read; 400 on bad coords, 404 when no city is near.
 */

import type { NextRequest } from "next/server";
import { nearestCityKey } from "@/lib/data/discover";
import { guarded, bad } from "@/app/api/_util";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { searchParams } = new URL(req.url);
    const lat = Number(searchParams.get("lat"));
    const lng = Number(searchParams.get("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) bad("lat and lng are required");

    const near = await nearestCityKey(lat, lng);
    if (!near) bad("No city found near that location", 404);
    return Response.json(near);
  });
}
