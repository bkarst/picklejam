import React from "react";

/** Text input with optional leading icon, sized for search + forms. */
export function Input({
  value,
  onChange,
  placeholder = "",
  type = "text",
  iconLeft = null,
  size = "md",
  full = false,
  ...rest
}) {
  const pad = { sm: "8px 12px", md: "12px 16px", lg: "15px 18px" }[size] || "12px 16px";
  const fs = { sm: 13, md: 15, lg: 16 }[size] || 15;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        width: full ? "100%" : "auto",
        padding: pad,
        background: "var(--pj-white)",
        border: "2px solid var(--border-subtle)",
        borderRadius: "var(--radius-pill)",
        transition: "border-color var(--dur) var(--ease-out)",
      }}
      onFocusCapture={(e) => (e.currentTarget.style.borderColor = "var(--pj-green-900)")}
      onBlurCapture={(e) => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
    >
      {iconLeft && <span style={{ display: "inline-flex", color: "var(--text-muted)" }}>{iconLeft}</span>}
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        type={type}
        style={{
          flex: 1,
          minWidth: 0,
          border: "none",
          outline: "none",
          background: "transparent",
          fontFamily: "var(--font-body)",
          fontWeight: 500,
          fontSize: fs,
          color: "var(--text-strong)",
        }}
        {...rest}
      />
    </div>
  );
}
