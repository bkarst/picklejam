/**
 * /api/groups/[id] — group detail (GET), settings (PATCH), owner delete (DELETE).
 * PRD §6.9, pattern 26.
 *
 * GET returns the per-viewer overlay `{ group, membership, members, memberCount }`
 * from ONE Query. Visibility gate: public/unlisted are viewable by anyone (unlisted
 * just isn't listed in finders); a PRIVATE group is members-only (404 otherwise, so
 * it stays invisible). Member identities respect each member's `checkinVisibility`.
 *
 * PATCH updates settings (owner/admin, guarded in the data layer → 403).
 * DELETE removes the whole group + members + court pointers (owner only).
 */

import type { NextRequest } from "next/server";
import { requireAuth, verifyRequest } from "@/lib/auth/verify";
import {
  getGroup,
  updateGroup,
  deleteGroup,
  type UpdateGroupInput,
} from "@/lib/data/groups";
import { getGroupBoard } from "@/lib/data/gamify-boards";
import { guarded, bad, jsonBody } from "@/app/api/_util";
import { mapGroupErrors } from "../_util";
import {
  MIN_GROUP_MAX_MEMBERS,
  MAX_GROUP_MAX_MEMBERS,
  isValidGroupMaxMembers,
} from "@/lib/groups/limits";
import type { GroupVisibility, GroupJoinPolicy } from "@/lib/db/types";

export const dynamic = "force-dynamic";

const MAX_NAME = 120;
const MAX_DESC = 4000;
const VISIBILITIES: GroupVisibility[] = ["private", "unlisted", "public"];
const JOIN_POLICIES: GroupJoinPolicy[] = ["invite", "request", "open"];
const MAX_MEMBERS_ERR = `maxMembers must be an integer between ${MIN_GROUP_MAX_MEMBERS} and ${MAX_GROUP_MAX_MEMBERS}`;

async function optionalUid(req: NextRequest): Promise<string | undefined> {
  try {
    return (await verifyRequest(req)).uid;
  } catch {
    return undefined;
  }
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return guarded(async () => {
    const { id } = await ctx.params;
    const uid = await optionalUid(req);

    const detail = await mapGroupErrors(() => getGroup(id));
    if (!detail) bad("Group not found", 404);

    const { group, members, meetups, courts } = detail!;
    const mine = uid ? members.find((m) => m.uid === uid) : undefined;
    const isMember = mine?.status === "active";

    // A private group is invisible to non-members (same 404 as a missing group).
    if (group.visibility === "private" && !isMember) bad("Group not found", 404);

    // Flatten the data layer's privacy-respecting `HydratedGroupMember` (nested
    // `profile`, WITHHELD for members who keep check-ins private) to the client's
    // flat `GroupMemberView` wire shape. A withheld member keeps their seat with a
    // placeholder display name and no username/avatar.
    const memberViews = members.map((m) => ({
      uid: m.uid,
      role: m.role,
      status: m.status,
      displayName: m.profile?.displayName ?? "Pickleball player",
      ...(m.profile?.username !== undefined ? { username: m.profile.username } : {}),
      ...(m.profile?.avatarUrl !== undefined ? { avatarUrl: m.profile.avatarUrl } : {}),
      ...(m.joinedAt !== undefined ? { joinedAt: m.joinedAt } : {}),
    }));

    // The "This month" RP board (§G12.13) is members-only — never in the shared ISR shell.
    const board = isMember ? await getGroupBoard(memberViews, uid, Date.now()) : undefined;

    return Response.json({
      group,
      membership: mine ? { role: mine.role, status: mine.status } : null,
      // The roster (member identities) is MEMBERS-ONLY (§6.9): a non-member receives
      // only the count (`memberCount`), never the member list.
      members: isMember ? memberViews : [],
      memberCount: group.memberCount,
      ...(board ? { board } : {}),
      // Meet-ups (+ their court refs) are MEMBERS-ONLY (§6.9): a non-member never
      // receives a group's schedule — not baked into the shared ISR shell, and
      // withheld here too, so place/time never reach a non-member's browser.
      meetups: isMember ? meetups : [],
      courts: isMember ? courts : {},
    });
  });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return guarded(async () => {
    const { id } = await ctx.params;
    const user = await requireAuth(req);
    const body = await jsonBody(req);

    const patch: UpdateGroupInput = {};
    if (typeof body.name === "string" && body.name.trim()) {
      patch.name = body.name.trim().slice(0, MAX_NAME);
    }
    if (typeof body.description === "string") {
      patch.description = body.description.trim().slice(0, MAX_DESC);
    }
    if (body.visibility !== undefined) {
      if (!VISIBILITIES.includes(body.visibility as GroupVisibility)) bad("Invalid visibility");
      patch.visibility = body.visibility as GroupVisibility;
    }
    if (body.joinPolicy !== undefined) {
      if (!JOIN_POLICIES.includes(body.joinPolicy as GroupJoinPolicy)) bad("Invalid joinPolicy");
      patch.joinPolicy = body.joinPolicy as GroupJoinPolicy;
    }
    if (body.maxMembers !== undefined) {
      const n = Number(body.maxMembers);
      if (!isValidGroupMaxMembers(n)) bad(MAX_MEMBERS_ERR);
      patch.maxMembers = n;
    }
    if (body.homeCourtId === null || typeof body.homeCourtId === "string") {
      patch.homeCourtId = body.homeCourtId as string | null;
    }
    if (Array.isArray(body.courtIds)) {
      patch.courtIds = body.courtIds.filter((c): c is string => typeof c === "string");
    }
    if (typeof body.avatarUrl === "string") patch.avatarUrl = body.avatarUrl;

    if (Object.keys(patch).length === 0) bad("No editable fields provided");

    const updated = await mapGroupErrors(() => updateGroup(id, user.uid, patch));
    return Response.json(updated);
  });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  return guarded(async () => {
    const { id } = await ctx.params;
    const user = await requireAuth(req);
    await mapGroupErrors(() => deleteGroup(id, user.uid));
    return Response.json({ ok: true });
  });
}
