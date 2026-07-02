/**
 * KeyTakeaways — the "key takeaways" callout at the top of an article (§6.5).
 *
 * A highlighted, scannable summary block (accent-tinted) with a checkmark list.
 * Server component; self-hides when there are no items. The heading is a real
 * <h2> so it participates in the document outline (and the TOC skips it — the TOC
 * is built from the markdown body, not this block).
 */

import type { JSX } from "react";

export function KeyTakeaways({
  items,
  title = "Key takeaways",
}: {
  items: string[];
  title?: string;
}): JSX.Element | null {
  if (!items || items.length === 0) return null;
  return (
    <aside className="rounded-2xl border border-accent/25 bg-accent/5 p-5" aria-label={title}>
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
        <svg viewBox="0 0 24 24" className="size-5 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
        {title}
      </h2>
      <ul className="mt-3 flex flex-col gap-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-foreground">
            <svg viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0 text-success" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
