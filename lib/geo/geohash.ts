/**
 * geohash.ts — geohash encoding + radius cover-set (PRD §9.7).
 *
 * GSI4 partitions courts on a 6-char geohash prefix (`GEO#<geohash6>`) with the
 * full 9-char geohash in the sort key. A "near me" radius query computes the
 * covering set of geohash cells over the radius's bounding box, issues one Query
 * per cell (single-partition each — never a scan), then filters the union by
 * precise haversine distance. Directory pages do NOT use this (they're static).
 */

import ngeohash from "ngeohash";

/** Default GSI4 partition precision (6 chars ≈ 1.2km × 0.6km cell). */
export const GEO_PARTITION_PRECISION = 6;
/** Full geohash precision stored in the GSI4 sort key. */
export const GEO_FULL_PRECISION = 9;

const EARTH_RADIUS_M = 6_371_000;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Encode a coordinate to a geohash (default full precision). */
export function encodeGeohash(lat: number, lng: number, precision = GEO_FULL_PRECISION): string {
  return ngeohash.encode(lat, lng, precision);
}

/** Great-circle distance in meters between two coordinates. */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Latitude/longitude bounding box that fully contains a radius (meters). */
export function boundingBox(
  lat: number,
  lng: number,
  radiusMeters: number,
): { minLat: number; minLng: number; maxLat: number; maxLng: number } {
  const latDelta = (radiusMeters / EARTH_RADIUS_M) * (180 / Math.PI);
  // Guard the poles: cos(lat)→0 makes lngDelta blow up.
  const cosLat = Math.max(Math.cos(toRad(lat)), 1e-6);
  const lngDelta = latDelta / cosLat;
  return {
    minLat: Math.max(lat - latDelta, -90),
    maxLat: Math.min(lat + latDelta, 90),
    minLng: Math.max(lng - lngDelta, -180),
    maxLng: Math.min(lng + lngDelta, 180),
  };
}

/**
 * The set of geohash cells (at `precision`) covering a radius — i.e. the GSI4
 * partition prefixes to query. Returns bare geohash prefixes (no `GEO#`); the
 * data layer wraps each with `courtKeys.geoPk`. Always includes the center cell.
 */
export function coverSet(
  lat: number,
  lng: number,
  radiusMeters: number,
  precision = GEO_PARTITION_PRECISION,
): string[] {
  const { minLat, minLng, maxLat, maxLng } = boundingBox(lat, lng, radiusMeters);
  const cells = ngeohash.bboxes(minLat, minLng, maxLat, maxLng, precision);
  const center = ngeohash.encode(lat, lng, precision);
  return Array.from(new Set([center, ...cells]));
}
