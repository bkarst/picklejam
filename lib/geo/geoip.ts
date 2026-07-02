/**
 * geoip.ts — geo-IP → nearest static city (PRD §9.7).
 *
 * Resolves a visitor's coordinates to the nearest `CITY#` centroid and returns
 * that city, so "near me" links point at the STATIC city page (no lat/lng in
 * indexed URLs, per robots §3.7). Coordinates come from the platform's edge geo
 * headers (Vercel `x-vercel-ip-*`); when absent (local/dev) callers fall back to
 * a national default. Never places coordinates in a URL.
 */

import type { ReadonlyHeaders } from "next/dist/server/web/spec-extension/adapters/headers";
import { getAllCities } from "@/lib/data/geo";
import { haversineMeters } from "@/lib/geo/geohash";
import type { CityItem } from "@/lib/db/types";

/** Read visitor coordinates from edge geo headers, if present. */
export function coordsFromHeaders(h: ReadonlyHeaders | Headers): { lat: number; lng: number } | null {
  const lat = h.get("x-vercel-ip-latitude");
  const lng = h.get("x-vercel-ip-longitude");
  if (lat && lng) {
    const la = Number(lat);
    const ln = Number(lng);
    if (Number.isFinite(la) && Number.isFinite(ln)) return { lat: la, lng: ln };
  }
  return null;
}

/** Nearest city (by centroid) to a coordinate, within a country. */
export async function nearestCity(
  lat: number,
  lng: number,
  country = "us",
): Promise<CityItem | undefined> {
  const cities = await getAllCities(country);
  let best: CityItem | undefined;
  let bestD = Infinity;
  for (const c of cities) {
    if (c.centroidLat == null || c.centroidLng == null) continue;
    const d = haversineMeters(lat, lng, c.centroidLat, c.centroidLng);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/** Resolve the visitor's nearest city from request headers (or undefined). */
export async function nearestCityFromHeaders(
  h: ReadonlyHeaders | Headers,
  country = "us",
): Promise<CityItem | undefined> {
  const coords = coordsFromHeaders(h);
  if (!coords) return undefined;
  return nearestCity(coords.lat, coords.lng, country);
}
