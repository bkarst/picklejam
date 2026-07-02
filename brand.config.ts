/**
 * brand.config.ts — PickleLoko centralized brand identity (PRD §2.3, HARD REQUIREMENT).
 *
 * Every brand-identity value is defined EXACTLY ONCE here. Every other surface
 * (page metadata, JSON-LD, OG images, header/footer, auth screens, 404/500,
 * Resend emails, legal pages, ads.txt, seed/fixture data) IMPORTS from this file.
 *
 * A hardcoded brand string / hex / asset path found ANYWHERE else is a BUG, not a
 * style nit (enforced by the `no-hardcoded-brand` lint rule + drift test).
 *
 * ── Source of the values ──
 *   Palette + typography come from the designer's brand board
 *   (design/brand-identity-2.jpg / .af). Hex values are the designer's exact swatches.
 *   Dark-mode palette, warning/danger hues, and the numeric scales are DERIVED here
 *   (the board is light-only) and marked with `// derived` — designer may refine.
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
  /** Primary action (Forest). */
  readonly primary: ColorPair;
  /** Secondary / playful CTA (Hot Pink). */
  readonly secondary: ColorPair;
  /** Bright highlight (Lime) — badges, accents, the logo ball. */
  readonly accent: ColorPair;
  /** Positive state (Pickle Green) — also the "skill dot" fill. */
  readonly success: ColorPair;
  readonly warning: ColorPair;
  readonly danger: ColorPair;
  /** Focus ring color. */
  readonly focus: string;
}

// ────────────────────────────────────────────────────────────────────────────
// 1. Raw brand swatches (the designer's named palette — the ONLY place hexes live)
// ────────────────────────────────────────────────────────────────────────────

/** The 7 named brand swatches from the brand board (§03 Color Palette). */
export const palette = {
  forest: "#1E5E3A", // deep green — primary actions, headlines
  pickleGreen: "#3FA35B", // mid green — success, filters, skill dots
  lime: "#BCEF3F", // bright chartreuse — the logo ball, accents
  bubblegum: "#FFB3C7", // soft pink — subtle accents, tints
  hotPink: "#FF6B9D", // vivid pink — the playful secondary CTA
  cream: "#FFF9F2", // warm off-white — the app background
  charcoal: "#222222", // near-black — body text
  white: "#FFFFFF",
} as const;

// Derived neutrals + status hues not on the board (designer may refine). // derived
const warmMuted = "#6B6459"; // derived — low-emphasis text on cream
const warmBorder = "#EAE2D6"; // derived — hairline on cream
const amber = "#F5A524"; // derived — warning
const red = "#E5484D"; // derived — danger

// Dark-mode surfaces (board is light-only). // derived
const inkBg = "#141310"; // derived — warm near-black canvas
const inkSurface = "#1F1D18"; // derived — dark card
const inkBorder = "#332F27"; // derived — dark hairline
const inkMuted = "#A89F91"; // derived — muted on dark

// ────────────────────────────────────────────────────────────────────────────
// 2. Semantic themes (light + dark) — what the app actually consumes
// ────────────────────────────────────────────────────────────────────────────

export const colors: { readonly light: SemanticPalette; readonly dark: SemanticPalette } = {
  light: {
    background: palette.cream,
    foreground: palette.charcoal,
    surface: palette.white,
    surfaceForeground: palette.charcoal,
    muted: warmMuted,
    border: warmBorder,
    primary: { base: palette.forest, foreground: palette.white },
    // Hot Pink with charcoal text: white-on-#FF6B9D fails WCAG AA (~2.3:1); charcoal
    // passes for body/label sizes while staying on-brand. (a11y > literal fidelity, CLAUDE.md)
    secondary: { base: palette.hotPink, foreground: palette.charcoal },
    accent: { base: palette.lime, foreground: palette.forest },
    success: { base: palette.pickleGreen, foreground: palette.white },
    warning: { base: amber, foreground: palette.charcoal },
    danger: { base: red, foreground: palette.white },
    focus: palette.forest,
  },
  dark: {
    background: inkBg,
    foreground: palette.cream,
    surface: inkSurface,
    surfaceForeground: palette.cream,
    muted: inkMuted,
    border: inkBorder,
    // Forest is too dark on ink; use Pickle Green for primary in dark mode. // derived
    primary: { base: palette.pickleGreen, foreground: palette.white },
    secondary: { base: palette.hotPink, foreground: palette.charcoal },
    accent: { base: palette.lime, foreground: palette.forest },
    success: { base: palette.pickleGreen, foreground: palette.white },
    warning: { base: amber, foreground: palette.charcoal },
    danger: { base: red, foreground: palette.white },
    focus: palette.lime,
  },
} as const;

// ────────────────────────────────────────────────────────────────────────────
// 3. Typography
// ────────────────────────────────────────────────────────────────────────────

export const typography = {
  /** Headlines + emphasis (brand board §04). Loaded via next/font. */
  fontDisplay: "Fredoka",
  /** Body copy + UI text. */
  fontBody: "Inter",
  /** Code / tabular. // derived */
  fontMono: "ui-monospace, SFMono-Regular, Menlo, monospace",
  /** CSS var names emitted by next/font (see app/layout.tsx). */
  cssVars: {
    display: "--font-fredoka",
    body: "--font-inter",
    mono: "--font-mono",
  },
  /** Modular type scale (rem). // derived — spec defers exact scale to designer. */
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
// 4. Shape / motion tokens (// derived — spec defers to designer)
// ────────────────────────────────────────────────────────────────────────────

export const shape = {
  /** "Rounded shapes create an approachable vibe" (brand board §07). */
  radius: "0.75rem",
  radiusSm: "0.5rem",
  radiusLg: "1rem",
  radiusFull: "9999px",
} as const;

export const motion = {
  /** Purposeful, quick (HIG deference). All honored under prefers-reduced-motion. */
  fast: "120ms",
  base: "200ms",
  slow: "320ms",
  easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
} as const;

// ────────────────────────────────────────────────────────────────────────────
// 5. Identity
// ────────────────────────────────────────────────────────────────────────────

export const identity = {
  name: "PickleLoko",
  legalName: "PickleLoko, Inc.", // TODO(legal): confirm registered entity name
  /** Product tagline (wordmark lockup). */
  tagline: "Find courts. Find players. Play more.",
  /** Marketing hook (brand board hero). */
  taglineMarketing: "More paddles. More people. More fun.",
  /** One-line positioning (PRD §1). */
  positioning: "Find pickleball near you — then play more of it.",
  description:
    "PickleLoko helps you find pickleball courts, games, and tournaments near you — then check in, meet players, and organize games, round robins, leagues, and ladders.",
  supportEmail: "hello@pickleloko.com", // TODO: confirm mailbox
  socials: {
    twitter: "@pickleloko", // TODO: confirm handles
    instagram: "@pickleloko",
    facebook: "https://www.facebook.com/pickleloko",
  },
} as const;

// ────────────────────────────────────────────────────────────────────────────
// 6. URLs
// ────────────────────────────────────────────────────────────────────────────

/** Canonical site origin. Configurable per-env; falls back to production domain. */
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://pickleloko.com"
).replace(/\/$/, "");

// ────────────────────────────────────────────────────────────────────────────
// 7. Logo system (versioned assets, referenced by a single path each)
// ────────────────────────────────────────────────────────────────────────────

export const logos = {
  /** Full lockup (mark + wordmark). */
  lockup: "/logo.svg",
  /** Icon / mark only (the pickleball). */
  mark: "/ball.svg",
  /** Wordmark only. TODO: export dedicated wordmark asset. */
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
