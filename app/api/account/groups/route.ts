/**
 * GET /api/account/groups — the caller's groups (PRD §6.9, pattern 27).
 *
 * One Query on GSI1 (`USER#<uid>` / `GROUPMEMBER#`) for the memberships, then a
 * BatchGet to hydrate the group METAs. Returns each group + the caller's role/status
 * (the flat `MyGroup` shape the `useMyGroups` hook expects). Requires auth.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { getMyGroups } from "@/lib/data/groups";
import { guarded } from "@/app/api/_util";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const memberships = await getMyGroups(user.uid);
    const groups = memberships.map(({ group, membership }) => ({
      group,
      role: membership.role,
      status: membership.status,
    }));
    return Response.json({ groups });
  });
}
