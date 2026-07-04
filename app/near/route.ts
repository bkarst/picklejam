/**
 * GET /near — geo-IP → nearest static city page (PRD §9.7). Resolves the
 * visitor's edge coordinates to the nearest CITY centroid and redirects to its
 * static page, keeping lat/lng out of indexed URLs. Falls back to the court hub.
 */
import { NextResponse, type NextRequest } from "next/server";
import { nearestCityFromHeaders } from "@/lib/geo/geoip";
import { cityUrl } from "@/lib/urls";

export async function GET(req: NextRequest) {
  const city = await nearestCityFromHeaders(req.headers);
  const path = city ? cityUrl(city) : "/courts";
  const res = NextResponse.redirect(new URL(path, req.url));
  // This redirect is a PER-VISITOR geo-IP result. A shared cache keyed on `/near` must never
  // store it and replay one visitor's nearest city to everyone else (L16) — `no-store` forbids
  // all caches; `private` is belt-and-braces for any intermediary that honors only that.
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
