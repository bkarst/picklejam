/**
 * og.tsx — reusable branded OG-image renderer (PRD §3.3).
 *
 * `renderOgImage()` returns a 1200×630 `ImageResponse` branded with the Pickle Jam
 * palette. A full-bleed photo (`public/background.jpg` — checkerboard paddles on a
 * green court) sits behind a dark gradient scrim so the cream headline + hot-pink
 * eyebrow stay legible. Per-page OG routes (and the default `app/opengraph-image.tsx`)
 * call it. If the photo can't be read, it degrades to a solid court-green canvas.
 *
 * ImageResponse constraints (next-conventions.md §8): flexbox only (no grid),
 * a subset of CSS. Import from `next/og` (NOT `next/server`).
 *
 * TODO(fonts): embed the Archivo Black display font (fetch the .woff/.ttf + pass
 * via the `fonts` option) so the card matches the brand typography. For now we use
 * next/og's built-in default sans — clean, but not on-brand.
 */

import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { brand } from "@/brand.config";

export interface OgImageOptions {
  /** The large headline (required). */
  title: string;
  /** Optional secondary line under the title. */
  subtitle?: string;
  /** Optional small uppercase eyebrow above the title. */
  eyebrow?: string;
}

/**
 * Read + inline the OG background photo ONCE (server-side), memoized across
 * renders. Returns `null` if the file can't be read (e.g. missing, or a non-Node
 * runtime) so OG rendering falls back to a solid canvas instead of crashing.
 */
let cachedBg: string | null | undefined;
function backgroundImageUri(): string | null {
  if (cachedBg !== undefined) return cachedBg;
  try {
    const buf = readFileSync(join(process.cwd(), "public", "background.jpg"));
    cachedBg = `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    cachedBg = null;
  }
  return cachedBg;
}

// Dark gradient scrim: darker at the top (headline) and bottom (brand lockup),
// lighter through the middle so the photo reads. Layered OVER the photo.
const SCRIM =
  "linear-gradient(to bottom, rgba(16,23,19,0.78) 0%, rgba(16,23,19,0.36) 42%, rgba(16,23,19,0.44) 60%, rgba(16,23,19,0.82) 100%)";
const TEXT_SHADOW = "0 2px 14px rgba(0,0,0,0.55)";

export function renderOgImage({ title, subtitle, eyebrow }: OgImageOptions): ImageResponse {
  const { palette, identity, og } = brand;
  const bg = backgroundImageUri();

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          // Court-green fallback tint (shows if the photo can't be read).
          backgroundColor: palette.courtGreen,
          ...(bg
            ? {
                backgroundImage: `${SCRIM}, url(${bg})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : {}),
          color: palette.cream,
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
                textShadow: TEXT_SHADOW,
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
              color: palette.cream,
              textShadow: TEXT_SHADOW,
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
                color: palette.cream,
                textShadow: TEXT_SHADOW,
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
              color: palette.cream,
              marginRight: 20,
              textShadow: TEXT_SHADOW,
            }}
          >
            {identity.name}
          </div>
          <div
            style={{ display: "flex", fontSize: 28, color: palette.cream, textShadow: TEXT_SHADOW }}
          >
            {identity.tagline}
          </div>
        </div>
      </div>
    ),
    { width: og.imageWidth, height: og.imageHeight },
  );
}
