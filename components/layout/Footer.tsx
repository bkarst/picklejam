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
    <footer className="mt-16 border-t border-border bg-background" role="contentinfo">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-2 lg:grid-cols-6">
        {/* Brand + newsletter */}
        <div className="lg:col-span-2">
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted">{brand.identity.tagline}</p>
          <div className="mt-4 flex gap-4">
            <a
              href="https://www.facebook.com/profile.php?id=61591534875039"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              className="text-muted transition-colors hover:text-foreground"
            >
              <svg className="size-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
              </svg>
            </a>
            <a
              href="https://x.com/thepicklejam"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X"
              className="text-muted transition-colors hover:text-foreground"
            >
              <svg className="size-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
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
