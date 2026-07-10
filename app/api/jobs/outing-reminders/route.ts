/**
 * POST/GET /api/jobs/outing-reminders — the pre-event RSVP reminder sweep
 * (§6.7/§9.3; a §G13.3-style ops hook). Point ANY scheduler at this route
 * (Vercel cron, EventBridge → HTTPS, GitHub Actions schedule, plain crontab):
 *
 *   curl -X POST -H "authorization: Bearer $CRON_SECRET" \
 *     https://<host>/api/jobs/outing-reminders
 *
 * Auth: `CRON_SECRET` (Bearer or `x-cron-secret`). REQUIRED whenever set and
 * always in Production; in dev/test an unset secret leaves the route open so
 * local runs don't need ceremony. Concurrency-safe (the queue row's conditional
 * delete is the claim gate) — overlapping schedules never double-send.
 */

import type { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { APP_ENV } from "@/lib/env";
import { sendDueOutingReminders } from "@/lib/jobs/outing-reminders";

export const dynamic = "force-dynamic";

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function authorize(req: NextRequest): Response | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    if (APP_ENV === "Production") {
      return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
    }
    return null; // dev/test convenience: open when no secret is configured
  }
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : undefined;
  const provided = bearer ?? req.headers.get("x-cron-secret") ?? "";
  if (!provided || !secretsMatch(provided, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

async function run(req: NextRequest): Promise<Response> {
  const denied = authorize(req);
  if (denied) return denied;
  const stats = await sendDueOutingReminders();
  return Response.json(stats);
}

export async function POST(req: NextRequest): Promise<Response> {
  return run(req);
}

/** Some cron providers can only GET — same guard, same sweep. */
export async function GET(req: NextRequest): Promise<Response> {
  return run(req);
}
