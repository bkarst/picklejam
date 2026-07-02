"use client";

/**
 * PromoBanner — dismissible seasonal cross-sell above the header (PRD §4, UI §3.1).
 * Cookie/localStorage-persisted dismissal; hidden on app/console/checkout routes
 * (same boundary as ads, via `showsChrome`).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { showsChrome } from "@/lib/route-class";

const KEY = "pl-promo-dismissed";
const PROMO = {
  text: "Leagues are live — find one near you.",
  href: "/leagues",
  cta: "Explore leagues",
};

export function PromoBanner() {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(true); // default hidden until hydrated

  useEffect(() => {
    // Read the client-only dismissal flag from localStorage after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(localStorage.getItem(KEY) === "1");
  }, []);

  if (dismissed || !showsChrome(pathname)) return null;

  return (
    <div className="relative bg-accent text-accent-foreground">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-3 px-10 py-2 text-center text-sm">
        <p>
          {PROMO.text}{" "}
          <Link href={PROMO.href} className="font-semibold underline underline-offset-2">
            {PROMO.cta}
          </Link>
        </p>
      </div>
      <button
        type="button"
        aria-label="Dismiss announcement"
        onClick={() => {
          localStorage.setItem(KEY, "1");
          setDismissed(true);
        }}
        className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
