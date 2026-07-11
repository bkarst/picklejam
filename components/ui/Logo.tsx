/**
 * Logo — the Pickle Jam lockup (brand guide §01/§02). Two-tone Archivo Black
 * wordmark ("PICKLE" court-green + "JAM" hot-pink) with the brand's sporty skew,
 * beside the pickleball mark. Brand name comes from brand.config (never hardcode
 * "Pickle Jam" text elsewhere).
 *
 * The wordmark is live text (not an <img>) so it stays theme-adaptive: `text-accent`
 * resolves to court green in light mode and lime in dark mode, `text-secondary` to
 * hot pink in both — matching the brand guide on cream and on the dark court-green.
 */

import { brand } from "@/brand.config";

/** The pickleball mark — lime ball, court-green ring (brand guide). */
function BallMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="16" cy="16" r="13.5" fill={brand.palette.lime} stroke={brand.palette.courtGreen} strokeWidth="2.25" />
    </svg>
  );
}

export function Logo({
  variant = "lockup",
  className,
}: {
  variant?: "lockup" | "wordmark" | "mark";
  className?: string;
}) {
  const name = brand.identity.name; // "Pickle Jam"
  const split = name.indexOf(" ");
  const first = split > 0 ? name.slice(0, split) : name;
  const second = split > 0 ? name.slice(split + 1) : "";

  if (variant === "mark") {
    return (
      <span className={className} role="img" aria-label={name} data-logo>
        <BallMark />
      </span>
    );
  }

  return (
    // data-logo: the two-tone wordmark is a logotype (WCAG 1.4.3-exempt from the
    // text-contrast rule); the automated axe contrast scan excludes it.
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`} role="img" aria-label={name} data-logo>
      {variant === "lockup" && <BallMark />}
      {/* Archivo Black is a single heavy weight — no font-bold. skewX gives the
          brand's "sticker" slant. */}
      <span
        className="font-display text-xl font-black uppercase leading-none tracking-tight"
        style={{ transform: "skewX(-6deg)" }}
      >
        <span className="text-accent">{first}</span>
        {second && (
          <>
            {" "}
            <span className="text-secondary">{second}</span>
          </>
        )}
      </span>
    </span>
  );
}
