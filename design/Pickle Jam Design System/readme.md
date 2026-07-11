# Pickle Jam — Design System

**Pickle Jam** is a pickleball platform: users follow news, highlights and culture, create and join **groups**, run **tournaments**, and **find courts** near them. The brand voice is *"News. Highlights. Culture. All things pickleball."* — fun, fast, and always in the game.

This design system encodes the Pickle Jam brand into tokens, components, and full-screen UI kits so designers and agents can produce on-brand interfaces and marketing artifacts.

## Source
- `uploads/OpenAI Playground 2026-07-02 at 10.42.04.png` — the Pickle Jam **Brand Identity Guide** (logo, wordmark, color palette, typography, icons, illustration style, buttons, and a usage example). This single guide is the ground truth for the entire system. No codebase or Figma file was provided.

---

## Content fundamentals
- **Tone:** energetic, playful, sporty, welcoming. Sports-media meets community club. "We keep it fun, fast, and always in the game."
- **Voice:** first-person plural ("We keep it…") for the brand; second person ("your go-to source") when addressing readers. Confident and upbeat, never stiff.
- **Casing:** headlines and buttons are **ALL-CAPS** (Archivo Black). Body is sentence case. Eyebrows/overlines are uppercase with wide tracking.
- **Copy patterns:** short, punchy fragments. Staccato taglines separated by periods — *"News. Highlights. Culture."* Buttons are terse verbs: **READ MORE**, **VIEW SCORES**, **SUBSCRIBE**, **REGISTER NOW**, **JOIN**.
- **Examples:** headline *"New Champs Crowned in Austin"*; deck *"A thrilling final goes the distance at the PPA Tour Austin Open."*; label *"TOP STORY"*, *"LIVE"*.
- **Emoji:** not used in the brand system. Personality comes from color, type weight, and the pickleball/net motifs — not emoji.

## Visual foundations
- **Colors:** dark **court green** `#0F3D2E` (primary ink & dark sections), **electric lime** `#C6F045` (energy accent, highlights, badges), **hot pink** `#FF4FA3` (primary action / attention). Supporting: **soft pink** `#FFD6E6`, **cream** `#FFF7E6` (warm page surface), **light gray** `#E6E6E6` (borders). The palette is high-energy and high-contrast — green + lime + pink is the signature triad.
- **Typography:** **Archivo Black** for display/headlines (heavy, uppercase, often skewed ~−6° for a sporty "sticker" slant); **Montserrat** for everything else (SemiBold subheads, Regular body). Headlines run tight (line-height ~0.92, slightly negative tracking).
- **Backgrounds:** flat solid color fields — cream for pages, dark green for feature/dark sections, pink/lime for accent blocks. No photographic gradients or noise; the energy is in the color blocking. Imagery is bright, saturated, warm; illustrations use flat fills with dark-green outlines.
- **The signature "sticker" look:** key brand elements (logo, feature cards) use a **thick dark-green outline** plus a **hard, offset drop shadow** (`--shadow-sticker`, e.g. `4px 4px 0 #0F3D2E`) — never a soft blur on those. Regular content cards use a soft green-tinted shadow (`--shadow-card`).
- **Corners:** generous and rounded — 8–28px radii, full pills for chips/inputs/buttons. Nothing sharp.
- **Cards:** two modes — `flat` (white, soft shadow, hairline border) and `sticker` (white, 2px green outline, hard offset shadow). Dark `ink` cards for rankings/feature rails.
- **Buttons:** chunky, uppercase, bold, pill/rounded. Pink = primary, lime = positive/subscribe, dark green = ink. Solid fills with matching borders; outline & ghost for secondary.
- **Motion:** quick and springy. `--ease-out` for most transitions (120–200ms); `--ease-bounce` available for playful pops. Press state = slight scale-down (~0.96) + 1px nudge. Hover = darker shade of the same hue. No long or looping ambient animation.
- **Borders/dividers:** hairline `#E6E6E6` for structure; 2px dark-green for emphasis/sticker outlines.
- **Transparency/blur:** used sparingly; the brand favors solid opaque color over glassmorphism.
- **Iconography:** see below.

## Iconography
- The guide shows a set of **outlined line icons** (News, Tournaments, Players, Rankings, Events, Videos, Podcasts, Photos, Interviews, Highlights) with a **~2px rounded stroke**, occasionally two-tone (green + pink/lime accents).
- No proprietary icon font or SVG set was provided. The `Icon` component ships a curated set of **Lucide** paths (MIT, https://lucide.dev) — the closest match to the guide's stroke weight and rounded-corner style. **This is a substitution** (see Caveats). Icons inherit `currentColor`.
- **Brand motifs** (not icons): the **pickleball** (lime ball with holes, dark outline), the **net**, and the **PJ badge** are shipped as real SVG assets in `/assets` and used as illustration/media accents.
- Emoji and unicode symbols are **not** used as icons.

---

## Assets
Recreated from the brand guide (no original vector files were provided):
- `assets/logo.svg` — full **PICKLE JAM** wordmark lockup (net + green/pink type, cream sticker outline).
- `assets/pj-badge.svg` — round lime **PJ** badge.
- `assets/pickleball.svg` — pickleball motif.
- `assets/net.svg` — net motif.

The logo/wordmark is a **recreation** of the provided guide, built with the brand's real fonts and colors — treat it as a working stand-in and replace with official vector art when available (see Caveats).

## Index / manifest
- `styles.css` — global entry point (consumers link this). `@import`s only.
- `tokens/` — `fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `effects.css`.
- `components/` — reusable primitives (namespace `PickleJamDesignSystem_26eda6`):
  - **forms/** — `Button`, `IconButton`, `Input`
  - **display/** — `Card`, `Badge`, `Tag`, `Stat`, `Avatar`, `SectionHeading`, `StoryCard`
  - **brand/** — `Logo`, `Icon`
- `guidelines/` — foundation specimen cards (Colors, Type, Spacing, Brand).
- `ui_kits/platform/` — the Pickle Jam platform app: News feed, Tournaments, Courts, Groups (interactive `index.html`).
- `assets/` — logo & brand motif SVGs.
- `SKILL.md` — Agent-Skill entry point.

### Intentional additions
Brand-guidelines-only run, so components were authored from scratch to fit the brand. Notable brand-specific additions beyond a generic primitive set: `Logo`, `Icon`, `StoryCard` (the core editorial unit), `Stat`, `SectionHeading`, `Avatar` — all justified by the platform's news + tournaments + players content model.

## Caveats
- **Fonts:** Archivo Black + Montserrat are loaded from Google Fonts (exact matches to the guide) via `@import` in `tokens/fonts.css`. If you need self-hosted binaries, drop them in `assets/fonts` and add `@font-face` rules.
- **Logo:** recreated from the guide, not an official vector file.
- **Icons:** Lucide substitution for the guide's custom icon set.
