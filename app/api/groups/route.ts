/**
 * POST /api/groups — create a group / club (PRD §6.9).
 *
 * Requires auth; the caller becomes the owner. Private + invite-only by default.
 * Writes GROUP META + the creator's owner MEMBER + a COURT→GROUP pointer for the
 * home court AND each extra court in ONE atomic transaction (N15) via `createGroup`.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { getCourt } from "@/lib/data/courts";
import { createGroup, type CreateGroupInput } from "@/lib/data/groups";
import { guarded, bad, jsonBody } from "@/app/api/_util";
import { mapGroupErrors } from "./_util";
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

export async function POST(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const body = await jsonBody(req);

    const nameRaw = body.name;
    if (typeof nameRaw !== "string" || !nameRaw.trim()) bad("name is required");
    const name = (nameRaw as string).trim().slice(0, MAX_NAME);

    const cityKey = body.cityKey;
    if (typeof cityKey !== "string" || !cityKey.trim()) bad("cityKey is required");

    const visibility =
      body.visibility === undefined ? undefined : (body.visibility as GroupVisibility);
    if (visibility !== undefined && !VISIBILITIES.includes(visibility)) bad("Invalid visibility");
    const joinPolicy =
      body.joinPolicy === undefined ? undefined : (body.joinPolicy as GroupJoinPolicy);
    if (joinPolicy !== undefined && !JOIN_POLICIES.includes(joinPolicy)) bad("Invalid joinPolicy");

    const homeCourtId = typeof body.homeCourtId === "string" ? body.homeCourtId : undefined;
    if (homeCourtId && !(await getCourt(homeCourtId))) bad("homeCourtId court not found", 404);

    const courtIds = Array.isArray(body.courtIds)
      ? body.courtIds.filter((c): c is string => typeof c === "string")
      : undefined;

    const description =
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim().slice(0, MAX_DESC)
        : undefined;

    let maxMembers: number | undefined;
    if (body.maxMembers !== undefined) {
      const n = Number(body.maxMembers);
      if (!isValidGroupMaxMembers(n)) bad(MAX_MEMBERS_ERR);
      maxMembers = n;
    }

    const input: CreateGroupInput = {
      name,
      creatorId: user.uid,
      cityKey: (cityKey as string).trim(),
      ...(homeCourtId !== undefined ? { homeCourtId } : {}),
      ...(courtIds !== undefined ? { courtIds } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(visibility !== undefined ? { visibility } : {}),
      ...(joinPolicy !== undefined ? { joinPolicy } : {}),
      ...(maxMembers !== undefined ? { maxMembers } : {}),
      ...(typeof body.avatarUrl === "string" ? { avatarUrl: body.avatarUrl } : {}),
    };

    const group = await mapGroupErrors(() => createGroup(input));
    return Response.json(group, { status: 201 });
  });
}
