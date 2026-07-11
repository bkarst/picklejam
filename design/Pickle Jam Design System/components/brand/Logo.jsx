import React from "react";

/**
 * Pickle Jam wordmark / lockup. Renders the brand SVGs shipped in /assets.
 * variant: "full" (net + PICKLE JAM), "badge" (lime PJ circle), "ball".
 */
export function Logo({ variant = "full", height = 64, assetBase = "", style = {}, ...rest }) {
  const files = {
    full: "logo.svg",
    badge: "pj-badge.svg",
    ball: "pickleball.svg",
    net: "net.svg",
  };
  const ratios = { full: 1866 / 1490, badge: 1, ball: 1, net: 2 };
  const src = `${assetBase}assets/${files[variant] || files.full}`;
  return (
    <img
      src={src}
      alt="Pickle Jam"
      height={height}
      width={height * (ratios[variant] || 1)}
      style={{ display: "block", ...style }}
      {...rest}
    />
  );
}
