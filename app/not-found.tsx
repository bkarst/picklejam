/** Branded 404 (PRD §16.5) — search + popular links to recover. */

import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { primaryNav } from "@/lib/nav";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  const popular = primaryNav.flatMap((c) => c.links).slice(0, 6);
  return (
    <main id="main" className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-5 p-8 text-center">
      <Logo variant="mark" />
      <p className="font-display text-6xl font-bold text-accent">404</p>
      <h1 className="font-display text-2xl font-bold text-foreground">We couldn&rsquo;t find that page</h1>
      <p className="max-w-md text-muted">The link may be broken or the page may have moved. Try a search or one of these:</p>
      <Link
        href="/search"
        className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 font-semibold text-accent-foreground hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        Search PickleLoko
      </Link>
      <ul className="flex flex-wrap items-center justify-center gap-2">
        {popular.map((l) => (
          <li key={l.href + l.label}>
            <Link href={l.href} className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm text-foreground hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
