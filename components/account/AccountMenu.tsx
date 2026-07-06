"use client";

/**
 * AccountMenu — the header's auth-aware account control (UI §3.2).
 *
 * Signed OUT: a "Sign in" button that opens the Auth modal (openAuth("login")).
 * Signed IN: an avatar button that opens an accessible dropdown of the account
 * links + "Log out". While auth resolves, a Skeleton avatar (no flash).
 *
 * Accessibility: real ≥44px pressables, aria-haspopup/aria-expanded, Esc + outside
 * click close, focus ring; the menu is a <ul> of links + a logout button.
 */

import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, Skeleton } from "@heroui/react";
import { useAuth } from "@/components/auth/AuthProvider";
import { accountNav } from "@/lib/nav";
import { GamifyMenuRow } from "@/components/account/GamifyMenuRow";

function initials(name: string | null, email: string | null): string {
  const base = name?.trim() || email?.split("@")[0] || "";
  return (
    base
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function AccountMenu(): JSX.Element {
  const { user, loading, signOut, openAuth } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    // Close the menu on navigation (sync UI ↔ route).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  if (loading) {
    return <Skeleton className="hidden size-11 rounded-full sm:block" />;
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => openAuth("login")}
        className="hidden h-11 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:inline-flex"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 21a8 8 0 10-16 0M12 11a4 4 0 100-8 4 4 0 000 8z" />
        </svg>
        Sign in
      </button>
    );
  }

  return (
    <div ref={ref} className="relative hidden sm:block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex size-11 items-center justify-center rounded-full transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <Avatar className="size-9 text-sm">
          {user.photoURL && <Avatar.Image src={user.photoURL} alt="" />}
          <Avatar.Fallback className="bg-accent text-accent-foreground">
            {initials(user.displayName, user.email)}
          </Avatar.Fallback>
        </Avatar>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-border bg-overlay p-1 shadow-overlay">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold text-foreground">
              {user.displayName ?? "Player"}
            </p>
            {user.email && <p className="truncate text-xs text-muted">{user.email}</p>}
          </div>
          <GamifyMenuRow onNavigate={() => setOpen(false)} />
          <div className="my-1 h-px bg-border" />
          <ul className="flex flex-col">
            {accountNav.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  role="menuitem"
                  className="block rounded-lg px-3 py-2 text-sm text-foreground hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-danger hover:bg-danger/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
