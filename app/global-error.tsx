"use client";

/**
 * global-error.tsx — the root error boundary / branded 500 (PRD §16.5).
 * Replaces the root layout when the layout itself throws, so it must render its
 * own <html>/<body>. Uses brand tokens via inline styles (the CSS pipeline may be
 * unavailable here) — values imported from brand.config, never hardcoded.
 */

import { brand } from "@/brand.config";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  const { cream, forest, charcoal } = brand.palette;
  return (
    <html lang="en">
      <body
        style={{
          background: cream,
          color: charcoal,
          fontFamily: "system-ui, sans-serif",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.25rem",
          textAlign: "center",
          padding: "2rem",
          margin: 0,
        }}
      >
        <h1 style={{ color: forest, fontSize: "2rem", fontWeight: 700 }}>
          {brand.identity.name} hit a snag
        </h1>
        <p style={{ maxWidth: "28rem", opacity: 0.8 }}>
          Something went wrong on our end. Please try again.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            background: forest,
            color: "#fff",
            border: 0,
            borderRadius: "9999px",
            padding: "0.75rem 1.5rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
