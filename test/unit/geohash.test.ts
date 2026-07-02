import { describe, it, expect } from "vitest";
import {
  encodeGeohash,
  haversineMeters,
  boundingBox,
  coverSet,
} from "@/lib/geo/geohash";

describe("geohash + cover-set (§9.7)", () => {
  const lat = 38.9728725;
  const lng = -95.2903846; // a Lawrence, KS court from the seed data

  it("encodes to the requested precision", () => {
    expect(encodeGeohash(lat, lng, 9)).toHaveLength(9);
    expect(encodeGeohash(lat, lng, 6)).toBe(encodeGeohash(lat, lng, 9).slice(0, 6));
  });

  it("haversine: zero for identical points, ~correct for a known pair", () => {
    expect(haversineMeters(lat, lng, lat, lng)).toBe(0);
    // Lawrence, KS → Kansas City, MO ≈ 60 km.
    const km = haversineMeters(38.9717, -95.2353, 39.0997, -94.5786) / 1000;
    expect(km).toBeGreaterThan(55);
    expect(km).toBeLessThan(70);
  });

  it("boundingBox contains a point on the radius edge", () => {
    const r = 5000;
    const bb = boundingBox(lat, lng, r);
    expect(bb.minLat).toBeLessThan(lat);
    expect(bb.maxLat).toBeGreaterThan(lat);
    // A point ~4km north should be inside the box.
    const northLat = lat + (4000 / 6_371_000) * (180 / Math.PI);
    expect(northLat).toBeLessThan(bb.maxLat);
  });

  it("coverSet always includes the center cell and covers nearby courts", () => {
    const cells = coverSet(lat, lng, 3000, 6);
    const center = encodeGeohash(lat, lng, 6);
    expect(cells).toContain(center);
    // A court 1km away should fall in a covered cell.
    const nearLat = lat + (1000 / 6_371_000) * (180 / Math.PI);
    const nearCell = encodeGeohash(nearLat, lng, 6);
    expect(cells).toContain(nearCell);
  });

  it("larger radius yields a superset of cells", () => {
    const small = new Set(coverSet(lat, lng, 1000, 6));
    const big = coverSet(lat, lng, 8000, 6);
    for (const c of small) expect(big).toContain(c);
  });
});
