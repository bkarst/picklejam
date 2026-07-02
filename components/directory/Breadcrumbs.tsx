/**
 * Breadcrumbs — the visual trail above directory pages (4.3 / 4.5:
 * "Home / United States / Kansas / Lenexa"). VISUAL ONLY — the page emits the
 * BreadcrumbList JSON-LD separately.
 *
 * Accessible: a `<nav aria-label="Breadcrumb">` wrapping an ordered list; items
 * with an href are links (muted → forest on hover), and the final item (no href)
 * is the current page (`aria-current="page"`). Separators are hidden from AT.
 */

import type { JSX } from "react";
import Link from "next/link";

export function Breadcrumbs({
  items,
}: {
  items: { name: string; href?: string }[];
}): JSX.Element {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${item.name}-${i}`} className="flex items-center gap-1">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="rounded-sm text-muted transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  {item.name}
                </Link>
              ) : (
                <span
                  className="font-medium text-foreground"
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.name}
                </span>
              )}
              {!isLast && (
                <span aria-hidden="true" className="select-none text-muted">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
