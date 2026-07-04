/**
 * notifications.ts — the notification rail data layer (PRD §9.3 Notifications).
 *
 * Every read is ONE `Query`/`GetItem` (no scans, no joins). A notification is a
 * `NOTIF#<ts>#<id>` row on the owner's `USER#<uid>` partition; GSI1 (also keyed
 * `USER#<uid>`) projects the same rows so "my notifications, newest-first"
 * resolves in a single Query on GSI1 (§9.5). Stamps: `ts`/`id` are stored as
 * plain attributes (alongside the key) so the client can mark a single row read
 * with `{id, ts}` without parsing the sort key.
 *
 * The email mirror + fan-out live in `lib/notify.ts` (server-only) on top of
 * `createNotification` here — this module never sends mail.
 */

import { ulid } from "ulid";
import { query, queryAll, putItem, updateItem } from "@/lib/db/client";
import { GSI } from "@/lib/db/table";
import { notifKeys, userKeys } from "@/lib/db/keys";
import { getUserProfile } from "@/lib/data/users";
import type { NotificationItem, NotificationType, NotifPrefs } from "@/lib/db/types";

/** The content of a notification (everything but keys/stamps). */
export interface NotificationInput {
  type: NotificationType;
  title: string;
  body?: string;
  /** Deep-link target (e.g. a court/outing URL). */
  entityRef?: string;
}

/**
 * A persisted notification carries its `id`/`ts` as first-class attributes (not
 * only encoded in the sort key) so the client can address a single row for
 * mark-read without parsing keys.
 */
export interface StoredNotification extends NotificationItem {
  id: string;
  ts: string;
}

const DEFAULT_LIST_LIMIT = 30;

/** Build a fully-keyed NOTIF row (base key + GSI1 projection). Pure + injectable. */
export function buildNotificationItem(
  uid: string,
  input: NotificationInput,
  opts?: { now?: Date; id?: string },
): StoredNotification {
  const id = opts?.id ?? ulid();
  const ts = (opts?.now ?? new Date()).toISOString();
  return {
    ...notifKeys.notif(uid, ts, id),
    entity: "NOTIF",
    uid,
    id,
    ts,
    type: input.type,
    title: input.title,
    ...(input.body !== undefined ? { body: input.body } : {}),
    ...(input.entityRef !== undefined ? { entityRef: input.entityRef } : {}),
    readAt: null,
    channelsSent: ["inapp"],
    createdAt: ts,
    updatedAt: ts,
  };
}

/** Create + persist an in-app notification (the source of truth for the rail). */
export async function createNotification(
  uid: string,
  input: NotificationInput,
  opts?: { now?: Date; id?: string },
): Promise<StoredNotification> {
  const item = buildNotificationItem(uid, input, opts);
  await putItem(item as unknown as Record<string, unknown>);
  return item;
}

/** #— my notifications, newest-first — ONE Query on GSI1 (`USER#<uid>` / `NOTIF#`). */
export async function getMyNotifications(
  uid: string,
  limit = DEFAULT_LIST_LIMIT,
): Promise<StoredNotification[]> {
  const { items } = await query<StoredNotification>({
    index: GSI.byOwner,
    pk: notifKeys.notif(uid, "", "").gsi1pk,
    skBeginsWith: notifKeys.notifPrefix(),
    ascending: false, // newest-first
    limit,
  });
  return items;
}

/**
 * Filter matching an UNREAD row: `readAt` absent OR of the NULL type. (A row is
 * created with `readAt: null` and set to an ISO string when read, so a read row's
 * `readAt` is a String and is excluded.) `attribute_type` avoids the ambiguity of
 * comparing against a NULL value with `=`.
 */
const UNREAD_FILTER = {
  expression: "attribute_not_exists(#ra) OR attribute_type(#ra, :nullType)",
  names: { "#ra": "readAt" },
  values: { ":nullType": "NULL" },
} as const;

/**
 * Unread count — ONE Query on GSI1 with an unread filter (a filter is not a scan;
 * the Query is still keyed to the user's partition). Projects only the sort key
 * to keep the payload small. Counts the current page (a personal feed is bounded;
 * TODO: switch to `Select: COUNT` + pagination if a feed ever exceeds one page).
 */
export async function getUnreadCount(uid: string): Promise<number> {
  const { items } = await query<{ sk: string }>({
    index: GSI.byOwner,
    pk: notifKeys.notif(uid, "", "").gsi1pk,
    skBeginsWith: notifKeys.notifPrefix(),
    filter: UNREAD_FILTER,
    projection: ["sk"],
  });
  return items.length;
}

/** Mark a single notification read (idempotent; a missing row is a no-op). */
export async function markRead(uid: string, notifId: string, ts: string): Promise<void> {
  const now = new Date().toISOString();
  try {
    await updateItem({
      key: notifKeys.notif(uid, ts, notifId),
      update: "SET readAt = :now, updatedAt = :now",
      values: { ":now": now },
      condition: "attribute_exists(pk)",
    });
  } catch (err) {
    if (isConditionalFailure(err)) return; // unknown/deleted id → no-op
    throw err;
  }
}

/** Mark every unread notification read. Returns how many were flipped. */
export async function markAllRead(uid: string): Promise<number> {
  // Sweep EVERY unread row, not just the first 1 MB page (L12). The unread filter is applied
  // AFTER each page, so a single `query` leaves any unread rows on later pages permanently
  // unread — `queryAll` follows `LastEvaluatedKey` until the whole feed is covered.
  const items = await queryAll<{ pk: string; sk: string }>({
    index: GSI.byOwner,
    pk: notifKeys.notif(uid, "", "").gsi1pk,
    skBeginsWith: notifKeys.notifPrefix(),
    filter: UNREAD_FILTER,
    projection: ["pk", "sk"],
  });
  const now = new Date().toISOString();
  await Promise.all(
    items.map((it) =>
      updateItem({
        key: { pk: it.pk, sk: it.sk },
        update: "SET readAt = :now, updatedAt = :now",
        values: { ":now": now },
      }),
    ),
  );
  return items.length;
}

// ── alert preferences (on the USER/PROFILE item) ─────────────────────────────

/** The caller's notification prefs (GetItem on the profile; `{}` when unset). */
export async function getNotifPrefs(uid: string): Promise<NotifPrefs> {
  const profile = await getUserProfile(uid);
  return profile?.notifPrefs ?? {};
}

/** Persist notification prefs (per-type × channel + quiet hours) onto the profile. */
export async function updateNotifPrefs(uid: string, prefs: NotifPrefs): Promise<NotifPrefs> {
  await updateItem({
    key: userKeys.profile(uid),
    update: "SET notifPrefs = :p, updatedAt = :now",
    values: { ":p": prefs, ":now": new Date().toISOString() },
  });
  return prefs;
}

/**
 * Add an email to the profile's suppression list (one-click unsubscribe → §6.3).
 * Read-modify-write to dedupe (unsubscribes are rare, so no need for list_append
 * races). A missing profile is a no-op (nothing to suppress against).
 */
export async function addUnsubscribe(uid: string, email: string): Promise<void> {
  const profile = await getUserProfile(uid);
  if (!profile) return;
  const lower = email.toLowerCase();
  const existing = profile.unsubscribed ?? [];
  if (existing.some((e) => e.toLowerCase() === lower)) return;
  await updateItem({
    key: userKeys.profile(uid),
    update: "SET unsubscribed = :u, updatedAt = :now",
    values: { ":u": [...existing, email], ":now": new Date().toISOString() },
  });
}

/** True if a DynamoDB error is a conditional-check failure. */
function isConditionalFailure(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: string }).name === "ConditionalCheckFailedException"
  );
}
