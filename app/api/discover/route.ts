/**
 * GET /api/discover — the unified "near me" finder for groups / leagues / ladders /
 * tournaments (PRD §6.9/§7.x).
 *
 * Params:
 *   type   (required) one of groups|leagues|ladders|tournaments
 *   cityKey            a `<country>#<state>#<city>` key to search (city + nearby)
 *   lat,lng            when no cityKey, resolve the nearest city from a coordinate
 * At least one of `cityKey` or (`lat`+`lng`) is required.
 *
 * Public read (no auth). Returns `{ cityKey, cityLabel, items }` — each item a
 * unified card enriched with size / avgDupr / gamesLastMonth.
 */

import type { NextRequest } from "next/server";
import { discover, nearestCityKey } from "@/lib/data/discover";
import { guarded, bad } from "@/app/api/_util";
import type { DiscoverEntityType } from "@/lib/search/discover-filters";

export const dynamic = "force-dynamic";

const TYPES: DiscoverEntityType[] = ["groups", "leagues", "ladders", "tournaments"];

export async function GET(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const { searchParams } = new URL(req.url);

    const type = searchParams.get("type");
    if (!type || !TYPES.includes(type as DiscoverEntityType)) {
      bad(`type must be one of: ${TYPES.join(", ")}`);
    }

    let cityKey = searchParams.get("cityKey")?.trim() || null;
    if (!cityKey) {
      const lat = Number(searchParams.get("lat"));
      const lng = Number(searchParams.get("lng"));
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        bad("Provide a cityKey, or lat & lng to resolve the nearest city");
      }
      const near = await nearestCityKey(lat, lng);
      if (!near) bad("No city found near that location", 404);
      cityKey = near!.cityKey;
    }

    const result = await discover(type as DiscoverEntityType, cityKey!);
    return Response.json(result);
  });
}
