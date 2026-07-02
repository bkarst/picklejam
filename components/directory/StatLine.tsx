/**
 * StatLine — a compact "value label · value label" summary row used under
 * directory headings (4.3: "5 Locations · 23 Courts · 15 Upcoming Games").
 * A leading location-pin sets the geographic context; the middot separators are
 * hidden from assistive tech so each stat reads cleanly.
 */

import type { JSX } from "react";

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function StatLine({
  items,
}: {
  items: { label: string; value: string | number }[];
}): JSX.Element {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
      <PinIcon />
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="flex items-center gap-2">
          {i > 0 && (
            <span aria-hidden="true" className="select-none text-border">
              ·
            </span>
          )}
          <span>
            <span className="font-semibold text-foreground">{item.value}</span> {item.label}
          </span>
        </span>
      ))}
    </p>
  );
}
