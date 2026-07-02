/**
 * /api/account/alerts — the caller's notification preferences (PRD §6.3, §9.3).
 *
 * GET → the caller's `notifPrefs` (per-type × channel + quiet hours), `{}` when unset.
 * PUT → replace `notifPrefs` (validated/normalized) on the profile.
 *
 * Both require auth; `requireAuth` 401s propagate via `guarded`.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { getNotifPrefs, updateNotifPrefs } from "@/lib/data/notifications";
import type { NotificationType, NotifPrefs } from "@/lib/db/types";
import { guarded, bad, jsonBody } from "../_util";

export const dynamic = "force-dynamic";

/** The notification types users can tune (mirrors the `NotificationType` union). */
const NOTIF_TYPES: readonly NotificationType[] = [
  "new_game_at_followed_court",
  "outing_rsvp",
  "review_helpful",
  "system",
];

export async function GET(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const notifPrefs = await getNotifPrefs(user.uid);
    return Response.json({ notifPrefs });
  });
}

export async function PUT(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const body = await jsonBody(req);
    const raw = "notifPrefs" in body ? body.notifPrefs : body;
    const notifPrefs = normalizeNotifPrefs(raw);
    await updateNotifPrefs(user.uid, notifPrefs);
    return Response.json({ notifPrefs });
  });
}

const HHMM = /^\d{2}:\d{2}$/;

/** Validate + normalize an untrusted prefs payload into a clean `NotifPrefs`. */
function normalizeNotifPrefs(raw: unknown): NotifPrefs {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    bad("notifPrefs must be an object");
  }
  const input = raw as Record<string, unknown>;
  const out: NotifPrefs = {};

  if (input.channels !== undefined) {
    if (typeof input.channels !== "object" || input.channels === null) {
      bad("notifPrefs.channels must be an object");
    }
    const channelsIn = input.channels as Record<string, unknown>;
    const channels: NotifPrefs["channels"] = {};
    for (const type of NOTIF_TYPES) {
      const entry = channelsIn[type];
      if (entry === undefined) continue;
      if (typeof entry !== "object" || entry === null) {
        bad(`notifPrefs.channels.${type} must be an object`);
      }
      const e = entry as Record<string, unknown>;
      const normalized: { inapp?: boolean; email?: boolean } = {};
      if ("inapp" in e) {
        if (typeof e.inapp !== "boolean") bad(`channels.${type}.inapp must be a boolean`);
        normalized.inapp = e.inapp;
      }
      if ("email" in e) {
        if (typeof e.email !== "boolean") bad(`channels.${type}.email must be a boolean`);
        normalized.email = e.email;
      }
      channels[type] = normalized;
    }
    out.channels = channels;
  }

  if ("quietHours" in input) {
    const q = input.quietHours;
    if (q === null) {
      out.quietHours = null;
    } else if (typeof q === "object" && !Array.isArray(q)) {
      const { start, end } = q as Record<string, unknown>;
      if (typeof start !== "string" || !HHMM.test(start) || typeof end !== "string" || !HHMM.test(end)) {
        bad("quietHours must be { start: 'HH:mm', end: 'HH:mm' } or null");
      }
      out.quietHours = { start: start as string, end: end as string };
    } else {
      bad("quietHours must be an object or null");
    }
  }

  return out;
}
