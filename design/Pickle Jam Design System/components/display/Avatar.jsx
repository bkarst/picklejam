import React from "react";

/** Circular player/user avatar with dark-green ring. */
export function Avatar({ src, name = "", size = 44, ring = true, ...rest }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--pj-lime-500)",
        color: "var(--pj-green-900)",
        border: ring ? "2px solid var(--pj-green-900)" : "none",
        fontFamily: "var(--font-display)",
        fontSize: size * 0.36,
      }}
      {...rest}
    >
      {src ? <img src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
    </div>
  );
}
