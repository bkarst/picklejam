/**
 * /sitemap-index.xml — the sitemap INDEX (§3.7): the single submittable entry point.
 *
 * `app/sitemap.ts` uses `generateSitemaps`, so Next 16 serves each segment at
 * `/sitemap/<id>.xml` and emits NO index of its own. We cannot serve the index at
 * the conventional `/sitemap.xml`: Next RESERVES that exact path for the metadata
 * `sitemap.ts` convention even under `generateSitemaps`, and a `route.ts` there is
 * a hard "Conflicting route and metadata" build error — while the metadata file
 * itself can only emit a `<urlset>`, never a `<sitemapindex>`. So the index lives
 * at this sibling path (matching `news-sitemap.xml`); `robots.txt` advertises it
 * and crawlers discover every segment transitively through it.
 *
 * The Google-News sitemap (`/news-sitemap.xml`) is intentionally NOT indexed here
 * (see {@link segmentSitemapUrls}) — it's a separate 48h feed for Google News.
 *
 * The index BODY is static (the segment list is fixed at build), so `force-static`
 * — no per-request work, served straight from the CDN. Segment CONTENTS still
 * refresh independently via each segment route's ISR (`app/sitemap.ts` §revalidate).
 */

import { sitemapIndexXml } from "@/lib/seo/sitemap";

export const dynamic = "force-static";

export async function GET(): Promise<Response> {
  return new Response(sitemapIndexXml(), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
