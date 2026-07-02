/**
 * GET /api/search?q=… — typeahead suggestions (PLACES + COURTS, §6.1).
 * Read-only, cached lists; disallowed from crawling via robots (/api/).
 */
import type { NextRequest } from "next/server";
import { suggestSearch } from "@/lib/search/suggest";

export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const results = await suggestSearch(q);
  return Response.json(results, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
