/**
 * /api/account/notifications — the caller's notification rail (PRD §9.3).
 *
 * GET  → recent notifications (newest-first) + the unread count.
 * POST → mark read: body `{ id, ts }` (one) or `{ all: true }` (everything).
 *
 * Both require auth (per-user data); `requireAuth` 401s propagate via `guarded`.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import {
  getMyNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
} from "@/lib/data/notifications";
import { guarded, bad, jsonBody } from "../_util";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 50;

export async function GET(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const limitParam = Number(req.nextUrl.searchParams.get("limit"));
    const limit =
      Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_LIMIT) : undefined;
    const [notifications, unreadCount] = await Promise.all([
      getMyNotifications(user.uid, limit),
      getUnreadCount(user.uid),
    ]);
    return Response.json({ notifications, unreadCount });
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const body = await jsonBody(req);

    if (body.all === true) {
      const marked = await markAllRead(user.uid);
      return Response.json({ ok: true, marked });
    }

    const { id, ts } = body;
    if (typeof id !== "string" || !id || typeof ts !== "string" || !ts) {
      bad("provide { id, ts } to mark one notification read, or { all: true }");
    }
    await markRead(user.uid, id as string, ts as string);
    return Response.json({ ok: true });
  });
}
