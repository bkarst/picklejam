/**
 * brand.config.ts — Pickle Jam centralized brand identity (PRD §2.3, HARD REQUIREMENT).
 *
 * Every brand-identity value is defined EXACTLY ONCE here. Every other surface
 * (page metadata, JSON-LD, OG images, header/footer, auth screens, 404/500,
 * Resend emails, legal pages, ads.txt, seed/fixture data) IMPORTS from this file.
 *
 * A hardcoded brand string / hex / asset path found ANYWHERE else is a BUG, not a
 * style nit (enforced by the `no-hardcoded-brand` lint rule + drift test).
 *
 * ── Source of the values ──
 *   Palette + typography come from the Pickle Jam Brand Identity Guide
 *   (design/Pickle Jam Design System/). Hex values are the guide's exact swatches
 *   (§03 Color Palette). Dark-mode palette, status hues, and the numeric scales are
 *   DERIVED here (the guide is light-only) and marked with `// derived`.
 *
 * Colors are plain hex so they work in both TS consumers and CSS `color-mix`.
 * The Tailwind v4 / HeroUI v3 theme in `app/globals.css` mirrors these values;
 * `test/unit/brand-theme-sync.test.ts` asserts they never drift.
 */

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

/** A semantic color role: a background paired with a legible foreground. */
export interface ColorPair {
  /** The fill / surface color. */
  readonly base: string;
  /** A foreground (text/icon) color that meets contrast on `base`. */
  readonly foreground: string;
}

export interface SemanticPalette {
  /** Page background (app canvas). */
  readonly background: string;
  /** Default text/icon color on `background`. */
  readonly foreground: string;
  /** Non-overlay containers (cards, sections). */
  readonly surface: string;
  readonly surfaceForeground: string;
  /** Low-emphasis text. */
  readonly muted: string;
  /** Hairlines / separators. */
  readonly border: string;
  /** Primary emphasis + "ink" actions (Court Green). */
  readonly primary: ColorPair;
  /** Primary CTA / attention (Hot Pink). */
  readonly secondary: ColorPair;
  /** Bright highlight (Lime) — badges, accents, the logo ball, positive CTAs. */
  readonly accent: ColorPair;
  /** Positive state. */
  readonly success: ColorPair;
  readonly warning: ColorPair;
  readonly danger: ColorPair;
  /** Focus ring color. */
  readonly focus: string;
}

// ────────────────────────────────────────────────────────────────────────────
// 1. Raw brand swatches (the guide's named palette — the ONLY place hexes live)
// ────────────────────────────────────────────────────────────────────────────

/** The named Pickle Jam brand swatches from the Brand Identity Guide (§03). */
export const palette = {
  courtGreen: "#0F3D2E", // dark court green — ink, headlines, dark sections, primary emphasis
  lime: "#C6F045", // electric lime — energy accent, badges, the logo ball, positive CTAs
  hotPink: "#FF4FA3", // hot pink — primary action / attention
  softPink: "#FFD6E6", // soft pink — subtle tints & accent blocks
  cream: "#FFF7E6", // warm off-white — the app background
  gray: "#E6E6E6", // light gray — hairlines / dividers
  ink: "#0A2019", // near-black green — deepest text & the dark-mode canvas
  white: "#FFFFFF",
} as const;

// Derived neutrals + status hues not on the guide (designer may refine). // derived
const mutedLight = "#5C6B64"; // derived — low-emphasis text on cream (AA-safe)
const green800 = "#164B39"; // derived — hover/pressed court green
const success = "#2FA36B"; // derived — positive state (guide §status)
const warning = "#E8A63D"; // derived — warning (guide §status)
const danger = "#E5484D"; // derived — danger

// Dark-mode surfaces (guide is light-only). // derived
const inkSurface = "#12261D"; // derived — dark green card
const inkBorder = "#24403A"; // derived — dark hairline
const inkMuted = "#93A69C"; // derived — muted on dark

// ────────────────────────────────────────────────────────────────────────────
// 2. Semantic themes (light + dark) — what the app actually consumes
// ────────────────────────────────────────────────────────────────────────────

export const colors: { readonly light: SemanticPalette; readonly dark: SemanticPalette } = {
  light: {
    background: palette.cream,
    foreground: palette.courtGreen,
    surface: palette.white,
    surfaceForeground: palette.courtGreen,
    muted: mutedLight,
    border: palette.gray,
    primary: { base: palette.courtGreen, foreground: palette.white },
    // Hot Pink is the signature primary CTA. White on #FF4FA3 is ~3:1 — meets WCAG AA
    // for the large/bold uppercase text the pink is used on (buttons, chips, badges),
    // matching the brand guide's white-on-pink buttons.
    secondary: { base: palette.hotPink, foreground: palette.white },
    accent: { base: palette.lime, foreground: palette.courtGreen },
    success: { base: success, foreground: palette.white },
    warning: { base: warning, foreground: palette.courtGreen },
    danger: { base: danger, foreground: palette.white },
    focus: palette.courtGreen,
  },
  dark: {
    background: palette.ink,
    foreground: palette.cream,
    surface: inkSurface,
    surfaceForeground: palette.cream,
    muted: inkMuted,
    border: inkBorder,
    // Court Green is too dark on the ink canvas; Lime carries primary emphasis in dark. // derived
    primary: { base: palette.lime, foreground: palette.courtGreen },
    secondary: { base: palette.hotPink, foreground: palette.white },
    accent: { base: palette.lime, foreground: palette.courtGreen },
    success: { base: success, foreground: palette.white },
    warning: { base: warning, foreground: palette.courtGreen },
    danger: { base: danger, foreground: palette.white },
    focus: palette.lime,
  },
} as const;

// ────────────────────────────────────────────────────────────────────────────
// 3. Typography
// ────────────────────────────────────────────────────────────────────────────

export const typography = {
  /** Headlines + emphasis (guide §04) — heavy, uppercase. Archivo (variable),
   *  set at Bold (700) for headings; a clear step lighter than the "Black" cut. */
  fontDisplay: "Archivo",
  /** Body copy + UI text (SemiBold subheads, Regular body). */
  fontBody: "Montserrat",
  /** Code / tabular. // derived */
  fontMono: "ui-monospace, SFMono-Regular, Menlo, monospace",
  /** CSS var names emitted by next/font (see app/layout.tsx). */
  cssVars: {
    display: "--font-archivo",
    body: "--font-montserrat",
    mono: "--font-mono",
  },
  /** Modular type scale (rem). // derived from the guide's px scale. */
  scale: {
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem",
    "4xl": "2.25rem",
    "5xl": "3rem",
  },
} as const;

// ────────────────────────────────────────────────────────────────────────────
// 4. Shape / motion tokens (// derived from the guide §06/§07)
// ────────────────────────────────────────────────────────────────────────────

export const shape = {
  /** Generous, rounded, sticker-like corners (guide §06). */
  radius: "0.75rem", // 12px
  radiusSm: "0.5rem", // 8px
  radiusLg: "1.25rem", // 20px
  radiusFull: "9999px",
} as const;

export const motion = {
  /** Quick and springy (guide §motion). All honored under prefers-reduced-motion. */
  fast: "120ms",
  base: "200ms",
  slow: "320ms",
  easing: "cubic-bezier(0.22, 1, 0.36, 1)", // --ease-out
  bounce: "cubic-bezier(0.34, 1.56, 0.64, 1)", // --ease-bounce
} as const;

// ────────────────────────────────────────────────────────────────────────────
// 5. Identity
// ────────────────────────────────────────────────────────────────────────────

export const identity = {
  name: "Pickle Jam",
  legalName: "Pickle Jam, Inc.", // TODO(legal): confirm registered entity name
  /** Product tagline (wordmark lockup). */
  tagline: "Find Pickleball Courts. Form groups. Play more.",
  /** Marketing hook — staccato brand voice, describing what the app actually does.
   *  The homepage eyebrow renders the final sentence in hot pink. */
  taglineMarketing: "Review Pickleball Courts. Form Groups. Get your Pickleball jam on.",
  /** One-line positioning (PRD §1). */
  positioning: "Find pickleball near you — then play more of it.",
  description:
    "Pickle Jam helps you find pickleball courts and organize pickleball groups near you.",
  supportEmail: "support@picklejam.net",
  socials: {
    twitter: "@picklejam", // TODO: confirm handles
    instagram: "@picklejam",
    facebook: "https://www.facebook.com/picklejam",
  },
} as const;

// ────────────────────────────────────────────────────────────────────────────
// 6. URLs
// ────────────────────────────────────────────────────────────────────────────

/** Canonical site origin. Configurable per-env; falls back to production domain. */
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.picklejam.net"
).replace(/\/$/, "");

// ────────────────────────────────────────────────────────────────────────────
// 7. Logo system (versioned assets, referenced by a single path each)
// ────────────────────────────────────────────────────────────────────────────

export const logos = {
  /** Full lockup (net + PICKLE JAM wordmark, sticker outline). */
  lockup: "/logo.svg",
  /** Icon / mark only (the pickleball). */
  mark: "/ball.svg",
  /** Badge mark (lime PJ circle). */
  badge: "/pj-badge.svg",
  /** Wordmark only. The <Logo> component renders this as live two-tone text. */
  wordmark: "/logo.svg",
  /** Monochrome + reversed variants. TODO: export dedicated assets. */
  mono: "/logo.svg",
  reversed: "/logo.svg",
  favicon: "/favicon.ico",
  appIcon: "/icon.png", // TODO: generate 512/192 maskable app icons
} as const;

// ────────────────────────────────────────────────────────────────────────────
// 8. Social / OG defaults (PRD §3.3)
// ────────────────────────────────────────────────────────────────────────────

export const og = {
  /** Default social card (dynamic OG route falls back to this). */
  defaultImage: "/og-default.png", // TODO: generate default OG asset
  imageWidth: 1200,
  imageHeight: 630,
  twitterCard: "summary_large_image" as const,
  fallbackTitle: identity.name,
  fallbackDescription: identity.description,
  locale: "en_US",
} as const;

// ────────────────────────────────────────────────────────────────────────────
// 9. Ads (PRD §2.2) — publisher id is env-driven; ads suppressed unless enabled
// ────────────────────────────────────────────────────────────────────────────

export const ads = {
  adsensePublisherId: process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID ?? "",
  /** Master switch — Stage 10 flips this on. */
  enabled: false,
  maxUnitsPerPage: 3,
} as const;

// ────────────────────────────────────────────────────────────────────────────
// Aggregate export
// ────────────────────────────────────────────────────────────────────────────

export const brand = {
  identity,
  siteUrl,
  palette,
  colors,
  typography,
  shape,
  motion,
  logos,
  og,
  ads,
} as const;

export type Brand = typeof brand;

export default brand;
