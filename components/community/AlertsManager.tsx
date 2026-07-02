"use client";

/**
 * AlertsManager — the /account/alerts control surface (PRD §6.3, §9.3).
 *
 * Three sections:
 *   1. Notification types — per-type × channel (in-app / email) Switches.
 *   2. Quiet hours — a window during which the email mirror is suppressed.
 *   3. Recent notifications — the rail with per-row + bulk mark-read.
 *
 * Prefs use an OPT-OUT model: a channel is on unless explicitly turned off, so an
 * unset pref renders as enabled. Preference writes are optimistic (the hook rolls
 * back on failure). HeroUI Switch/Button + Skeleton loading; theme classes only.
 */

import { useState } from "react";
import type { JSX, ReactNode } from "react";
import { Button, Skeleton, Switch } from "@heroui/react";
import {
  useAlertPrefs,
  useUpdateAlertPrefs,
  useNotifications,
  useMarkRead,
  useMarkAllRead,
} from "@/lib/api/notifications";
import type { NotificationType, NotifPrefs } from "@/lib/db/types";

/** The tunable types + their human labels/descriptions. */
const TYPE_META: { type: NotificationType; title: string; description: string }[] = [
  {
    type: "new_game_at_followed_court",
    title: "New games at courts you follow",
    description: "When someone schedules a game at a court you've saved.",
  },
  {
    type: "outing_rsvp",
    title: "RSVPs to your outings",
    description: "When a player RSVPs to a game you're organizing.",
  },
  {
    type: "review_helpful",
    title: "Helpful review votes",
    description: "When another player marks one of your reviews helpful.",
  },
  {
    type: "system",
    title: "Product & account updates",
    description: "Important account, safety, and product announcements.",
  },
];

const DEFAULT_QUIET = { start: "22:00", end: "07:00" };

/** Opt-out read: a channel is enabled unless explicitly `false`. */
function channelOn(prefs: NotifPrefs, type: NotificationType, channel: "inapp" | "email"): boolean {
  return prefs.channels?.[type]?.[channel] !== false;
}

/** Immutably set one channel value, returning the full next prefs. */
function withChannel(
  prefs: NotifPrefs,
  type: NotificationType,
  channel: "inapp" | "email",
  value: boolean,
): NotifPrefs {
  const channels = { ...(prefs.channels ?? {}) };
  channels[type] = { ...(channels[type] ?? {}), [channel]: value };
  return { ...prefs, channels };
}

function relativeTime(iso?: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const min = Math.floor((Date.now() - then) / 60_000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(then).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ToggleControl({
  label,
  isSelected,
  onChange,
}: {
  label: string;
  isSelected: boolean;
  onChange: (v: boolean) => void;
}): JSX.Element {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground">
      <Switch aria-label={label} isSelected={isSelected} onChange={onChange}>
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Content>
      </Switch>
      <span className="text-muted">{label}</span>
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <h2 className="font-display text-base font-bold text-foreground">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export function AlertsManager(): JSX.Element {
  const { data: prefs, isLoading, isError, refetch } = useAlertPrefs();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-40 rounded-lg" />
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError || !prefs) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Alerts</h1>
        <div
          className="rounded-2xl border border-border bg-surface p-6 text-center"
          role="alert"
        >
          <p className="text-sm text-muted">
            We couldn&apos;t load your notification settings. Please try again.
          </p>
          <div className="mt-4">
            <Button variant="outline" size="sm" onPress={() => void refetch()}>
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <AlertsInner prefs={prefs} />;
}

function AlertsInner({ prefs }: { prefs: NotifPrefs }): JSX.Element {
  const update = useUpdateAlertPrefs();
  const [error, setError] = useState<string | null>(null);

  const notifs = useNotifications();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const save = (next: NotifPrefs) => {
    setError(null);
    update.mutate(next, {
      onError: () => setError("Couldn't save that setting — please try again."),
    });
  };

  const quietEnabled = prefs.quietHours != null;
  const quiet = prefs.quietHours ?? DEFAULT_QUIET;

  const notifications = notifs.data?.notifications ?? [];
  const unreadCount = notifs.data?.unreadCount ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Alerts</h1>

      {error && (
        <p
          className="rounded-xl border border-danger/40 bg-danger/5 px-4 py-2 text-sm text-danger"
          role="alert"
        >
          {error}
        </p>
      )}

      {/* 1. Notification types × channels */}
      <Section title="What you're notified about">
        <ul className="flex flex-col">
          {TYPE_META.map(({ type, title, description }) => (
            <li
              key={type}
              className="flex flex-col gap-3 border-b border-border py-4 last:border-b-0 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-medium text-foreground">{title}</p>
                <p className="text-sm text-muted">{description}</p>
              </div>
              <div className="flex shrink-0 gap-5 sm:pt-0.5">
                <ToggleControl
                  label="In-app"
                  isSelected={channelOn(prefs, type, "inapp")}
                  onChange={(v) => save(withChannel(prefs, type, "inapp", v))}
                />
                <ToggleControl
                  label="Email"
                  isSelected={channelOn(prefs, type, "email")}
                  onChange={(v) => save(withChannel(prefs, type, "email", v))}
                />
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* 2. Quiet hours */}
      <Section title="Quiet hours">
        <div className="flex items-start justify-between gap-4 py-2">
          <div className="min-w-0">
            <p className="font-medium text-foreground">Pause notification emails</p>
            <p className="text-sm text-muted">
              {"We won't send email during this window (in-app notifications still arrive)."}
            </p>
          </div>
          <div className="shrink-0 pt-0.5">
            <Switch
              aria-label="Enable quiet hours"
              isSelected={quietEnabled}
              onChange={(v) => save({ ...prefs, quietHours: v ? DEFAULT_QUIET : null })}
            >
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Content>
            </Switch>
          </div>
        </div>

        {quietEnabled && (
          <div className="mt-3 flex flex-wrap items-end gap-4">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-foreground">From</span>
              <input
                type="time"
                value={quiet.start}
                onChange={(e) => save({ ...prefs, quietHours: { ...quiet, start: e.target.value } })}
                className="h-11 rounded-xl border border-border bg-field px-3 text-field-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-foreground">To</span>
              <input
                type="time"
                value={quiet.end}
                onChange={(e) => save({ ...prefs, quietHours: { ...quiet, end: e.target.value } })}
                className="h-11 rounded-xl border border-border bg-field px-3 text-field-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              />
            </label>
          </div>
        )}
      </Section>

      {/* 3. Recent notifications */}
      <Section title="Recent notifications">
        <div className="-mt-1 mb-1 flex items-center justify-end">
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onPress={() => markAllRead.mutate()}>
              Mark all read
            </Button>
          )}
        </div>
        {notifs.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">You have no notifications yet.</p>
        ) : (
          <ul className="flex flex-col">
            {notifications.map((n) => {
              const unread = !n.readAt;
              return (
                <li
                  key={n.id}
                  className="flex items-start gap-3 border-b border-border py-3 last:border-b-0"
                >
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${
                      unread ? "bg-secondary" : "bg-transparent"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{n.title}</p>
                      <span className="shrink-0 text-xs text-muted">
                        {relativeTime(n.ts ?? n.createdAt)}
                      </span>
                    </div>
                    {n.body && <p className="mt-0.5 text-sm text-muted">{n.body}</p>}
                  </div>
                  {unread && (
                    <button
                      type="button"
                      onClick={() => markRead.mutate({ id: n.id, ts: n.ts })}
                      className="shrink-0 rounded-md text-xs font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    >
                      Mark read
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}
