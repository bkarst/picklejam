import "server-only";

/**
 * notify.ts — outing notification fan-outs (PRD §9.3, §6.7/§6.9).
 *
 * Two audiences, one module:
 *   • RSVP changes → the organizer + the host group's active members ("see when
 *     members RSVP / can't make it"). The actor IS named — the audience is the
 *     member's own group.
 *   • Event check-ins → the same group audience PLUS the court's followers
 *     (`getCourtFollowers`, the §9.3 fan-out rail). Check-in copy is ANONYMOUS —
 *     "A player" — regardless of who checked in (§6.2).
 *
 * Every entry point is failure-isolated by the callers (fire-and-forget after
 * the durable write) and per-recipient isolated inside `fanOut`.
 */

import { fanOut, type NotifyTemplate } from "@/lib/notify";
import { getActiveMemberUids } from "@/lib/data/groups";
import { getCourtFollowers } from "@/lib/data/follows";
import { getUserProfile } from "@/lib/data/users";
import { outingPath } from "@/lib/urls";
import type { OutingItem, RsvpStatus } from "@/lib/db/types";

/** Follower fan-out ceiling — bounds one check-in's write amplification. */
const MAX_FOLLOWER_FANOUT = 500;

/**
 * When an event starts, in its own zone — the shared formatter for every
 * outing-notification body (RSVP change, reminder ask).
 */
export function whenLine(
  startTs: string,
  tz?: string,
  weekday: "short" | "long" = "short",
): string {
  return new Date(startTs).toLocaleString("en-US", {
    weekday,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(tz ? { timeZone: tz } : {}),
  });
}

/** The organizer + active group members (deduped), excluding the actor. */
async function rsvpAudience(outing: OutingItem, excludeUid: string): Promise<string[]> {
  const uids = new Set<string>([outing.organizerId]);
  if (outing.hostType === "GROUP" && outing.groupId) {
    for (const uid of await getActiveMemberUids(outing.groupId)) uids.add(uid);
  }
  uids.delete(excludeUid);
  return [...uids];
}

/** Human phrasing for each RSVP transition (title fragment after the name). */
function rsvpPhrase(status: RsvpStatus, canceled: boolean): string {
  if (canceled) return "canceled their RSVP for";
  switch (status) {
    case "going":
      return "is going to";
    case "waitlist":
      return "joined the waitlist for";
    case "maybe":
      return "might come to";
    case "declined":
      return "can't make it to";
  }
}

/**
 * Fan an RSVP change out to the organizer + host-group members (`outing_rsvp`).
 * Call AFTER the RSVP is durable; only on a genuine status transition.
 */
export async function notifyRsvpChange(opts: {
  outing: OutingItem;
  actorUid: string;
  status: RsvpStatus;
  /** True for a DELETE (RSVP removed) rather than a status change. */
  canceled?: boolean;
}): Promise<void> {
  const { outing, actorUid, status, canceled = false } = opts;
  // Independent reads — one Query (audience) + one GetItem (actor) in parallel.
  const [recipients, actor] = await Promise.all([
    rsvpAudience(outing, actorUid),
    getUserProfile(actorUid),
  ]);
  if (recipients.length === 0) return;

  const name = actor?.displayName ?? "A player";
  const template: NotifyTemplate = {
    type: "outing_rsvp",
    title: `${name} ${rsvpPhrase(status, canceled)} ${outing.title}`,
    body: whenLine(outing.startTs, outing.tz),
    entityRef: outingPath(outing.outingId),
  };
  await fanOut(recipients, () => template);
}

/**
 * Fan an EVENT CHECK-IN out (`outing_checkin`) — the host group's members and
 * the court's followers both hear "a player arrived"; nobody hears WHO (§6.2
 * anonymity: the copy never names the player, even for identified check-ins).
 */
export async function notifyEventCheckin(opts: {
  outing: OutingItem;
  courtName: string;
  actorUid: string;
}): Promise<void> {
  const { outing, courtName, actorUid } = opts;

  // Both audiences are independent Queries — fetch in parallel (response path).
  const [groupUids, allFollowers] = await Promise.all([
    outing.hostType === "GROUP" && outing.groupId
      ? getActiveMemberUids(outing.groupId)
      : Promise.resolve([]),
    getCourtFollowers(outing.courtId),
  ]);
  const groupSet = new Set(groupUids);
  groupSet.delete(actorUid);

  // Court followers, minus the actor and anyone already notified via the group.
  const followers = allFollowers
    .filter((uid) => uid !== actorUid && !groupSet.has(uid))
    .slice(0, MAX_FOLLOWER_FANOUT);

  const groupTemplate: NotifyTemplate = {
    type: "outing_checkin",
    title: `A player checked in for ${outing.title}`,
    body: `They just arrived at ${courtName}.`,
    entityRef: outingPath(outing.outingId),
  };
  const followerTemplate: NotifyTemplate = {
    type: "outing_checkin",
    title: `Check-in at ${courtName}`,
    body: `A player arrived for ${outing.title}.`,
    entityRef: outingPath(outing.outingId),
  };

  await Promise.all([
    fanOut([...groupSet], () => groupTemplate),
    fanOut(followers, () => followerTemplate),
  ]);
}
