"use client";

/**
 * AccountShell — the client chrome for every /account/* page (UI §13.5):
 * a left sidebar of account links (active item highlighted) that collapses to a
 * horizontally-scrolling pill row on mobile, plus the auth guard.
 *
 * Guard: while auth is resolving we show a Skeleton (never a flash of the page);
 * once resolved, signed-out visitors are redirected to /login?next=<path> so they
 * land back here after signing in.
 */

import { useEffect } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Skeleton } from "@heroui/react";
import { useAuth } from "@/components/auth/AuthProvider";
import { accountNav } from "@/lib/nav";

function isActive(pathname: string, href: string): boolean {
  if (href === "/account") return pathname === "/account";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function GuardSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 lg:flex-row">
      <div className="hidden w-56 shrink-0 flex-col gap-2 lg:flex">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-11 w-full rounded-xl" />
        ))}
      </div>
      <div className="flex-1 space-y-4">
        <Skeleton className="h-9 w-56 rounded-lg" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    </div>
  );
}

export function AccountShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, pathname, router]);

  // Resolving auth, or bouncing a signed-out visitor: show the skeleton.
  if (loading || !user) return <GuardSkeleton />;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 lg:flex-row">
      <nav aria-label="Account" className="lg:w-56 lg:shrink-0">
        {/* Mobile: horizontal scroll row. Desktop: vertical list. */}
        <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
          {accountNav.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <li key={link.href} className="shrink-0 lg:shrink">
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex h-11 items-center whitespace-nowrap rounded-xl px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus lg:w-full ${
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground hover:bg-surface-secondary"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
