/**
 * Logo — the PickleLoko lockup (brand board §01/§02). Two-tone Fredoka wordmark
 * ("Pickle" forest + "Loko" hot pink) beside the pickleball mark. Brand name comes
 * from brand.config (never hardcode "PickleLoko" text elsewhere).
 */

import { brand } from "@/brand.config";

/** The pickleball mark — lime ball, forest ring, cream holes (brand board). */
function BallMark({ size = 32 }: { size?: number }) {
  const holes: [number, number, number][] = [
    [16, 8, 2.1],
    [22.5, 12, 1.9],
    [22, 19, 1.9],
    [15.5, 22, 2.1],
    [9.5, 18.5, 1.8],
    [10.5, 11.5, 1.8],
  ];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="16" cy="16" r="14" fill={brand.palette.lime} stroke={brand.palette.forest} strokeWidth="2.5" />
      {holes.map(([cx, cy, r], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill={brand.palette.cream} />
      ))}
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
  const name = brand.identity.name; // "PickleLoko"
  const split = name.indexOf("Loko");
  const first = split > 0 ? name.slice(0, split) : name;
  const second = split > 0 ? name.slice(split) : "";

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
      <span className="font-display text-xl font-bold leading-none tracking-tight">
        <span className="text-accent">{first}</span>
        <span className="text-secondary">{second}</span>
      </span>
    </span>
  );
}
