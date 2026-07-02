/**
 * JsonLd.tsx — render one or more JSON-LD documents (PRD §3.4).
 *
 * Server-component friendly (no "use client"). Accepts a single JSON-LD object
 * or an array of them (Google accepts an array in a single <script>).
 */

import type { JsonLd as JsonLdData } from "@/lib/seo/jsonld";

export function JsonLd({ data }: { data: JsonLdData | JsonLdData[] }) {
  return (
    <script
      type="application/ld+json"
      // JSON-LD is trusted, server-built data (no user HTML) — safe to inline.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export default JsonLd;
