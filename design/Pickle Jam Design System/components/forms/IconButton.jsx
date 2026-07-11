import React from "react";

/** Square/round icon-only button. */
export function IconButton({
  children,
  variant = "ink",
  size = "md",
  round = false,
  label,
  ...rest
}) {
  const dims = { sm: 34, md: 42, lg: 52 }[size] || 42;
  const variants = {
    ink:     { background: "var(--pj-green-900)", color: "var(--pj-cream-100)", border: "2px solid var(--pj-green-900)" },
    lime:    { background: "var(--pj-lime-500)", color: "var(--pj-green-900)", border: "2px solid var(--pj-lime-500)" },
    pink:    { background: "var(--pj-pink-500)", color: "#fff", border: "2px solid var(--pj-pink-500)" },
    outline: { background: "transparent", color: "var(--pj-green-900)", border: "2px solid var(--pj-green-900)" },
    ghost:   { background: "transparent", color: "var(--pj-green-900)", border: "2px solid transparent" },
  };
  const v = variants[variant] || variants.ink;
  return (
    <button
      aria-label={label}
      title={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: dims,
        height: dims,
        borderRadius: round ? "999px" : "var(--radius-md)",
        cursor: "pointer",
        transition: "transform var(--dur-fast) var(--ease-out), filter var(--dur) var(--ease-out)",
        ...v,
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.92)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "")}
      {...rest}
    >
      {children}
    </button>
  );
}
