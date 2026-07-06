/**
 * GET /leaderboards — geo-IP → the visitor's nearest city leaderboard (§G12.9 entry). Mirrors
 * `/near`: resolve the visitor's edge coordinates to the nearest CITY centroid and redirect to
 * its leaderboard, keeping lat/lng out of indexed URLs. Falls back to the court hub when geo
 * is unavailable. Per-visitor result → never shared-cached (L16).
 */
import { NextResponse, type NextRequest } from "next/server";
import { nearestCityFromHeaders } from "@/lib/geo/geoip";
import { cityLeaderboardUrl } from "@/lib/urls";

export async function GET(req: NextRequest) {
  const city = await nearestCityFromHeaders(req.headers);
  const path = city ? cityLeaderboardUrl(city) : "/courts";
  const res = NextResponse.redirect(new URL(path, req.url));
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
