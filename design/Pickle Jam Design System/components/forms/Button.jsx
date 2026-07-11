import React from "react";

/**
 * Pickle Jam Button — chunky, rounded, sporty.
 * Variants: primary (hot pink), accent (lime), ink (dark green), outline, ghost.
 */
export function Button({
  children,
  variant = "primary",
  size = "md",
  iconRight = null,
  iconLeft = null,
  disabled = false,
  full = false,
  as = "button",
  ...rest
}) {
  const sizes = {
    sm: { padding: "8px 16px", fontSize: 13, gap: 6, radius: "var(--radius-md)" },
    md: { padding: "13px 24px", fontSize: 15, gap: 8, radius: "var(--radius-md)" },
    lg: { padding: "17px 32px", fontSize: 17, gap: 10, radius: "var(--radius-lg)" },
  };
  const variants = {
    primary: { background: "var(--action-primary)", color: "var(--action-primary-text)", border: "2px solid var(--action-primary)" },
    accent:  { background: "var(--action-accent)", color: "var(--action-accent-text)", border: "2px solid var(--action-accent)" },
    ink:     { background: "var(--action-ink)", color: "var(--pj-cream-100)", border: "2px solid var(--action-ink)" },
    outline: { background: "transparent", color: "var(--pj-green-900)", border: "2px solid var(--pj-green-900)" },
    ghost:   { background: "transparent", color: "var(--pj-green-900)", border: "2px solid transparent" },
  };
  const s = sizes[size] || sizes.md;
  const v = variants[variant] || variants.primary;
  const Comp = as;
  return (
    <Comp
      disabled={as === "button" ? disabled : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: s.gap,
        width: full ? "100%" : "auto",
        padding: s.padding,
        fontFamily: "var(--font-body)",
        fontWeight: 700,
        fontSize: s.fontSize,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
        textDecoration: "none",
        lineHeight: 1,
        borderRadius: s.radius,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "transform var(--dur-fast) var(--ease-out), background var(--dur) var(--ease-out), filter var(--dur) var(--ease-out)",
        ...v,
      }}
      onMouseDown={(e) => !disabled && (e.currentTarget.style.transform = "translateY(1px) scale(0.98)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "")}
      {...rest}
    >
      {iconLeft}
      {children}
      {iconRight}
    </Comp>
  );
}
