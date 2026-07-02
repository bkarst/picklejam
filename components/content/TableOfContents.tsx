"use client";

/**
 * TableOfContents — the on-article contents nav with scroll-spy (§6.5).
 *
 * PROGRESSIVE ENHANCEMENT: the links are plain in-page anchors (`#id`) that work
 * with JavaScript disabled — the crawlable article body carries matching heading
 * ids (emitted by <MarkdownBody>). The client layer only ADDS scroll-spy: it
 * highlights the heading currently in view via an IntersectionObserver, and is a
 * no-op where IntersectionObserver is unavailable (older/SSR/jsdom). Nothing
 * about navigation depends on JS.
 */

import type { JSX } from "react";
import { useEffect, useState } from "react";

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

export function TableOfContents({
  items,
  title = "On this page",
  className = "",
}: {
  items: TocItem[];
  title?: string;
  className?: string;
}): JSX.Element | null {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || items.length === 0) return;
    const headings = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // The first heading intersecting near the top wins; fall back to the last
        // one scrolled past so the highlight never blanks between sections.
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          const top = visible.reduce((a, b) =>
            a.boundingClientRect.top < b.boundingClientRect.top ? a : b,
          );
          setActiveId(top.target.id);
        }
      },
      { rootMargin: "0px 0px -70% 0px", threshold: [0, 1] },
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav aria-label={title} className={className}>
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">{title}</p>
      <ul className="flex flex-col gap-1 border-l border-border">
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <li key={item.id} style={{ paddingLeft: `${(Math.max(2, item.level) - 2) * 0.75}rem` }}>
              <a
                href={`#${item.id}`}
                aria-current={isActive ? "location" : undefined}
                className={`-ml-px block border-l-2 py-1 pl-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                  isActive
                    ? "border-accent font-semibold text-accent"
                    : "border-transparent text-muted hover:border-border hover:text-foreground"
                }`}
              >
                {item.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
