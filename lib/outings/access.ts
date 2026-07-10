import "server-only";

/**
 * access.ts — the private-outing access rule (§6.7), in ONE place.
 *
 * A PRIVATE outing is actionable (RSVP, event check-in, …) only by its
 * organizer, a holder of the invite token, or — for a group meet-up — an
 * active member of the host group. Public/unlisted outings are open to any
 * signed-in player. Routes call this and supply their own 403 copy.
 */

import { getGroupMember } from "@/lib/data/groups";
import type { OutingItem } from "@/lib/db/types";

export async function canAccessPrivateOuting(
  outing: OutingItem,
  uid: string,
  inviteToken?: string,
): Promise<boolean> {
  if (outing.visibility !== "private") return true;
  if (outing.organizerId === uid) return true;
  if (outing.inviteToken && inviteToken === outing.inviteToken) return true;
  if (outing.hostType === "GROUP" && outing.groupId) {
    const member = await getGroupMember(outing.groupId, uid);
    if (member?.status === "active") return true;
  }
  return false;
}
