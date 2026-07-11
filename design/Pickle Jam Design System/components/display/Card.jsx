import React from "react";

/**
 * Card surface. variant "flat" (soft shadow) or "sticker" (dark outline +
 * hard offset shadow — the signature Pickle Jam look).
 */
export function Card({ children, variant = "flat", pad = 20, style = {}, ...rest }) {
  const looks = {
    flat: {
      background: "var(--surface-card)",
      border: "1px solid var(--border-subtle)",
      boxShadow: "var(--shadow-card)",
    },
    sticker: {
      background: "var(--surface-card)",
      border: "2px solid var(--pj-green-900)",
      boxShadow: "var(--shadow-sticker)",
    },
    ink: {
      background: "var(--pj-green-900)",
      border: "2px solid var(--pj-green-900)",
      color: "var(--pj-cream-100)",
      boxShadow: "var(--shadow-card)",
    },
  };
  return (
    <div
      style={{
        borderRadius: "var(--radius-lg)",
        padding: pad,
        overflow: "hidden",
        ...(looks[variant] || looks.flat),
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
