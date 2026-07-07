/**
 * GET /api/courts/near?lat=&lng=&radius= — courts within a radius (GSI4 geohash
 * cover-set, §9.7). Powers the /search map finder's client-side radius query.
 * Disallowed from crawling via robots (/api/).
 */
import type { NextRequest } from "next/server";
import { getCourtsNear, courtFacilityScore } from "@/lib/data/courts";
import { DEFAULT_NEAR_RADIUS_M, MAX_NEAR_RADIUS_M } from "@/lib/geo/constants";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const lat = Number(p.get("lat"));
  const lng = Number(p.get("lng"));
  const radius = Math.min(Number(p.get("radius")) || DEFAULT_NEAR_RADIUS_M, MAX_NEAR_RADIUS_M); // default 15mi, cap 50mi
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json({ error: "lat and lng required" }, { status: 400 });
  }
  const courts = await getCourtsNear(lat, lng, radius);
  return Response.json({
    courts: courts.map((c) => {
      // Prefer the value denormalized at ingest; compute live for any un-backfilled court.
      const facility =
        c.facilityScore != null && c.facilityTier != null
          ? { score: c.facilityScore, tier: c.facilityTier }
          : courtFacilityScore(c);
      return {
      courtId: c.courtId,
      name: c.name,
      cityKey: c.cityKey,
      slug: c.slug,
      lat: c.lat,
      lng: c.lng,
      totalCourts: c.totalCourts,
      indoorCourts: c.indoorCourts,
      outdoorCourts: c.outdoorCourts,
      access: c.access ?? null,
      lighted: Boolean(c.lighted),
      facilityScore: facility.score,
      facilityTier: facility.tier,
      dedicated: Boolean(c.dedicated),
      hasReservations: Boolean(c.hasReservations),
      facilityType: c.facilityType ?? null,
      amenities: c.amenities ?? [],
      surface: c.surface ?? [],
      // Community frontier facets (§G12.10) — the G7.3 exploration frontier.
      reviewCount: c.reviewCount ?? 0,
      hasTrailblazer: Boolean(c.trailblazerUid),
      distanceMeters: c.distanceMeters,
      };
    }),
  });
}
