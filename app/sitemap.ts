/**
 * sitemap.ts — segmented sitemap route (PRD §3.7).
 *
 * `generateSitemaps` emits one sitemap per registered §3.7 segment plus a
 * `static` segment. Per next-conventions.md §9 (v16 breaking change), the
 * default export's `id` is a **Promise** — await it before use.
 * Output: `/sitemap/<id>.xml` per segment, indexed at `/sitemap.xml`.
 */

import type { MetadataRoute } from "next";
import { sitemapSegments, staticRoutes, type SitemapSegmentId } from "@/lib/seo/sitemap";

// `sitemap.js` is a special Route Handler that is CACHED AT BUILD by default unless it
// opts into a dynamic config option (see next docs, sitemap.md §"Good to know"). Without
// this, every `/sitemap/<id>.xml` would be frozen at deploy time — the `outings` segment
// would advertise only the build day's `today..today+6` window forever, and news /
// tournaments / ladders / leagues / groups would never list anything created after the
// build (M15). ISR-revalidate hourly so crawlers see fresh URLs; the CDN caches between.
export const revalidate = 3600;

const SEGMENT_IDS = Object.keys(sitemapSegments) as SitemapSegmentId[];

export async function generateSitemaps(): Promise<Array<{ id: string }>> {
  return [...SEGMENT_IDS.map((id) => ({ id })), { id: "static" }];
}

export default async function sitemap({
  id,
}: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const resolvedId = await id;
  if (resolvedId === "static") return staticRoutes();

  const segment = sitemapSegments[resolvedId as SitemapSegmentId];
  return segment ? segment.entries() : [];
}
