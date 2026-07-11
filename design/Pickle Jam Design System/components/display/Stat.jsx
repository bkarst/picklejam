import React from "react";

/** Big number + label stat block. */
export function Stat({ value, label, accent = "lime", ...rest }) {
  const colors = { lime: "var(--pj-lime-600)", pink: "var(--pj-pink-500)", ink: "var(--pj-green-900)" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }} {...rest}>
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 40,
          lineHeight: 0.95,
          color: colors[accent] || colors.lime,
          textShadow: accent === "lime" ? "1.5px 1.5px 0 var(--pj-green-900)" : "none",
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        {label}
      </span>
    </div>
  );
}
