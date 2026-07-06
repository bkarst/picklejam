import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray lockfile in the parent dir confuses Turbopack's root inference; pin it.
  turbopack: { root: import.meta.dirname },
  images: {
    // Court photos (seed source) + Google Places + avatars/OG + user uploads on S3/CloudFront.
    remotePatterns: [
      { protocol: "https", hostname: "cdn.filestackcontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "maps.googleapis.com" },
      { protocol: "https", hostname: "**.googleusercontent.com" },
      // User-uploaded review photos (default virtual-hosted S3 URLs).
      { protocol: "https", hostname: "*.s3.amazonaws.com" },
      { protocol: "https", hostname: "*.s3.*.amazonaws.com" },
      // Optional CDN / custom domain in front of the bucket (set S3_PUBLIC_HOST).
      ...(process.env.S3_PUBLIC_HOST
        ? [{ protocol: "https" as const, hostname: process.env.S3_PUBLIC_HOST }]
        : []),
    ],
  },
  // First-party reverse proxy for PostHog (survives adblock, §2.1). The client
  // SDK points at `/ingest`; consent-gated init means no calls without consent.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      { source: "/ingest/static/:path*", destination: "https://us-assets.i.posthog.com/static/:path*" },
      { source: "/ingest/:path*", destination: "https://us.i.posthog.com/:path*" },
    ];
  },
};

export default nextConfig;
