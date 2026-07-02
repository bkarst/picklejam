"use client";

/**
 * notifications.ts — the client API layer for the notification rail (PRD §9.3).
 *
 * Every hook goes through {@link useAuthedFetch} (attaches the Bearer + JSON
 * headers, throws `ApiError` on non-2xx) so `requireAuth` verifies each write.
 * Reads are gated on a signed-in user and deliberately cheap: no refetch on
 * window focus (a bell doesn't need to be that live). Mark-read is optimistic —
 * the unread badge updates instantly and rolls back if the write fails.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthedFetch } from "@/lib/api/authed";
import type { NotificationItem, NotifPrefs } from "@/lib/db/types";

/** A notification as returned by the API (carries `id`/`ts` for mark-read). */
export interface NotificationView extends NotificationItem {
  id: string;
  ts: string;
}

export interface NotificationsResponse {
  notifications: NotificationView[];
  unreadCount: number;
}

export interface AlertPrefsResponse {
  notifPrefs: NotifPrefs;
}

/** Query-key roots — mutations invalidate these to refresh the rail / prefs. */
export const notificationKeys = {
  all: ["notifications"] as const,
  list: ["notifications", "list"] as const,
  alertPrefs: ["notifications", "alert-prefs"] as const,
};

const NOTIFICATIONS_URL = "/api/account/notifications";
const ALERTS_URL = "/api/account/alerts";

/** Recent notifications + unread count. Enabled only when signed in; focus-refetch off. */
export function useNotifications(opts?: { enabled?: boolean }) {
  const authed = useAuthedFetch();
  const { user } = useAuth();
  const enabled = (opts?.enabled ?? true) && !!user;
  return useQuery<NotificationsResponse>({
    queryKey: notificationKeys.list,
    queryFn: () => authed<NotificationsResponse>(NOTIFICATIONS_URL),
    enabled,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });
}

/** Mark ONE notification read (optimistic). */
export function useMarkRead() {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, { id: string; ts: string }>({
    mutationFn: (body) =>
      authed<{ ok: boolean }>(NOTIFICATIONS_URL, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: notificationKeys.list });
      const prev = qc.getQueryData<NotificationsResponse>(notificationKeys.list);
      if (prev) {
        const now = new Date().toISOString();
        let unread = prev.unreadCount;
        const notifications = prev.notifications.map((n) => {
          if (n.id === id && !n.readAt) {
            unread = Math.max(0, unread - 1);
            return { ...n, readAt: now };
          }
          return n;
        });
        qc.setQueryData<NotificationsResponse>(notificationKeys.list, {
          notifications,
          unreadCount: unread,
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      const prev = (ctx as { prev?: NotificationsResponse } | undefined)?.prev;
      if (prev) qc.setQueryData(notificationKeys.list, prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: notificationKeys.list });
    },
  });
}

/** Mark ALL notifications read (optimistic). */
export function useMarkAllRead() {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<{ ok: boolean; marked: number }, Error, void>({
    mutationFn: () =>
      authed<{ ok: boolean; marked: number }>(NOTIFICATIONS_URL, {
        method: "POST",
        body: JSON.stringify({ all: true }),
      }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: notificationKeys.list });
      const prev = qc.getQueryData<NotificationsResponse>(notificationKeys.list);
      if (prev) {
        const now = new Date().toISOString();
        qc.setQueryData<NotificationsResponse>(notificationKeys.list, {
          notifications: prev.notifications.map((n) => (n.readAt ? n : { ...n, readAt: now })),
          unreadCount: 0,
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      const prev = (ctx as { prev?: NotificationsResponse } | undefined)?.prev;
      if (prev) qc.setQueryData(notificationKeys.list, prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: notificationKeys.list });
    },
  });
}

/** The caller's notification preferences (per-type × channel + quiet hours). */
export function useAlertPrefs(opts?: { enabled?: boolean }) {
  const authed = useAuthedFetch();
  const { user } = useAuth();
  const enabled = (opts?.enabled ?? true) && !!user;
  return useQuery<NotifPrefs>({
    queryKey: notificationKeys.alertPrefs,
    queryFn: async () => (await authed<AlertPrefsResponse>(ALERTS_URL)).notifPrefs,
    enabled,
  });
}

/** Update notification preferences (PUT). Invalidates the prefs cache on success. */
export function useUpdateAlertPrefs() {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  return useMutation<NotifPrefs, Error, NotifPrefs>({
    mutationFn: async (notifPrefs) =>
      (
        await authed<AlertPrefsResponse>(ALERTS_URL, {
          method: "PUT",
          body: JSON.stringify({ notifPrefs }),
        })
      ).notifPrefs,
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: notificationKeys.alertPrefs });
      const prev = qc.getQueryData<NotifPrefs>(notificationKeys.alertPrefs);
      qc.setQueryData<NotifPrefs>(notificationKeys.alertPrefs, next);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      const prev = (ctx as { prev?: NotifPrefs } | undefined)?.prev;
      if (prev !== undefined) qc.setQueryData(notificationKeys.alertPrefs, prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: notificationKeys.alertPrefs });
    },
  });
}
