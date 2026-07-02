/**
 * /news-sitemap.xml — the Google-News sitemap (§6.6).
 *
 * DISTINCT from the `news` crawl segment at `/sitemap/news.xml`: Google News only
 * accepts articles from the last 48h and requires a `<news:publication>` block,
 * which `MetadataRoute.Sitemap` can't express — so this is a hand-built XML route.
 * The XML is produced by `newsGoogleSitemapXml()` in `lib/seo/sitemap.ts`.
 *
 * Cached like the News index (ISR 900) so it refreshes as fast as new stories
 * publish, without regenerating per request.
 */

import { newsGoogleSitemapXml } from "@/lib/seo/sitemap";

// Rendered per request (not build-frozen): a Google-News sitemap must reflect the
// last-48h window of live stories, and prerendering it at build would bake an
// empty/stale document. The one keyed Query is cheap; the CDN caches via s-maxage.
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const xml = await newsGoogleSitemapXml();
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=900, stale-while-revalidate=86400",
    },
  });
}
