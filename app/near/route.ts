/**
 * GET /near — geo-IP → nearest static city page (PRD §9.7). Resolves the
 * visitor's edge coordinates to the nearest CITY centroid and 302s to its static
 * page, keeping lat/lng out of indexed URLs. Falls back to the court hub.
 */
import { NextResponse, type NextRequest } from "next/server";
import { nearestCityFromHeaders } from "@/lib/geo/geoip";
import { cityUrl } from "@/lib/urls";

export async function GET(req: NextRequest) {
  const city = await nearestCityFromHeaders(req.headers);
  const path = city ? cityUrl(city) : "/courts";
  return NextResponse.redirect(new URL(path, req.url));
}
