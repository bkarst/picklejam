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
import { requireAuth } from "@/lib/auth/verify";
import { getOutingMeta, rsvp, cancelRsvp } from "@/lib/data/outings";
import { getGroupMember } from "@/lib/data/groups";
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

    // Visibility gate (§6.7): a PRIVATE game is RSVP-able only by the organizer, a
    // holder of the invite token, or (for a group meet-up) an active member of the
    // host group. Public/unlisted games are open to any signed-in player.
    if (outing!.visibility === "private") {
      const isOrganizer = outing!.organizerId === user.uid;
      const token = typeof body.inviteToken === "string" ? body.inviteToken : undefined;
      const hasInvite = !!outing!.inviteToken && token === outing!.inviteToken;
      let isGroupMember = false;
      if (outing!.hostType === "GROUP" && outing!.groupId) {
        const member = await getGroupMember(outing!.groupId, user.uid);
        isGroupMember = member?.status === "active";
      }
      if (!isOrganizer && !hasInvite && !isGroupMember) {
        bad("This is a private game — an invite is required to RSVP", 403);
      }
    }

    const result = await rsvp(id, user.uid, status, guestCount);
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
    return Response.json(result ?? { ok: true });
  });
}
