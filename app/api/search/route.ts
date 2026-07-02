/**
 * GET /api/search?q=…&lat=&lng= — typeahead suggestions (PLACES + COURTS, §6.1).
 * Global name search over the in-process index; `lat`/`lng` (optional) add
 * distance + nearest-first ranking to court results. Disallowed from crawling
 * via robots (/api/).
 */
import type { NextRequest } from "next/server";
import { suggestSearch } from "@/lib/search/suggest";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const q = p.get("q") ?? "";
  // NB: Number(null) === 0, so guard on presence — absent params must be undefined, not (0,0).
  const latRaw = p.get("lat");
  const lngRaw = p.get("lng");
  const lat = latRaw !== null ? Number(latRaw) : NaN;
  const lng = lngRaw !== null ? Number(lngRaw) : NaN;
  const coords = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined;
  const results = await suggestSearch(q, { coords });
  // Per-user (coords vary) → short private cache, not a shared long revalidate.
  return Response.json(results, { headers: { "Cache-Control": "private, max-age=30" } });
}
