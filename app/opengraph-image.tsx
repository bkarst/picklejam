/**
 * opengraph-image.tsx — the DEFAULT site OG image (file convention, §3.3).
 *
 * Served at `/opengraph-image` and auto-referenced as the site-wide og:image.
 * Renders the branded photo + brand lockup via the shared `renderOgImage` helper.
 * No headline: the wordmark/tagline live in the lockup, and the link preview shows
 * its own title/description, so a top-left headline would just be redundant copy.
 */

import { brand } from "@/brand.config";
import { renderOgImage } from "@/lib/seo/og";

export const alt = `${brand.identity.name} — ${brand.identity.tagline}`;
export const size = { width: brand.og.imageWidth, height: brand.og.imageHeight };
export const contentType = "image/png";

export default async function Image() {
  return renderOgImage({});
}
