/**
 * FormatCard — one card in the round-robin format gallery (§6.8, landing 11.x).
 *
 * Presentational + server-renderable. Renders a format's icon, name, one-liner,
 * blurb, and "best for" / player-range chips. When `href` is provided the whole
 * card is a link (with a hover lift); otherwise it's static (e.g. as a quiz
 * result summary). Never relies on color alone — the icon + text carry meaning.
 */

import type { JSX } from "react";
import Link from "next/link";
import type { RrFormatIcon, RrFormatMeta } from "./formats";

/** Inline icon set for the five formats. `aria-hidden` — the label carries meaning. */
export function FormatIcon({
  icon,
  className = "size-6",
}: {
  icon: RrFormatIcon;
  className?: string;
}): JSX.Element {
  const common = {
    viewBox: "0 0 24 24",
    className,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (icon) {
    case "circle":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="3.5" r="1.4" fill="currentColor" />
          <circle cx="20.5" cy="12" r="1.4" fill="currentColor" />
          <circle cx="3.5" cy="12" r="1.4" fill="currentColor" />
          <circle cx="12" cy="20.5" r="1.4" fill="currentColor" />
        </svg>
      );
    case "shuffle":
      return (
        <svg {...common}>
          <path d="M16 3h5v5" />
          <path d="M4 20 21 3" />
          <path d="M21 16v5h-5" />
          <path d="m15 15 6 6" />
          <path d="M4 4l5 5" />
        </svg>
      );
    case "river":
      return (
        <svg {...common}>
          <path d="M7 20V10" />
          <path d="m3.5 13.5 3.5-3.5 3.5 3.5" />
          <path d="M17 4v10" />
          <path d="m13.5 10.5 3.5 3.5 3.5-3.5" />
        </svg>
      );
    case "swiss":
      return (
        <svg {...common}>
          <path d="M12 3v18" />
          <path d="M5 8h14" />
          <path d="M5 8 3 13a3 3 0 0 0 6 0z" />
          <path d="M19 8l-2 5a3 3 0 0 0 6 0z" />
        </svg>
      );
    case "trophy":
      return (
        <svg {...common}>
          <path d="M8 21h8" />
          <path d="M12 17v4" />
          <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
          <path d="M7 5H4v2a3 3 0 0 0 3 3" />
          <path d="M17 5h3v2a3 3 0 0 1-3 3" />
        </svg>
      );
  }
}

export function FormatCard({
  meta,
  href,
  selected = false,
}: {
  meta: RrFormatMeta;
  href?: string;
  selected?: boolean;
}): JSX.Element {
  const inner = (
    <>
      <div className="flex items-start gap-3">
        <span
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent"
          aria-hidden="true"
        >
          <FormatIcon icon={meta.icon} />
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold text-foreground">{meta.name}</h3>
          <p className="text-sm text-muted">{meta.tagline}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted">{meta.blurb}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-foreground">
          {meta.bestFor}
        </span>
        <span className="inline-flex items-center rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted">
          {meta.players}
        </span>
        {meta.dynamic && (
          <span className="inline-flex items-center rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted">
            Live scoring
          </span>
        )}
      </div>
    </>
  );

  const base = `flex h-full flex-col rounded-2xl border bg-surface p-5 text-left transition-shadow ${
    selected ? "border-accent ring-2 ring-accent/40" : "border-border"
  }`;

  if (href) {
    return (
      <Link
        href={href}
        className={`${base} hover:shadow-overlay focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus`}
      >
        {inner}
      </Link>
    );
  }
  return <div className={base}>{inner}</div>;
}
