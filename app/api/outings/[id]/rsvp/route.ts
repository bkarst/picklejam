/**
 * /api/outings/[id]/rsvp — RSVP to an outing (PRD §6.7).
 *
 * POST   → RSVP with a status (going/maybe/declined) + optional guest count. A
 *          `going` RSVP is capacity-aware: full ⇒ waitlisted at the next position
 *          (no oversell — the data layer's conditional counter is the gate).
 * DELETE → cancel the caller's RSVP (promotes the waitlist head if a spot frees).
 *
 * Both require auth.
 */

import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/verify";
import { getOutingMeta, rsvp, cancelRsvp } from "@/lib/data/outings";
import { canAccessPrivateOuting } from "@/lib/outings/access";
import { notifyRsvpChange } from "@/lib/outings/notify";
import { outingPath } from "@/lib/urls";
import { guarded, bad, jsonBody } from "@/app/api/_util";
import type { RsvpStatus } from "@/lib/db/types";

export const dynamic = "force-dynamic";

/** Statuses a client may request; `waitlist` is assigned by the server, not chosen. */
const REQUESTABLE: RsvpStatus[] = ["going", "maybe", "declined"];
const MAX_GUESTS = 8;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return guarded(async () => {
    const { id } = await ctx.params;
    const user = await requireAuth(req);

    const body = await jsonBody(req);
    const status = body.status as RsvpStatus;
    if (!REQUESTABLE.includes(status)) bad("status must be one of going, maybe, declined");

    let guestCount: number | undefined;
    if (body.guestCount !== undefined && body.guestCount !== null) {
      if (typeof body.guestCount !== "number" || !Number.isInteger(body.guestCount) || body.guestCount < 0) {
        bad("guestCount must be a non-negative integer");
      }
      if ((body.guestCount as number) > MAX_GUESTS) bad(`guestCount must be ≤ ${MAX_GUESTS}`);
      guestCount = body.guestCount as number;
    }

    const outing = await getOutingMeta(id);
    if (!outing) bad("Outing not found", 404);

    // Visibility gate (§6.7): the shared private-outing access rule (organizer /
    // invite token / active host-group member) — see lib/outings/access.
    const token = typeof body.inviteToken === "string" ? body.inviteToken : undefined;
    if (!(await canAccessPrivateOuting(outing!, user.uid, token))) {
      bad("This is a private game — an invite is required to RSVP", 403);
    }

    const result = await rsvp(id, user.uid, status, guestCount);

    // Fan the change out to the organizer + host-group members (§9.3) — only on a
    // genuine transition (never a re-submit no-op), and never failing the RSVP.
    if (result.changed && result.rsvp.status !== result.previousStatus) {
      try {
        await notifyRsvpChange({
          outing: outing!,
          actorUid: user.uid,
          status: result.rsvp.status,
        });
      } catch (err) {
        console.error("[rsvp] notification fan-out failed (swallowed)", err);
      }
      revalidatePath(outingPath(id)); // the detail page's attendee lists are ISR
    }
    return Response.json(result);
  });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return guarded(async () => {
    const { id } = await ctx.params;
    const user = await requireAuth(req);
    const result = await cancelRsvp(id, user.uid);
    if (!result) return Response.json({ ok: true }); // nothing to cancel

    try {
      await notifyRsvpChange({
        outing: result.outing,
        actorUid: user.uid,
        status: result.rsvp.status,
        canceled: true,
      });
    } catch (err) {
      console.error("[rsvp] cancel notification fan-out failed (swallowed)", err);
    }
    revalidatePath(outingPath(id));

    // Respond WITHOUT the META — it carries the private inviteToken.
    const { rsvp: canceled, goingCount, waitlistCount } = result;
    return Response.json({ rsvp: canceled, goingCount, waitlistCount });
  });
}
