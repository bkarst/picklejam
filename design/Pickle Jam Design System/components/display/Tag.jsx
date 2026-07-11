import React from "react";

/** Soft rounded category chip — News, Tournaments, Players… */
export function Tag({ children, active = false, iconLeft = null, onClick, ...rest }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 14px",
        fontFamily: "var(--font-body)",
        fontWeight: 600,
        fontSize: 13,
        lineHeight: 1,
        cursor: onClick ? "pointer" : "default",
        borderRadius: "var(--radius-pill)",
        border: "2px solid " + (active ? "var(--pj-green-900)" : "var(--border-subtle)"),
        background: active ? "var(--pj-green-900)" : "transparent",
        color: active ? "var(--pj-cream-100)" : "var(--text-strong)",
        transition: "all var(--dur) var(--ease-out)",
      }}
      {...rest}
    >
      {iconLeft}
      {children}
    </button>
  );
}
