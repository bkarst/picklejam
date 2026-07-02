/**
 * categories.ts — display metadata for Content Hub categories (§6.5).
 *
 * Categories are stored as slugs on `ContentItem.category` (e.g. "how-to-play",
 * "gear"). This maps the known slugs to a friendly label, a one-line blurb, and a
 * small decorative glyph id used by <CategoryTile>. Unknown slugs fall back to a
 * title-cased label + the default glyph, so a new category renders cleanly.
 */

import { titleize } from "./format";

export type CategoryGlyph = "paddle" | "rules" | "target" | "bag" | "smile" | "book";

export interface CategoryMeta {
  label: string;
  blurb: string;
  glyph: CategoryGlyph;
}

/** Known category slugs → display metadata (§6.5 taxonomy + mockup 8.1). */
export const CATEGORY_META: Record<string, CategoryMeta> = {
  "how-to-play": {
    label: "How to Play",
    blurb: "Step onto the court with confidence — the basics, first games, and etiquette.",
    glyph: "paddle",
  },
  rules: {
    label: "Rules",
    blurb: "Scoring, serving, the kitchen, and the calls that trip up new players.",
    glyph: "rules",
  },
  strategy: {
    label: "Strategy",
    blurb: "Positioning, shot selection, and drills to win more rallies.",
    glyph: "target",
  },
  gear: {
    label: "Gear",
    blurb: "Paddles, shoes, balls, and bags — expert picks and buying guides.",
    glyph: "bag",
  },
  "for-beginners": {
    label: "For Beginners",
    blurb: "New to pickleball? Start here with beginner-friendly guides.",
    glyph: "smile",
  },
  guides: {
    label: "Guides",
    blurb: "In-depth, evergreen guides to every part of the game.",
    glyph: "book",
  },
};

/** Resolve a category slug to its display metadata (with a graceful fallback). */
export function categoryMeta(category: string): CategoryMeta {
  return (
    CATEGORY_META[category] ?? {
      label: titleize(category),
      blurb: `Guides, tips, and gear for ${titleize(category).toLowerCase()}.`,
      glyph: "book",
    }
  );
}
