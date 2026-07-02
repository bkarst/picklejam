/**
 * GET /api/courts/near?lat=&lng=&radius= — courts within a radius (GSI4 geohash
 * cover-set, §9.7). Powers the /search map finder's client-side radius query.
 * Disallowed from crawling via robots (/api/).
 */
import type { NextRequest } from "next/server";
import { getCourtsNear } from "@/lib/data/courts";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const lat = Number(p.get("lat"));
  const lng = Number(p.get("lng"));
  const radius = Math.min(Number(p.get("radius")) || 25000, 80000); // cap 80km
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json({ error: "lat and lng required" }, { status: 400 });
  }
  const courts = await getCourtsNear(lat, lng, radius);
  return Response.json({
    courts: courts.map((c) => ({
      courtId: c.courtId,
      name: c.name,
      cityKey: c.cityKey,
      slug: c.slug,
      lat: c.lat,
      lng: c.lng,
      totalCourts: c.totalCourts,
      indoorCourts: c.indoorCourts,
      outdoorCourts: c.outdoorCourts,
      access: c.access,
      lighted: c.lighted,
      distanceMeters: c.distanceMeters,
    })),
  });
}
