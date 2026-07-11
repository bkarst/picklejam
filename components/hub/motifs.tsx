/**
 * Hub motifs — decorative court-green line illustrations for the HubHero color
 * panel (one per hub). Drawn in `brand.palette.courtGreen` so they read on any
 * panel tone (lime / pink / soft-pink). Purely decorative → aria-hidden.
 */
import type { JSX } from "react";
import { brand } from "@/brand.config";

const G = brand.palette.courtGreen;
const cls = "h-40 w-40 sm:h-52 sm:w-52";

/** Single-elimination bracket — tournaments. */
export function BracketMotif(): JSX.Element {
  return (
    <svg viewBox="0 0 220 200" className={cls} aria-hidden="true">
      <g stroke={G} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 24 H72" />
        <path d="M18 64 H72" />
        <path d="M18 136 H72" />
        <path d="M18 176 H72" />
        <path d="M72 24 V64" />
        <path d="M72 136 V176" />
        <path d="M72 44 H122" />
        <path d="M72 156 H122" />
        <path d="M122 44 V156" />
        <path d="M122 100 H168" />
      </g>
      <circle cx="188" cy="100" r="15" fill={G} />
      <circle cx="188" cy="100" r="5.5" fill={brand.palette.cream} />
    </svg>
  );
}

/** Rungs to climb — ladders. */
export function LadderMotif(): JSX.Element {
  return (
    <svg viewBox="0 0 200 200" className={cls} aria-hidden="true">
      <g stroke={G} strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M66 18 V182" />
        <path d="M134 18 V182" />
        <path d="M66 52 H134" />
        <path d="M66 90 H134" />
        <path d="M66 128 H134" />
        <path d="M66 166 H134" />
      </g>
    </svg>
  );
}

/** Weekly-schedule calendar — leagues. */
export function CalendarMotif(): JSX.Element {
  return (
    <svg viewBox="0 0 200 200" className={cls} aria-hidden="true">
      <g stroke={G} strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <rect x="30" y="44" width="140" height="128" rx="14" />
        <path d="M30 80 H170" />
        <path d="M70 30 V56" />
        <path d="M130 30 V56" />
      </g>
      <g fill={G}>
        <circle cx="66" cy="110" r="7" />
        <circle cx="100" cy="110" r="7" />
        <circle cx="134" cy="110" r="7" />
        <circle cx="66" cy="144" r="7" />
        <circle cx="100" cy="144" r="7" />
      </g>
    </svg>
  );
}

/** Everyone-plays-everyone graph — round robin. */
export function RotationMotif(): JSX.Element {
  const pts = [0, 1, 2, 3, 4].map((i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return [100 + 72 * Math.cos(a), 100 + 72 * Math.sin(a)] as const;
  });
  const lines: [number, number, number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      lines.push([pts[i][0], pts[i][1], pts[j][0], pts[j][1]]);
    }
  }
  return (
    <svg viewBox="0 0 200 200" className={cls} aria-hidden="true">
      <g stroke={G} strokeWidth="3.5" strokeLinecap="round">
        {lines.map(([x1, y1, x2, y2], k) => (
          <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
      <g fill={G}>
        {pts.map(([x, y], k) => (
          <circle key={k} cx={x} cy={y} r="12" />
        ))}
      </g>
    </svg>
  );
}

/** A crew of people — groups. */
export function GroupsMotif(): JSX.Element {
  return (
    <svg viewBox="0 0 200 200" className={cls} aria-hidden="true">
      <g stroke={G} strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="100" cy="76" r="26" />
        <path d="M60 154 a40 40 0 0 1 80 0" />
        <circle cx="46" cy="94" r="16" />
        <path d="M22 150 a26 26 0 0 1 26 -26" />
        <circle cx="154" cy="94" r="16" />
        <path d="M178 150 a26 26 0 0 1 -26 -26" />
      </g>
    </svg>
  );
}
