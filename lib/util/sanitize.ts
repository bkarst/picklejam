/**
 * sanitize.ts — strip HTML/markup from user-supplied PLAINTEXT fields (display names, group
 * names, review titles/bodies, check-in notes) before they're stored.
 *
 * React escapes on render, so these fields are never an XSS vector — this is about DISPLAY
 * HYGIENE: without it a name like `<img src=x onerror="…">Bob` renders as raw markup-looking
 * garbage across leaderboards, crew chips, reviews, and profiles. We strip tags + control
 * characters and normalize whitespace so the stored value is clean plaintext. Length limits
 * stay with the callers (they already enforce them).
 */

/** Remove anything that looks like an HTML/XML tag. */
function stripTags(input: string): string {
  return input.replace(/<[^>]*>/g, "");
}

/** Drop control characters. When `keepBreaks`, tab (0x09) / LF (0x0A) / CR (0x0D) survive. */
function stripControls(input: string, keepBreaks: boolean): string {
  let out = "";
  for (const ch of input) {
    const c = ch.charCodeAt(0);
    const isControl = c < 0x20 || c === 0x7f;
    const isBreak = c === 0x09 || c === 0x0a || c === 0x0d;
    if (isControl && !(keepBreaks && isBreak)) continue;
    out += ch;
  }
  return out;
}

/**
 * Single-line plaintext (display names, group names, review titles): strip tags + control
 * chars and collapse all whitespace to single spaces. Returns "" if nothing survives —
 * callers substitute a fallback / reject as appropriate.
 */
export function sanitizeLine(input: string): string {
  // Turn tabs/newlines into spaces first so words don't merge, then drop remaining control
  // chars and collapse to single spaces.
  return stripControls(stripTags(input).replace(/[\t\n\r]+/g, " "), false)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Multi-line plaintext (review bodies, check-in notes): strip tags + control chars but PRESERVE
 * paragraph breaks. Collapses horizontal whitespace and caps runs of blank lines.
 */
export function sanitizeMultiline(input: string): string {
  return stripControls(stripTags(input), true)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
