import React from "react";

/** Eyebrow overline + heavy display title, with optional trailing action. */
export function SectionHeading({ overline, title, action = null, align = "left", size = "md", ...rest }) {
  const titleSize = { sm: 22, md: 30, lg: 40 }[size] || 30;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 16,
        textAlign: align,
      }}
      {...rest}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {overline && (
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--text-accent)",
            }}
          >
            {overline}
          </span>
        )}
        <h2
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            textTransform: "uppercase",
            fontSize: titleSize,
            lineHeight: 0.95,
            letterSpacing: "-0.01em",
            color: "var(--text-strong)",
          }}
        >
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}
