/**
 * JsonLd.tsx — render one or more JSON-LD documents (PRD §3.4).
 *
 * Server-component friendly (no "use client"). Accepts a single JSON-LD object
 * or an array of them (Google accepts an array in a single <script>).
 */

import type { JsonLd as JsonLdData } from "@/lib/seo/jsonld";

/**
 * Serialize JSON-LD for inlining in a `<script>`. `JSON.stringify` does NOT sanitize
 * strings, and this payload DOES carry user content (review title/body, group &
 * outing names/descriptions, player display names, round-robin entrant names). A
 * literal `</script>` in any of those closes the script tag — a stored XSS that ISR
 * bakes into cached HTML. Escape the HTML-significant characters (plus the JS line/
 * paragraph separators) to their `\uXXXX` form — the approach the Next.js JSON-LD
 * guide and `serialize-javascript` both use. The output is still valid JSON, since a
 * JSON string parser reads `<` back as `<`.
 */
function serializeJsonLd(data: JsonLdData | JsonLdData[]): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function JsonLd({ data }: { data: JsonLdData | JsonLdData[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}

export default JsonLd;
