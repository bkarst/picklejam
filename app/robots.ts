/**
 * robots.ts — crawl management (PRD §3.7).
 *
 * Special Route Handler → `MetadataRoute.Robots` (next-conventions.md §9).
 * Allows the directory + content; disallows the exact §3.7 set.
 *
 * §3.7 disallow list = "/api/", "/account/*", "/search?*" (parameterized),
 * "/round-robin/[id]/live", and the Stripe callback/checkout routes:
 *   - "/api/" covers the Stripe webhook ("/api/stripe/...").
 *   - The registration checkout entry/return routes ("/tournaments/[id]/register",
 *     "/leagues/[id]/register", §5) are where the Stripe Checkout hand-off +
 *     return happen — never indexed (§2.2). Add further callback paths here as
 *     Stage 6/7 builds them. "/organize/..." is intentionally NOT disallowed
 *     here (not in the §3.7 list; those pages are noindex via metadata instead).
 * Base `/search` is left crawlable-but-`noindex` (canonical traffic goes to the
 * static city pages); only the infinite parameter space is disallowed.
 *
 * Sitemaps: `app/sitemap.ts` uses `generateSitemaps`, so Next 16 emits each
 * segment at `/sitemap/<id>.xml` and produces NO index of its own.
 * `app/sitemap-index.xml/route.ts` serves a hand-built `<sitemapindex>` over all
 * segments, so we advertise that ONE index URL here (`sitemapIndexUrl()`) — the
 * single submittable entry point; crawlers discover every segment through it.
 * (The index can't sit at `/sitemap.xml`: Next reserves it for the metadata
 * convention, so a route handler there is a "Conflicting route and metadata" error.)
 */

import type { MetadataRoute } from "next";
import { siteUrl } from "@/brand.config";
import { sitemapIndexUrl } from "@/lib/seo/sitemap";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/account/",
        "/og/", // gamification share-card images (§G12.20)
        "/search?*",
        "/round-robin/*/live",
        "/tournaments/*/register",
        "/leagues/*/register",
      ],
    },
    sitemap: sitemapIndexUrl(),
    host: siteUrl,
  };
}
