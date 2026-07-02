/**
 * og.tsx — reusable branded OG-image renderer (PRD §3.3).
 *
 * `renderOgImage()` returns a 1200×630 `ImageResponse` branded with the
 * PickleLoko palette (cream canvas, forest headline, hot-pink eyebrow, lime
 * ball). Per-page OG routes (and the default `app/opengraph-image.tsx`) call it.
 *
 * ImageResponse constraints (next-conventions.md §8): flexbox only (no grid),
 * a subset of CSS. Import from `next/og` (NOT `next/server`).
 *
 * TODO(fonts): embed the Fredoka display font (fetch the .woff/.ttf + pass via
 * the `fonts` option) so the card matches the brand typography. For now we use
 * next/og's built-in default sans — clean, but not on-brand.
 */

import { ImageResponse } from "next/og";
import { brand } from "@/brand.config";

export interface OgImageOptions {
  /** The large headline (required). */
  title: string;
  /** Optional secondary line under the title. */
  subtitle?: string;
  /** Optional small uppercase eyebrow above the title. */
  eyebrow?: string;
}

export function renderOgImage({ title, subtitle, eyebrow }: OgImageOptions): ImageResponse {
  const { palette, identity, og } = brand;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: palette.cream,
          color: palette.forest,
          padding: 80,
          justifyContent: "space-between",
          fontFamily: "sans-serif",
        }}
      >
        {/* Headline block */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {eyebrow ? (
            <div
              style={{
                display: "flex",
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: 4,
                color: palette.hotPink,
                marginBottom: 24,
              }}
            >
              {eyebrow.toUpperCase()}
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              fontSize: 76,
              fontWeight: 800,
              lineHeight: 1.05,
              color: palette.forest,
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div
              style={{
                display: "flex",
                fontSize: 36,
                marginTop: 24,
                color: palette.charcoal,
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>

        {/* Brand lockup: lime ball + wordmark + tagline */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              width: 56,
              height: 56,
              borderRadius: 9999,
              backgroundColor: palette.lime,
              marginRight: 20,
            }}
          />
          <div
            style={{
              display: "flex",
              fontSize: 40,
              fontWeight: 800,
              color: palette.forest,
              marginRight: 20,
            }}
          >
            {identity.name}
          </div>
          <div style={{ display: "flex", fontSize: 28, color: palette.charcoal }}>
            {identity.tagline}
          </div>
        </div>
      </div>
    ),
    { width: og.imageWidth, height: og.imageHeight },
  );
}
