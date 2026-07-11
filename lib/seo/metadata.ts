/**
 * metadata.ts — the per-page Metadata factory (PRD §3.3).
 *
 * `buildMetadata()` COMPOSES with the root metadata in `app/layout.tsx`
 * (title template, metadataBase, openGraph.siteName, twitter.site) — it only
 * emits the per-page overrides. Because `metadataBase` is already set in the
 * root layout, every URL field here is RELATIVE (the origin is composed in).
 *
 * Title patterns are the §3.3 helpers below; they return the BARE title. The
 * root layout's `title.template` (`%s | Pickle Jam`) appends the brand suffix,
 * so the helpers must NOT include " | Pickle Jam" themselves — §3.3 shows the
 * suffix, but that suffix comes from the template, not from these functions.
 *
 * Follows next-conventions.md §7 (canonical = `alternates.canonical`,
 * hreflang = `alternates.languages`).
 */

import type { Metadata } from "next";
import { brand } from "@/brand.config";
import { noindexRobots } from "./noindex";

/** OpenGraph `type` values used across the app's page classes (§3.4). */
export type OpenGraphType = "website" | "article" | "profile";

/**
 * The default social card. Points at the dynamic OG route rendered by
 * `app/opengraph-image.tsx` (served at `/opengraph-image`). `brand.og.defaultImage`
 * (`/og-default.png`) is the static fallback asset once it is generated.
 */
export const DEFAULT_OG_IMAGE = "/opengraph-image";

export interface BuildMetadataOptions {
  /** Bare page title (no brand suffix — the layout template adds " | Pickle Jam"). */
  title?: string;
  /** Meta description; falls back to the brand default. */
  description?: string;
  /** Canonical path, RELATIVE to the origin (e.g. `/courts/us/ks/lenexa`). Required. */
  path: string;
  /** OG/Twitter image URL (relative ok); defaults to the dynamic OG route. */
  ogImage?: string;
  /** When true, emit `robots: { index:false, follow:false }` (§14.4 thin-content). */
  noindex?: boolean;
  /** Optional keyword metadata. */
  keywords?: string | string[];
  /** OpenGraph object type (default `website`). */
  openGraphType?: OpenGraphType;
}

/**
 * Build a Next `Metadata` object for a single page, composed over the root
 * layout's defaults. See file header for the composition contract.
 */
export function buildMetadata(opts: BuildMetadataOptions): Metadata {
  const {
    title,
    description,
    path,
    ogImage,
    noindex = false,
    keywords,
    openGraphType = "website",
  } = opts;

  const desc = description ?? brand.identity.description;
  const image = ogImage ?? DEFAULT_OG_IMAGE;

  return {
    // Bare title — the root layout `title.template` appends " | Pickle Jam".
    ...(title !== undefined ? { title } : {}),
    description: desc,
    ...(keywords !== undefined ? { keywords } : {}),
    alternates: { canonical: path },
    openGraph: {
      // Discriminated-union `type` requires a cast when the value is a variable.
      type: openGraphType,
      ...(title !== undefined ? { title } : {}),
      description: desc,
      url: path,
      images: [{ url: image }],
    } as Metadata["openGraph"],
    twitter: {
      card: brand.og.twitterCard,
      ...(title !== undefined ? { title } : {}),
      description: desc,
      images: [image],
    },
    // Only override robots when noindexing; otherwise inherit the indexable root.
    ...(noindex ? { robots: noindexRobots() } : {}),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// §3.3 title-pattern helpers — pure functions returning the BARE title.
// The " | Pickle Jam" suffix is added by the root layout's title.template.
// ────────────────────────────────────────────────────────────────────────────

/**
 * Court detail (§3.3): `Play Pickleball at {Court}: Courts, Schedule & Reviews`.
 * `city`/`st` are accepted for signature stability / future disambiguation but
 * are not part of the §3.3 court title pattern.
 */
export function courtTitle(court: string, _city?: string, _st?: string): string {
  return `Play Pickleball at ${court}: Courts, Schedule & Reviews`;
}

/** City directory (§3.3): `{N} Best Pickleball Courts in {City}, {ST}`. */
export function cityTitle(n: number, city: string, st: string): string {
  return `${n} Best Pickleball Courts in ${city}, ${st}`;
}

/** Tournament finder (§3.3): `Pickleball Tournaments in {City}, {ST}`. */
export function tournamentFinderTitle(city: string, st: string): string {
  return `Pickleball Tournaments in ${city}, ${st}`;
}

/** Content/News article (§3.3): `{Title}` (brand suffix from the template). */
export function articleTitle(title: string): string {
  return title;
}
