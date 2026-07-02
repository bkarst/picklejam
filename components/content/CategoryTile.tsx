/**
 * CategoryTile — a "Browse by topic" row for the Content Hub (§6.5, mockup 8.1).
 *
 * A full-width link row: a category glyph, the label, an article count, and a
 * chevron affordance. Server component. The count is rendered as text (never
 * color-alone) and the whole row is a single 44px-tall tap target. A small glyph
 * set keys off the category metadata (`categories.ts`).
 */

import type { JSX } from "react";
import Link from "next/link";
import type { CategoryGlyph } from "./categories";

function Glyph({ glyph }: { glyph: CategoryGlyph }): JSX.Element {
  const cls = "size-5";
  const common = {
    viewBox: "0 0 24 24",
    className: cls,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (glyph) {
    case "paddle":
      return (
        <svg {...common}>
          <circle cx="10" cy="9" r="6" />
          <path d="M8 14l-3.5 6" />
        </svg>
      );
    case "rules":
      return (
        <svg {...common}>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
      );
    case "target":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "bag":
      return (
        <svg {...common}>
          <path d="M6 8h12l-1 12H7L6 8z" />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" />
        </svg>
      );
    case "smile":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 14a4.5 4.5 0 0 0 7 0" />
          <path d="M9 9.5h.01M15 9.5h.01" />
        </svg>
      );
    case "book":
    default:
      return (
        <svg {...common}>
          <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z" />
          <path d="M19 3v18" />
        </svg>
      );
  }
}

export function CategoryTile({
  label,
  href,
  count,
  glyph = "book",
}: {
  label: string;
  href: string;
  count?: number;
  glyph?: CategoryGlyph;
}): JSX.Element {
  return (
    <Link
      href={href}
      className="group flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <span className="text-accent">
        <Glyph glyph={glyph} />
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      {typeof count === "number" && (
        <span className="shrink-0 text-sm font-bold text-secondary">{count}</span>
      )}
      <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </Link>
  );
}
