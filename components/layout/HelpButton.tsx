"use client";

/**
 * HelpButton — floating help affordance (UI §3.4). Hidden on app/console/checkout
 * routes (same boundary as ads/banner, via `showsChrome`). Links to Contact for
 * now; a help center / support widget can replace the target later.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { showsChrome } from "@/lib/route-class";

export function HelpButton() {
  const pathname = usePathname();
  if (!showsChrome(pathname)) return null;

  return (
    <Link
      href="/contact"
      aria-label="Get help"
      className="fixed bottom-4 right-4 z-30 inline-flex size-11 items-center justify-center rounded-full bg-surface text-foreground shadow-overlay ring-1 ring-border transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9.1 9a3 3 0 015.8 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
        <circle cx="12" cy="12" r="10" />
      </svg>
    </Link>
  );
}
