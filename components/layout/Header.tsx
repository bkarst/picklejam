"use client";

/**
 * Header — sticky global chrome (PRD §4, UI §3.2).
 *
 * Desktop: logo + 4 intent mega-menus (Play/Compete/Learn/Organize) with promo
 * cards + search + theme toggle + account. Mobile: hamburger → full-screen drawer
 * with the mega-menus as accordions. Accessible: <nav> landmark, aria-expanded on
 * triggers, Esc/outside-click closes, ≥44px targets, visible focus rings.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@heroui/react";
import { Logo } from "@/components/ui/Logo";
import { AccountMenu } from "@/components/account/AccountMenu";
import { NotificationBell } from "@/components/community/NotificationBell";
import { useAuth } from "@/components/auth/AuthProvider";
import { primaryNav, accountNav } from "@/lib/nav";

function Icon({ path, className }: { path: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "size-5"}
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}
const ICONS = {
  search: "M21 21l-4.3-4.3M11 19a8 8 0 100-16 8 8 0 000 16z",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "M6 6l12 12M18 6L6 18",
  chevron: "M6 9l6 6 6-6",
  sun: "M12 3v2M12 19v2M5 5l1.5 1.5M17.5 17.5L19 19M3 12h2M19 12h2M5 19l1.5-1.5M17.5 6.5L19 5M12 8a4 4 0 100 8 4 4 0 000-8z",
  moon: "M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z",
  user: "M20 21a8 8 0 10-16 0M12 11a4 4 0 100-8 4 4 0 000 8z",
};

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex size-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <Icon path={isDark ? ICONS.sun : ICONS.moon} />
    </button>
  );
}

export function Header() {
  const pathname = usePathname();
  const { user, signOut, openAuth } = useAuth();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  // Close transient menus when the route changes (sync UI ↔ navigation).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setOpenMenu(null);
    setMobileOpen(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [pathname]);

  // Esc closes; outside click closes desktop menu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenMenu(null);
        setMobileOpen(false);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  // Lock scroll when the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <nav ref={navRef} aria-label="Primary" className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4">
        <Link href="/" className="mr-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
          <Logo />
        </Link>

        {/* Desktop mega-menus */}
        <ul className="hidden items-center gap-1 lg:flex">
          {primaryNav.map((col) => {
            const isOpen = openMenu === col.label;
            return (
              <li key={col.label} className="relative" onMouseEnter={() => setOpenMenu(col.label)} onMouseLeave={() => setOpenMenu(null)}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-haspopup="true"
                  onClick={() => setOpenMenu(isOpen ? null : col.label)}
                  className="inline-flex h-11 items-center gap-1 rounded-full px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  {col.label}
                  <Icon path={ICONS.chevron} className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="absolute left-0 top-full z-50 w-[34rem] pt-2">
                    <div className="grid grid-cols-5 gap-4 rounded-2xl border border-border bg-overlay p-4 shadow-overlay">
                      <ul className="col-span-3 flex flex-col gap-1">
                        {col.links.map((l) => (
                          <li key={l.href + l.label}>
                            <Link href={l.href} className="block rounded-lg px-3 py-2 hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                              <span className="block text-sm font-medium text-foreground">{l.label}</span>
                              {l.description && <span className="block text-xs text-muted">{l.description}</span>}
                            </Link>
                          </li>
                        ))}
                      </ul>
                      {col.promo && (
                        <Link href={col.promo.href} className="col-span-2 flex flex-col justify-between rounded-xl bg-accent p-4 text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                          <div>
                            <p className="font-display text-sm font-bold">{col.promo.title}</p>
                            <p className="mt-1 text-xs opacity-90">{col.promo.body}</p>
                          </div>
                          <span className="mt-3 text-xs font-semibold underline">{col.promo.cta} →</span>
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <div className="flex-1" />

        {/* Right cluster */}
        <Link href="/search" aria-label="Search" className="inline-flex size-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
          <Icon path={ICONS.search} />
        </Link>
        <ThemeToggle />
        <NotificationBell />
        <AccountMenu />

        {/* Mobile hamburger */}
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(true)}
          className="inline-flex size-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus lg:hidden"
        >
          <Icon path={ICONS.menu} />
        </button>
      </nav>

      {/* Mobile full-screen drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background lg:hidden">
          <div className="flex h-16 items-center justify-between border-b border-border px-4">
            <Logo />
            <button type="button" aria-label="Close menu" onClick={() => setMobileOpen(false)} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
              <Icon path={ICONS.close} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <ul className="flex flex-col gap-1">
              {primaryNav.map((col) => {
                const isExp = expanded === col.label;
                return (
                  <li key={col.label} className="border-b border-border">
                    <button
                      type="button"
                      aria-expanded={isExp}
                      onClick={() => setExpanded(isExp ? null : col.label)}
                      className="flex w-full items-center justify-between py-3 text-left text-base font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    >
                      {col.label}
                      <Icon path={ICONS.chevron} className={`size-5 transition-transform ${isExp ? "rotate-180" : ""}`} />
                    </button>
                    {isExp && (
                      <ul className="flex flex-col gap-1 pb-3 pl-3">
                        {col.links.map((l) => (
                          <li key={l.href + l.label}>
                            <Link href={l.href} className="block rounded-lg px-2 py-2 text-sm text-foreground hover:bg-surface-secondary">
                              {l.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
            {user ? (
              <div className="mt-4 border-t border-border pt-4">
                <p className="px-2 pb-2 text-sm font-semibold text-foreground">
                  {user.displayName ?? user.email ?? "Account"}
                </p>
                <ul className="flex flex-col gap-1">
                  {accountNav.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="block rounded-lg px-2 py-2 text-sm text-foreground hover:bg-surface-secondary">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    void signOut();
                  }}
                  className="mt-2 block w-full rounded-lg px-2 py-2 text-left text-sm font-medium text-danger hover:bg-danger/10"
                >
                  Log out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  openAuth("login");
                }}
                className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent px-4 font-semibold text-accent-foreground"
              >
                <Icon path={ICONS.user} className="size-5" />
                Sign in
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
