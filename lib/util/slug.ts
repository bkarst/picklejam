/**
 * slug.ts — URL slug helpers (PRD §3.2 taxonomy).
 *
 * Slugs are lowercase, ASCII-folded, hyphen-separated. Used for court/city/state
 * slugs, usernames, content/news slugs — anything that resolves an SSG page via a
 * `*SLUG#` GSI3 key (§9.3).
 */

/** Normalize an arbitrary string into a URL-safe slug. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD") // split accents from letters
    .replace(/[̀-ͯ]/g, "") // strip combining marks
    .toLowerCase()
    .replace(/['’]/g, "") // drop apostrophes so "o'brien" → "obrien"
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumerics → hyphen
    .replace(/^-+|-+$/g, "") // trim leading/trailing hyphens
    .replace(/-{2,}/g, "-"); // collapse runs
}

/** True if `s` is already a canonical slug (round-trips through `slugify`). */
export function isSlug(s: string): boolean {
  return s.length > 0 && slugify(s) === s;
}
