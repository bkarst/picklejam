/**
 * ads.txt — IAB Authorized Digital Sellers file (PRD §2.2).
 *
 * Not a Next metadata convention, so it's a plain Route Handler at `/ads.txt`
 * (mirrors the style of app/robots.ts). When a publisher id is configured it
 * authorizes Google AdSense as a DIRECT seller; the id is `ca-pub-…` but ads.txt
 * uses the `pub-…` form, so we strip the leading `ca-`. When unset we still serve
 * a valid (comment-only) ads.txt so the crawler gets a 200 text/plain response.
 *
 * `f08c47fec0942fa0` is Google's fixed certification-authority id for AdSense.
 */

import { publicEnv } from "@/lib/env";

const GOOGLE_CERTIFICATION_ID = "f08c47fec0942fa0";

function adsTxtBody(): string {
  const publisherId = publicEnv.adsensePublisherId.trim();
  if (!publisherId) {
    return "# No authorized sellers configured.\n";
  }
  // AdSense ads.txt uses the `pub-…` form (strip the `ca-` prefix).
  const sellerId = publisherId.replace(/^ca-/, "");
  return `google.com, ${sellerId}, DIRECT, ${GOOGLE_CERTIFICATION_ID}\n`;
}

export function GET(): Response {
  return new Response(adsTxtBody(), {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
