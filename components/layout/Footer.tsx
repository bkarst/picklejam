/**
 * Footer — the sitewide IA / internal-linking hub (PRD §4, §12 rule 4: no orphans).
 * Server component (static links). Brand block + newsletter capture + legal bar.
 */

import Link from "next/link";
import { brand } from "@/brand.config";
import { Logo } from "@/components/ui/Logo";
import { footerColumns, legalLinks } from "@/lib/nav";
import { NewsletterSignup } from "./NewsletterSignup";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-border bg-surface" role="contentinfo">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-2 lg:grid-cols-6">
        {/* Brand + newsletter */}
        <div className="lg:col-span-2">
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted">{brand.identity.tagline}</p>
          <NewsletterSignup />
        </div>

        {/* IA columns */}
        {footerColumns.map((col) => (
          <nav key={col.label} aria-label={col.label} className="flex flex-col gap-2">
            <h2 className="font-display text-sm font-bold text-foreground">{col.label}</h2>
            <ul className="flex flex-col gap-1.5">
              {col.links.map((l) => (
                <li key={l.href + l.label}>
                  <Link href={l.href} className="text-sm text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      {/* Legal bottom bar */}
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {brand.identity.legalName}. All rights reserved.
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            {legalLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
