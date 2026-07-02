/**
 * /api/outings/[id] — organizer-only edit / delete of an outing (PRD §6.7).
 *
 * PUT    → edit the outing's non-key fields (title, description, skill, capacity…).
 * DELETE → remove the outing + its pointers (atomic).
 *
 * Both require auth AND that the caller is the organizer (`organizerId === uid`),
 * else 403. Changing the court / start time / visibility is out of scope (recreate).
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import {
  getOutingMeta,
  updateOuting,
  deleteOuting,
  type UpdateOutingInput,
} from "@/lib/data/outings";
import { guarded, bad, jsonBody } from "@/app/api/_util";

export const dynamic = "force-dynamic";

const MAX_TITLE = 140;
const MAX_DESC = 4000;

async function requireOrganizer(req: NextRequest, outingId: string) {
  const user = await requireAuth(req);
  const outing = await getOutingMeta(outingId);
  if (!outing) bad("Outing not found", 404);
  if (outing!.organizerId !== user.uid) bad("Only the organizer can modify this outing", 403);
  return { user, outing: outing! };
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return guarded(async () => {
    const { id } = await ctx.params;
    await requireOrganizer(req, id);
    const body = await jsonBody(req);

    const patch: UpdateOutingInput = {};
    if (typeof body.title === "string" && body.title.trim()) {
      patch.title = body.title.trim().slice(0, MAX_TITLE);
    }
    if (typeof body.description === "string") {
      patch.description = body.description.trim().slice(0, MAX_DESC);
    }
    if (typeof body.skillMin === "number") patch.skillMin = body.skillMin;
    if (typeof body.skillMax === "number") patch.skillMax = body.skillMax;
    if (typeof body.capacity === "number") {
      if (!Number.isInteger(body.capacity) || body.capacity < 1) bad("capacity must be a positive integer");
      patch.capacity = body.capacity;
    }
    if (typeof body.waitlist === "boolean") patch.waitlist = body.waitlist;
    if (body.guestPolicy === "allowed" || body.guestPolicy === "none") patch.guestPolicy = body.guestPolicy;
    if (typeof body.endTs === "string" && body.endTs.trim()) {
      if (Number.isNaN(Date.parse(body.endTs))) bad("endTs must be an ISO date-time");
      patch.endTs = body.endTs;
    }

    if (Object.keys(patch).length === 0) bad("No editable fields provided");

    const updated = await updateOuting(id, patch);
    return Response.json(updated);
  });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return guarded(async () => {
    const { id } = await ctx.params;
    await requireOrganizer(req, id);
    await deleteOuting(id);
    return Response.json({ ok: true });
  });
}
