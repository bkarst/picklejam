import React from "react";

/** Loud status pill — "TOP STORY", "LIVE", "NEW". */
export function Badge({ children, variant = "pink", size = "md", dot = false, ...rest }) {
  const variants = {
    pink: { background: "var(--pj-pink-500)", color: "#fff" },
    lime: { background: "var(--pj-lime-500)", color: "var(--pj-green-900)" },
    ink:  { background: "var(--pj-green-900)", color: "var(--pj-cream-100)" },
    cream:{ background: "var(--pj-cream-100)", color: "var(--pj-green-900)" },
  };
  const pad = size === "sm" ? "3px 8px" : "5px 11px";
  const fs = size === "sm" ? 10 : 11;
  const v = variants[variant] || variants.pink;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: pad,
        fontFamily: "var(--font-body)",
        fontWeight: 700,
        fontSize: fs,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        lineHeight: 1,
        borderRadius: "var(--radius-sm)",
        ...v,
      }}
      {...rest}
    >
      {dot && (
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", opacity: 0.9 }} />
      )}
      {children}
    </span>
  );
}
