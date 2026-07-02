"use client";

/**
 * NotificationBell — the header notification rail (PRD §9.3).
 *
 * A 44px bell button with an unread-count badge that opens an accessible dropdown
 * of recent notifications (title/body/time, an unread dot), a "Mark all read"
 * action, and a link to /account/alerts. Signed-in only (renders nothing when
 * signed out). Accessibility: real ≥44px pressable, aria-haspopup/aria-expanded,
 * Esc + outside-click close, focus rings; the live unread count is announced via
 * an aria-live region. Reduced-motion friendly (color transitions only).
 */

import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  useNotifications,
  useMarkRead,
  useMarkAllRead,
  type NotificationView,
} from "@/lib/api/notifications";

const BELL_PATH =
  "M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0";

function BellIcon({ className }: { className?: string }): JSX.Element {
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
      <path d={BELL_PATH} />
    </svg>
  );
}

/** Compact relative time ("now", "5m", "3h", "2d", else a short date). */
function relativeTime(iso?: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(then).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function NotificationBell(): JSX.Element | null {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const { data, isLoading } = useNotifications();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  // Close on navigation (sync UI ↔ route).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  // Esc + outside-click close (only while open).
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

  // Signed-in only. Hooks above run unconditionally (query disabled when signed out).
  if (!user) return null;

  const badgeLabel = unreadCount > 9 ? "9+" : String(unreadCount);
  const onItemClick = (n: NotificationView) => {
    if (!n.readAt) markRead.mutate({ id: n.id, ts: n.ts });
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex size-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-bold leading-4 text-secondary-foreground">
            {badgeLabel}
          </span>
        )}
      </button>

      {/* Live region: announce unread-count changes without moving focus. */}
      <span aria-live="polite" className="sr-only">
        {unreadCount > 0 ? `${unreadCount} unread notifications` : "No unread notifications"}
      </span>

      {open && (
        <div
          role="menu"
          aria-label="Notifications"
          className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border border-border bg-overlay shadow-overlay"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <p className="font-display text-sm font-bold text-foreground">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                className="rounded-md text-xs font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <p className="px-4 py-6 text-center text-sm text-muted">Loading…</p>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">{"You're all caught up."}</p>
            ) : (
              <ul className="flex flex-col">
                {notifications.map((n) => {
                  const unread = !n.readAt;
                  const inner = (
                    <>
                      <span
                        aria-hidden="true"
                        className={`mt-1.5 size-2 shrink-0 rounded-full ${
                          unread ? "bg-secondary" : "bg-transparent"
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium text-foreground">
                            {n.title}
                          </span>
                          <span className="shrink-0 text-[11px] text-muted">
                            {relativeTime(n.ts ?? n.createdAt)}
                          </span>
                        </span>
                        {n.body && (
                          <span className="mt-0.5 block text-xs text-muted line-clamp-2">
                            {n.body}
                          </span>
                        )}
                      </span>
                    </>
                  );
                  const itemClass = `flex w-full items-start gap-2 px-4 py-3 text-left transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                    unread ? "bg-accent/5" : ""
                  }`;
                  return (
                    <li key={n.id} className="border-b border-border last:border-b-0">
                      {n.entityRef ? (
                        <Link
                          href={n.entityRef}
                          role="menuitem"
                          className={itemClass}
                          onClick={() => onItemClick(n)}
                        >
                          {inner}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          role="menuitem"
                          className={itemClass}
                          onClick={() => onItemClick(n)}
                        >
                          {inner}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-border">
            <Link
              href="/account/alerts"
              role="menuitem"
              className="block px-4 py-3 text-center text-sm font-semibold text-accent hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Notification settings
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
