/**
 * groups.ts — Groups & Clubs data layer (PRD §6.9, §9.5 patterns 24–28).
 *
 * A group is a persistent community that schedules meet-ups (Outings with
 * `hostType="GROUP"`, written by `createOuting`). Everything for one group lives in
 * ONE partition `GROUP#<groupId>`:
 *   META            → GroupItem          (visibility/joinPolicy + memberCount)
 *   MEMBER#<uid>    → GroupMemberItem     (role + status; GSI1 = my groups)
 *   INVITE#<token>  → GroupInviteItem     (TTL-expiring invite)
 *   MEETUP#<ts>#<id>→ MEETUP pointer       (written by createOuting for group games)
 * plus a COURT→GROUP pointer under `COURT#<courtId>` / `GROUP#<groupId>`
 * (GroupCourtRefItem) so pattern 28 ("groups that play here") is one Query. The
 * pointer + the GSI2 city index PROJECT `visibility` (and GSI2 is only populated for
 * PUBLIC groups), so a private/unlisted group filters out of the public court/city
 * rails in a single pass (§9.5 note) — NEVER even indexed in the city finder.
 *
 * ── Privacy defaults (§6.9) ───────────────────────────────────────────────────
 * Groups are PRIVATE + INVITE-only BY DEFAULT: `visibility="private"`,
 * `joinPolicy="invite"`. A private group is `noindex` and excluded from every
 * public discovery read.
 *
 * ── Composite create (createGroup, N15) ──────────────────────────────────────
 * GROUP META + the creator's owner MEMBER + a COURT→GROUP pointer for the home
 * court AND every extra court are written in ONE `transactWrite` — all-or-nothing.
 * Create-only guards (`attribute_not_exists(pk)`) make the whole composite
 * idempotent by id. On commit we emit the GROUP + pointer inserts so §9.4
 * aggregates reconcile (`counts.groups` on the geo hierarchy + the court
 * `groupCount`). `memberCount` is SEEDED to 1 on META (the creator) and the
 * aggregator owns it thereafter — exactly as `createOuting` seeds `goingCount`.
 *
 * ── Authorization ─────────────────────────────────────────────────────────────
 * Every management op is guarded HERE in the data layer (defence-in-depth on top
 * of the route's `requireAuth`): `requireManager` (owner OR admin, active) gates
 * approve/decline/invite/removeMember/updateGroup; `requireOwner` gates deleteGroup.
 * Each guard is documented at its call site.
 */

import { ulid } from "ulid";
import {
  getItem,
  query,
  putItem,
  putItemReturningOld,
  updateItem,
  deleteItem,
  batchGet,
  transactWrite,
  txPut,
  txDelete,
  type TransactItem,
} from "@/lib/db/client";
import { GSI } from "@/lib/db/table";
import { groupKeys, outingKeys, courtKeys } from "@/lib/db/keys";
import { slugify } from "@/lib/util/slug";
import { sanitizeLine, sanitizeMultiline } from "@/lib/util/sanitize";
import { DEFAULT_GROUP_MAX_MEMBERS } from "@/lib/groups/limits";
import { courtUrl } from "@/lib/urls";
import { emitInsert, emitModify, emitRemove } from "@/lib/streams/inline";
import { createNotification } from "@/lib/data/notifications";
import type {
  GroupItem,
  GroupMemberItem,
  GroupCourtRefItem,
  GroupInviteItem,
  GroupVisibility,
  GroupJoinPolicy,
  GroupMemberRole,
  GroupMemberStatus,
  OutingItem,
  CourtItem,
  UserProfileItem,
} from "@/lib/db/types";

// ── errors (routes map `.status` → HTTP) ─────────────────────────────────────

/** The group doesn't exist → 404. */
export class GroupNotFoundError extends Error {
  readonly status = 404;
  constructor(groupId: string) {
    super(`Group not found: ${groupId}`);
    this.name = "GroupNotFoundError";
  }
}

/** The caller isn't an owner/admin of the group → 403. */
export class GroupPermissionError extends Error {
  readonly status = 403;
  constructor(message = "You do not have permission to manage this group") {
    super(message);
    this.name = "GroupPermissionError";
  }
}

/** A join was refused by policy (invite-only without a token, etc.) → 403. */
export class GroupJoinError extends Error {
  readonly status = 403;
  constructor(message: string) {
    super(message);
    this.name = "GroupJoinError";
  }
}

/** An invite token was missing / invalid / expired → 400. */
export class InviteError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "InviteError";
  }
}

/** A join/approve/accept was refused because the group is at its member cap → 409. */
export class GroupFullError extends Error {
  readonly status = 409;
  constructor(message = "This group is full") {
    super(message);
    this.name = "GroupFullError";
  }
}

/** The effective active-member cap for a group (legacy groups fall back to the default). */
export function groupMemberCap(group: Pick<GroupItem, "maxMembers">): number {
  return group.maxMembers ?? DEFAULT_GROUP_MAX_MEMBERS;
}

/**
 * Guard: refuse a new ACTIVE member when the group is at capacity. Best-effort — it
 * reads the aggregator-owned `memberCount` (eventually consistent in prod), so a
 * burst of exactly-simultaneous joins could overshoot the cap by a hair; for a
 * community group that soft ceiling is the right trade-off vs. re-owning the counter.
 */
function assertHasRoom(group: GroupItem): void {
  if (group.memberCount >= groupMemberCap(group)) throw new GroupFullError();
}

// ── types ────────────────────────────────────────────────────────────────────

export interface CreateGroupInput {
  name: string;
  creatorId: string;
  cityKey: string;
  /** Primary court — always gets a COURT→GROUP pointer (the home-court rail). */
  homeCourtId?: string;
  /** Extra courts the group plays at — each gets its own pointer. */
  courtIds?: string[];
  description?: string;
  visibility?: GroupVisibility; // default "private"
  joinPolicy?: GroupJoinPolicy; // default "invite"
  avatarUrl?: string;
  /** Cap on active members. Defaults to `DEFAULT_GROUP_MAX_MEMBERS` (40). */
  maxMembers?: number;
  // Injectable for deterministic tests.
  groupId?: string;
  slug?: string;
  now?: number;
}

/** A member row hydrated with a PUBLIC profile projection (privacy-respecting). */
export interface HydratedGroupMember {
  uid: string;
  role: GroupMemberRole;
  status: GroupMemberStatus;
  joinedAt?: string;
  /**
   * Public identity projection. Withheld (`undefined`) when the member keeps their
   * check-ins private (`checkinVisibility === "private"`) — the roster still lists
   * the seat (uid/role/status) but never leaks their name/avatar (§6.2/§6.9).
   */
  profile?: { uid: string; username: string; displayName: string; avatarUrl?: string };
}

/** Pattern 26 read: a group + its members, meet-ups, and (manager-only) invites. */
export interface GroupDetail {
  group: GroupItem;
  members: HydratedGroupMember[];
  /** Group meet-ups (the Outings), upcoming first. */
  meetups: OutingItem[];
  /** Outstanding invites (tokens) — routes expose these to owners/admins only. */
  invites: GroupInviteItem[];
  /** Court lookup (name + canonical URL) for the home court + each meet-up's court. */
  courts: Record<string, { name: string; url: string }>;
}

/** getMyGroups row: the group META + the caller's membership in it (pattern 27). */
export interface MyGroupMembership {
  group: GroupItem;
  membership: GroupMemberItem;
}

export interface JoinResult {
  member: GroupMemberItem;
  status: GroupMemberStatus;
}

const asItem = (o: object): Record<string, unknown> => o as unknown as Record<string, unknown>;

/** Default invite lifetime (§14.6 invite TTL). */
const INVITE_TTL_DAYS = 14;

/** Owner + admin are "managers"; only they may administer a group. */
function isManagerRole(role: GroupMemberRole): boolean {
  return role === "owner" || role === "admin";
}

// ── create (composite atomic write, N15) ─────────────────────────────────────

/**
 * Create a group in ONE atomic transaction (N15): GROUP META + the creator's
 * owner MEMBER + a COURT→GROUP pointer for the home court AND each extra court.
 * Private + invite-only by default. GSI2 (city finder) is projected ONLY for
 * PUBLIC groups, and the court pointers project `visibility`, so a private group
 * is never indexed in — nor surfaced by — any public rail (§9.5 note).
 *
 * On commit, emits the GROUP + pointer inserts so §9.4 aggregates reconcile
 * (`counts.groups` up the geo hierarchy + court `groupCount`). `memberCount` is
 * seeded to 1 on META (the creator), so the creator MEMBER is NOT emitted here —
 * the aggregator owns every subsequent join/leave/approve (mirrors `createOuting`).
 */
export async function createGroup(input: CreateGroupInput): Promise<GroupItem> {
  const now = input.now ?? Date.now();
  const iso = new Date(now).toISOString();
  const groupId = input.groupId ?? ulid();
  const visibility: GroupVisibility = input.visibility ?? "private";
  const joinPolicy: GroupJoinPolicy = input.joinPolicy ?? "invite";
  const slug = input.slug ?? `${slugify(input.name)}-${groupId.slice(-6).toLowerCase()}`;
  const isPublic = visibility === "public";

  // De-dupe the court set (home court may also appear in courtIds).
  const courtIds = Array.from(
    new Set([
      ...(input.homeCourtId ? [input.homeCourtId] : []),
      ...(input.courtIds ?? []),
    ]),
  );

  // GROUP META. GSI1 (creator) + GSI3 (slug) always project; GSI2 (city finder)
  // ONLY for PUBLIC groups — the strongest "one pass" exclusion for private groups.
  const group: GroupItem = {
    ...groupKeys.meta(groupId),
    ...groupKeys.byCreator(input.creatorId, iso),
    ...(isPublic ? groupKeys.inCity(groupId, input.cityKey) : {}),
    ...groupKeys.bySlug(slug),
    entity: "GROUP",
    groupId,
    name: sanitizeLine(input.name) || "Untitled group",
    slug,
    ...(input.description !== undefined ? { description: sanitizeMultiline(input.description) } : {}),
    cityKey: input.cityKey,
    ...(input.homeCourtId !== undefined ? { homeCourtId: input.homeCourtId } : {}),
    ...(courtIds.length > 0 ? { courtIds } : {}),
    creatorId: input.creatorId,
    visibility,
    joinPolicy,
    ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
    memberCount: 0, // the aggregator counts the creator via the emitted MEMBER insert below
    maxMembers: input.maxMembers ?? DEFAULT_GROUP_MAX_MEMBERS,
    createdAt: iso,
    updatedAt: iso,
  };

  // Creator membership — owner + active, from the first moment.
  const member: GroupMemberItem = {
    ...groupKeys.member(groupId, input.creatorId),
    entity: "GROUPMEMBER",
    groupId,
    uid: input.creatorId,
    role: "owner",
    status: "active",
    joinedAt: iso,
    createdAt: iso,
    updatedAt: iso,
  };

  // COURT→GROUP pointers (project visibility so private groups filter out in one pass).
  const pointers: GroupCourtRefItem[] = courtIds.map((courtId) => ({
    ...groupKeys.courtRef(courtId, groupId),
    entity: "GROUPCOURTREF",
    courtId,
    groupId,
    cityKey: input.cityKey,
    visibility,
    createdAt: iso,
  }));

  // create-only guards make the whole composite idempotent by id + all-or-nothing.
  const items: TransactItem[] = [
    txPut(asItem(group), "attribute_not_exists(pk)"),
    txPut(asItem(member), "attribute_not_exists(pk)"),
    ...pointers.map((p) => txPut(asItem(p), "attribute_not_exists(pk)")),
  ];
  await transactWrite(items);

  // Reconcile §9.4 aggregates: geo counts.groups (GROUP META) + court groupCount
  // (each PUBLIC pointer) + memberCount. The creator MEMBER insert is emitted so the
  // aggregator is the SINGLE source of memberCount (seeded 0) — consistent in dev
  // (inline stream) and prod (real stream), where a seeded 1 would double-count.
  await emitInsert(asItem(group));
  await emitInsert(asItem(member));
  for (const p of pointers) await emitInsert(asItem(p));

  return group;
}

// ── reads (one query/getItem each) ───────────────────────────────────────────

/** GROUP META by id (GetItem). */
export async function getGroupMeta(groupId: string): Promise<GroupItem | undefined> {
  return getItem<GroupItem>(groupKeys.meta(groupId));
}

/** The caller's membership row in a group (single GetItem), or undefined. */
export async function getGroupMember(
  groupId: string,
  uid: string,
): Promise<GroupMemberItem | undefined> {
  return getItem<GroupMemberItem>(groupKeys.member(groupId, uid));
}

/**
 * The uids of a group's ACTIVE members (one Query on the MEMBER# prefix) — the
 * lightweight fan-out list for group notifications (no profile hydration).
 */
export async function getActiveMemberUids(groupId: string): Promise<string[]> {
  const { items } = await query<GroupMemberItem>({
    pk: groupKeys.meta(groupId).pk,
    skBeginsWith: groupKeys.memberPrefix(),
  });
  return items.filter((m) => m.status === "active").map((m) => m.uid);
}

type GroupRow = GroupItem | GroupMemberItem | GroupInviteItem | (Record<string, unknown> & {
  sk: string;
  outingId?: string;
  startTs?: string;
});

/**
 * Pattern 26 — a group's full detail in ONE Query on `PK=GROUP#<id>` (META +
 * every MEMBER# / INVITE# / MEETUP# row). Members are hydrated with a public
 * profile projection (BatchGet — not a scan), respecting each member's
 * `checkinVisibility`; meet-up pointers are hydrated to their Outings (BatchGet),
 * upcoming first. Returns `undefined` when the group doesn't exist.
 */
export async function getGroup(
  groupId: string,
  opts?: { now?: number },
): Promise<GroupDetail | undefined> {
  const { items } = await query<GroupRow>({ pk: groupKeys.meta(groupId).pk });
  const group = items.find((i) => i.sk === "META") as GroupItem | undefined;
  if (!group) return undefined;

  const memberPrefix = groupKeys.memberPrefix();
  const invitePrefix = "INVITE#";
  const meetupPrefix = groupKeys.meetupPrefix();

  const memberRows = items.filter(
    (i): i is GroupMemberItem => i.sk.startsWith(memberPrefix),
  );
  const invites = items.filter(
    (i): i is GroupInviteItem => i.sk.startsWith(invitePrefix),
  );
  const meetupRows = items.filter((i) => i.sk.startsWith(meetupPrefix)) as Array<{
    outingId?: string;
    startTs?: string;
  }>;

  // Hydrate member profiles in one BatchGet, respecting checkinVisibility.
  const profiles = await batchGet<UserProfileItem>(
    memberRows.map((m) => ({ pk: `USER#${m.uid}`, sk: "PROFILE" })),
  );
  const profileByUid = new Map(profiles.map((p) => [p.uid, p]));
  const members: HydratedGroupMember[] = memberRows.map((m) => {
    const p = profileByUid.get(m.uid);
    const withhold = p?.checkinVisibility === "private";
    return {
      uid: m.uid,
      role: m.role,
      status: m.status,
      ...(m.joinedAt !== undefined ? { joinedAt: m.joinedAt } : {}),
      ...(p && !withhold
        ? {
            profile: {
              uid: p.uid,
              username: p.username,
              displayName: p.displayName,
              ...(p.avatarUrl !== undefined ? { avatarUrl: p.avatarUrl } : {}),
            },
          }
        : {}),
    };
  });

  // Hydrate meet-up pointers → Outings (BatchGet), then order upcoming-first.
  const outingIds = meetupRows.map((r) => r.outingId).filter((x): x is string => !!x);
  const outings =
    outingIds.length > 0
      ? await batchGet<OutingItem>(outingIds.map((id) => outingKeys.meta(id)))
      : [];
  const meetups = sortUpcomingFirst(outings, opts?.now ?? Date.now());

  // Hydrate a court lookup (home court + each meet-up's court) in one BatchGet.
  const courtIds = Array.from(
    new Set([
      ...(group.homeCourtId ? [group.homeCourtId] : []),
      ...(group.courtIds ?? []),
      ...meetups.map((m) => m.courtId),
    ]),
  );
  const courtMetas =
    courtIds.length > 0
      ? await batchGet<CourtItem>(courtIds.map((id) => courtKeys.meta(id)))
      : [];
  const courts: Record<string, { name: string; url: string }> = {};
  for (const c of courtMetas) courts[c.courtId] = { name: c.name, url: courtUrl(c) };

  return { group, members, meetups, invites, courts };
}

/** Order outings "upcoming first": future soonest-first, then past most-recent-first. */
function sortUpcomingFirst(outings: OutingItem[], now: number): OutingItem[] {
  const nowIso = new Date(now).toISOString();
  const upcoming = outings
    .filter((o) => o.startTs >= nowIso)
    .sort((a, b) => a.startTs.localeCompare(b.startTs));
  const past = outings
    .filter((o) => o.startTs < nowIso)
    .sort((a, b) => b.startTs.localeCompare(a.startTs));
  return [...upcoming, ...past];
}

/** Pattern 24 — a group META by URL slug (GSI3), one Query. */
export async function getGroupBySlug(slug: string): Promise<GroupItem | undefined> {
  const { items } = await query<GroupItem>({
    index: GSI.bySlug,
    pk: groupKeys.groupSlugPk(slug),
    skEquals: "META",
    limit: 1,
  });
  return items[0];
}

/**
 * Pattern 25 — PUBLIC groups in a city (GSI2 `GROUPLOC#<cityKey>`). Only public
 * groups carry the GSI2 keys, so private/unlisted groups are never indexed here;
 * the `visibility` filter is belt-and-suspenders. One Query.
 */
export async function getGroupsInCity(cityKey: string): Promise<GroupItem[]> {
  const { items } = await query<GroupItem>({
    index: GSI.byLocation,
    pk: groupKeys.cityGroupsPk(cityKey),
  });
  return items.filter((g) => g.visibility === "public");
}

/**
 * Pattern 27 — the caller's groups (GSI1 `USER#<uid>` / `GROUPMEMBER#`). One Query
 * for the membership rows, then a single BatchGet to hydrate the group METAs.
 */
export async function getMyGroups(uid: string): Promise<MyGroupMembership[]> {
  const { items: memberships } = await query<GroupMemberItem>({
    index: GSI.byOwner,
    pk: `USER#${uid}`,
    skBeginsWith: groupKeys.myGroupsPrefix(),
  });
  if (memberships.length === 0) return [];

  const metas = await batchGet<GroupItem>(
    memberships.map((m) => groupKeys.meta(m.groupId)),
  );
  const byId = new Map(metas.map((g) => [g.groupId, g]));
  return memberships
    .map((membership) => {
      const group = byId.get(membership.groupId);
      return group ? { group, membership } : undefined;
    })
    .filter((x): x is MyGroupMembership => x !== undefined);
}

/**
 * Pattern 28 — PUBLIC groups that play at a court. ONE keyed Query on the
 * COURT→GROUP pointer partition (`COURT#<id>` / `begins_with(GROUP#)`) with a
 * `visibility="public"` FILTER (the projection excludes private/unlisted groups in
 * a single pass, §9.5 note), then BatchGet-hydrate the group METAs. A group ALWAYS
 * appears at its home court (createGroup writes the pointer) as long as it's public.
 */
export async function getGroupsAtCourt(courtId: string): Promise<GroupItem[]> {
  const { items: refs } = await query<GroupCourtRefItem>({
    pk: `COURT#${courtId}`,
    skBeginsWith: groupKeys.courtGroupsPrefix(),
    filter: { expression: "visibility = :pub", values: { ":pub": "public" } },
  });
  if (refs.length === 0) return [];

  const metas = await batchGet<GroupItem>(refs.map((r) => groupKeys.meta(r.groupId)));
  return metas.filter((g) => g.visibility === "public");
}

// ── authorization guards ─────────────────────────────────────────────────────

/** A single membership row (GetItem). */
async function getMember(groupId: string, uid: string): Promise<GroupMemberItem | undefined> {
  return getItem<GroupMemberItem>(groupKeys.member(groupId, uid));
}

/**
 * GUARD — the actor must be an ACTIVE owner or admin of the group. Used by
 * approve/decline/invite/removeMember/updateGroup. Throws GroupPermissionError (403)
 * otherwise, GroupNotFoundError (404) if the group is gone.
 */
async function requireManager(groupId: string, actorUid: string): Promise<GroupMemberItem> {
  const group = await getGroupMeta(groupId);
  if (!group) throw new GroupNotFoundError(groupId);
  const actor = await getMember(groupId, actorUid);
  if (!actor || actor.status !== "active" || !isManagerRole(actor.role)) {
    throw new GroupPermissionError();
  }
  return actor;
}

/** GUARD — the actor must be the ACTIVE owner. Used by deleteGroup. */
async function requireOwner(groupId: string, actorUid: string): Promise<GroupMemberItem> {
  const group = await getGroupMeta(groupId);
  if (!group) throw new GroupNotFoundError(groupId);
  const actor = await getMember(groupId, actorUid);
  if (!actor || actor.status !== "active" || actor.role !== "owner") {
    throw new GroupPermissionError("Only the group owner can perform this action");
  }
  return actor;
}

/** The active owners + admins of a group (for join-request notifications). */
async function getManagers(groupId: string): Promise<GroupMemberItem[]> {
  const { items } = await query<GroupMemberItem>({
    pk: groupKeys.meta(groupId).pk,
    skBeginsWith: groupKeys.memberPrefix(),
  });
  return items.filter((m) => m.status === "active" && isManagerRole(m.role));
}

// ── membership: join / approve / decline / leave / remove ────────────────────

function buildMember(
  groupId: string,
  uid: string,
  status: GroupMemberStatus,
  iso: string,
  role: GroupMemberRole = "member",
): GroupMemberItem {
  return {
    ...groupKeys.member(groupId, uid),
    entity: "GROUPMEMBER",
    groupId,
    uid,
    role,
    status,
    ...(status === "active" ? { joinedAt: iso } : {}),
    createdAt: iso,
    updatedAt: iso,
  };
}

/**
 * Join a group, honouring its `joinPolicy` (§6.9):
 *   - "open"    → immediate ACTIVE membership (memberCount++ via the emitted insert).
 *   - "request" → a PENDING membership (no memberCount change) + a notification to
 *                 every active owner/admin so they can approve/decline it.
 *   - "invite"  → REFUSED (GroupJoinError); an invite token is required
 *                 (see {@link acceptInvite}).
 * Idempotent: a caller who is already active/pending gets their existing row back.
 */
export async function joinGroup(groupId: string, uid: string): Promise<JoinResult> {
  const group = await getGroupMeta(groupId);
  if (!group) throw new GroupNotFoundError(groupId);

  const existing = await getMember(groupId, uid);
  if (existing && (existing.status === "active" || existing.status === "pending")) {
    return { member: existing, status: existing.status };
  }

  if (group.joinPolicy === "invite") {
    throw new GroupJoinError("This group is invite-only — an invite is required to join");
  }

  // "open" joins become ACTIVE immediately, so they must fit under the cap; "request"
  // joins are only PENDING (no seat consumed), so the cap is enforced at approval instead.
  if (group.joinPolicy === "open") assertHasRoom(group);

  const iso = new Date().toISOString();
  const status: GroupMemberStatus = group.joinPolicy === "open" ? "active" : "pending";
  const member = buildMember(groupId, uid, status, iso);
  // Emit from the ATOMIC prior image, not the pre-read `existing` (L10): two concurrent joins
  // for the same uid both saw no member and would both `emitInsert` → memberCount +2 for one
  // real member. `ALL_OLD` makes the FIRST write an INSERT (memberCount++) and the loser a
  // MODIFY (active→active ⇒ the aggregator's delta is 0), exactly as real Streams would.
  const prior = await putItemReturningOld(asItem(member));
  if (prior) {
    await emitModify(prior, asItem(member));
  } else {
    await emitInsert(asItem(member)); // active ⇒ memberCount++; pending ⇒ no-op
  }

  if (status === "pending") {
    const managers = await getManagers(groupId);
    await Promise.all(
      managers
        .filter((m) => m.uid !== uid)
        .map((m) =>
          createNotification(m.uid, {
            type: "system",
            title: "New join request",
            body: `Someone requested to join ${group.name}`,
            entityRef: `/groups/${group.slug}`,
          }),
        ),
    );
  }

  return { member, status };
}

/**
 * Approve a PENDING membership (GUARD: `requireManager`). Moves pending→active and
 * emits a MODIFY so the aggregator bumps `memberCount` on exactly the pending→active
 * edge. Notifies the approved member. No-op if they're already active.
 */
export async function approveMember(
  groupId: string,
  actorUid: string,
  uid: string,
): Promise<GroupMemberItem> {
  await requireManager(groupId, actorUid);

  const existing = await getMember(groupId, uid);
  if (!existing) throw new GroupNotFoundError(`${groupId} member ${uid}`);
  if (existing.status === "active") return existing; // idempotent

  // Approving turns the request ACTIVE, so it must fit under the cap (409 if full).
  const group = await getGroupMeta(groupId);
  if (group) assertHasRoom(group);

  const iso = new Date().toISOString();
  const updated: GroupMemberItem = { ...existing, status: "active", joinedAt: iso, updatedAt: iso };
  await putItem(asItem(updated));
  await emitModify(asItem(existing), asItem(updated)); // pending→active ⇒ memberCount++

  await createNotification(uid, {
    type: "system",
    title: "Request approved",
    body: `You're now a member of ${group?.name ?? "the group"}`,
    ...(group ? { entityRef: `/groups/${group.slug}` } : {}),
  });
  return updated;
}

/**
 * Decline a PENDING membership (GUARD: `requireManager`). Removes the pending row
 * (pending→removed). No memberCount change (pending never counted). Notifies the user.
 */
export async function declineMember(
  groupId: string,
  actorUid: string,
  uid: string,
): Promise<void> {
  await requireManager(groupId, actorUid);
  const existing = await getMember(groupId, uid);
  if (!existing) return; // nothing to decline
  await deleteItem(groupKeys.member(groupId, uid));
  // A pending row never contributed to memberCount, so no emit is needed; if it was
  // somehow active, emit the remove so the counter stays honest.
  if (existing.status === "active") await emitRemove(asItem(existing));

  const group = await getGroupMeta(groupId);
  await createNotification(uid, {
    type: "system",
    title: "Request declined",
    body: `Your request to join ${group?.name ?? "the group"} was declined`,
  });
}

/**
 * Leave a group. GUARD: the sole owner cannot leave (they must transfer or delete
 * the group) — prevents an orphaned, unmanageable group. Emits a remove for an
 * active membership so `memberCount--`.
 */
export async function leaveGroup(groupId: string, uid: string): Promise<void> {
  const existing = await getMember(groupId, uid);
  if (!existing) return;
  if (existing.role === "owner") {
    throw new GroupPermissionError(
      "The owner cannot leave the group — transfer ownership or delete it instead",
    );
  }
  await deleteItem(groupKeys.member(groupId, uid));
  if (existing.status === "active") await emitRemove(asItem(existing));
}

/**
 * Remove another member (kick). GUARD: `requireManager`. The owner can't be removed
 * this way. Emits a remove for an active membership so `memberCount--`.
 */
export async function removeMember(
  groupId: string,
  actorUid: string,
  uid: string,
): Promise<void> {
  await requireManager(groupId, actorUid);
  const existing = await getMember(groupId, uid);
  if (!existing) return;
  if (existing.role === "owner") {
    throw new GroupPermissionError("The group owner cannot be removed");
  }
  await deleteItem(groupKeys.member(groupId, uid));
  if (existing.status === "active") await emitRemove(asItem(existing));
}

// ── invites (token + TTL) ────────────────────────────────────────────────────

/**
 * Create a shareable invite (GUARD: `requireManager`). Returns a GroupInviteItem
 * carrying a random `token`, an ISO `expiresAt`, and an epoch-seconds `ttl` so
 * DynamoDB TTL sweeps the row after it lapses (§14.6). An optional `email` records
 * the intended recipient (for a targeted invite email — not sent here).
 */
export async function createInvite(
  groupId: string,
  actorUid: string,
  opts?: { email?: string; now?: number; token?: string; ttlDays?: number },
): Promise<GroupInviteItem> {
  await requireManager(groupId, actorUid);

  const now = opts?.now ?? Date.now();
  const iso = new Date(now).toISOString();
  const ttlDays = opts?.ttlDays ?? INVITE_TTL_DAYS;
  const expiresMs = now + ttlDays * 24 * 60 * 60 * 1000;
  const token = opts?.token ?? ulid().toLowerCase();

  const invite: GroupInviteItem = {
    ...groupKeys.invite(groupId, token),
    entity: "GROUPINVITE",
    groupId,
    token,
    invitedBy: actorUid,
    ...(opts?.email !== undefined ? { email: opts.email } : {}),
    expiresAt: new Date(expiresMs).toISOString(),
    ttl: Math.floor(expiresMs / 1000),
    createdAt: iso,
  };
  await putItem(asItem(invite));
  return invite;
}

/**
 * Accept an invite → ACTIVE membership. Rejects a missing/expired token
 * (InviteError). DynamoDB TTL deletion is lazy, so we ALSO check `expiresAt`
 * explicitly (never trust the row's mere presence). Idempotent for an already-active
 * member; otherwise emits the insert so `memberCount++`.
 */
export async function acceptInvite(
  groupId: string,
  token: string,
  uid: string,
  opts?: { now?: number },
): Promise<GroupMemberItem> {
  const group = await getGroupMeta(groupId);
  if (!group) throw new GroupNotFoundError(groupId);

  const invite = await getItem<GroupInviteItem>(groupKeys.invite(groupId, token));
  if (!invite) throw new InviteError("Invalid or unknown invite");

  const now = opts?.now ?? Date.now();
  if (Date.parse(invite.expiresAt) <= now) {
    throw new InviteError("This invite has expired");
  }

  const existing = await getMember(groupId, uid);
  if (existing && existing.status === "active") return existing; // idempotent

  // An invite still can't push a group past its cap — the owner raises the limit for more.
  assertHasRoom(group);

  const iso = new Date(now).toISOString();
  const member = buildMember(groupId, uid, "active", iso);
  // Emit from the atomic prior image (L10): two concurrent invite accepts for the same uid
  // must bump memberCount once, not twice. `ALL_OLD` ⇒ first write INSERT (+1), loser MODIFY
  // (active→active ⇒ 0).
  const prior = await putItemReturningOld(asItem(member));
  if (prior) {
    await emitModify(prior, asItem(member));
  } else {
    await emitInsert(asItem(member)); // memberCount++
  }
  return member;
}

// ── update / delete ──────────────────────────────────────────────────────────

export interface UpdateGroupInput {
  name?: string;
  description?: string;
  visibility?: GroupVisibility;
  joinPolicy?: GroupJoinPolicy;
  avatarUrl?: string;
  /** New active-member cap (validated by the route). */
  maxMembers?: number;
  /** `null` clears the home court. */
  homeCourtId?: string | null;
  courtIds?: string[];
}

/**
 * Update a group's settings (GUARD: `requireManager`). Re-keys the discovery
 * surfaces when visibility or courts change:
 *   - GSI2 (city finder): re-put the META WITH the GSI2 keys iff the new visibility
 *     is public, WITHOUT them otherwise (a full Put naturally drops stale GSI keys),
 *     so a group toggled private drops out of pattern 25 immediately.
 *   - COURT→GROUP pointers: add pointers for newly-added courts, delete pointers for
 *     removed courts, and re-stamp `visibility` on retained pointers when it changes.
 *     Each add/remove/modify is emitted so the court `groupCount` (public-only) stays
 *     correct.
 * `counts.groups` (all groups, regardless of visibility) is unaffected by an update.
 */
export async function updateGroup(
  groupId: string,
  actorUid: string,
  patch: UpdateGroupInput,
): Promise<GroupItem> {
  await requireManager(groupId, actorUid);
  const current = await getGroupMeta(groupId);
  if (!current) throw new GroupNotFoundError(groupId);

  const nextVisibility = patch.visibility ?? current.visibility;
  const nextHomeCourtId =
    patch.homeCourtId !== undefined ? patch.homeCourtId ?? undefined : current.homeCourtId;
  const nextCourtIds = patch.courtIds ?? current.courtIds ?? [];
  const iso = new Date().toISOString();
  const isPublic = nextVisibility === "public";

  const dedupedCourts = Array.from(
    new Set([...(nextHomeCourtId ? [nextHomeCourtId] : []), ...nextCourtIds]),
  );

  // Update META in place (L9). A full Put would re-write `memberCount` from the value read at
  // the top of this function, silently clobbering a concurrent aggregator `ADD memberCount`
  // (a join/leave landing between our read and our write) — and nothing heals it. Instead SET
  // only the settings fields, REMOVE the ones being cleared, and leave `memberCount` plus the
  // stable identity / GSI1 (byCreator) / GSI3 (bySlug) keys untouched. Toggling to private
  // REMOVEs the GSI2 city-finder keys (matching the old full-Put behaviour of dropping stale
  // keys); toggling public re-stamps them.
  const nextDescription = patch.description !== undefined ? sanitizeMultiline(patch.description) : current.description;
  const nextName = patch.name !== undefined ? sanitizeLine(patch.name) || "Untitled group" : current.name;
  const nextAvatarUrl = patch.avatarUrl ?? current.avatarUrl;
  const sets = ["#name = :name", "visibility = :vis", "joinPolicy = :jp", "updatedAt = :u"];
  const removes: string[] = [];
  const names: Record<string, string> = { "#name": "name" };
  const values: Record<string, unknown> = {
    ":name": nextName,
    ":vis": nextVisibility,
    ":jp": patch.joinPolicy ?? current.joinPolicy,
    ":u": iso,
  };
  const setOrRemove = (attr: string, value: unknown): void => {
    if (value !== undefined) {
      sets.push(`${attr} = :${attr}`);
      values[`:${attr}`] = value;
    } else {
      removes.push(attr);
    }
  };
  setOrRemove("description", nextDescription);
  setOrRemove("homeCourtId", nextHomeCourtId);
  setOrRemove("courtIds", dedupedCourts.length > 0 ? dedupedCourts : undefined);
  setOrRemove("avatarUrl", nextAvatarUrl);
  // The member cap is a plain scalar — SET it only when the patch carries a new value
  // (never REMOVE, so an unrelated settings edit can't wipe the group's cap).
  if (patch.maxMembers !== undefined) {
    sets.push("maxMembers = :mm");
    values[":mm"] = patch.maxMembers;
  }
  if (isPublic) {
    const g2 = groupKeys.inCity(groupId, current.cityKey);
    sets.push("gsi2pk = :g2pk", "gsi2sk = :g2sk");
    values[":g2pk"] = g2.gsi2pk;
    values[":g2sk"] = g2.gsi2sk;
  } else {
    removes.push("gsi2pk", "gsi2sk");
  }
  const attrs = await updateItem({
    key: groupKeys.meta(groupId),
    update: `SET ${sets.join(", ")}` + (removes.length ? ` REMOVE ${removes.join(", ")}` : ""),
    names,
    values,
    condition: "attribute_exists(pk)",
  });
  // ALL_NEW reflects the true persisted row (including any concurrent `memberCount` bump).
  const updated = attrs as unknown as GroupItem;

  // Reconcile the COURT→GROUP pointers.
  const oldCourts = new Set([
    ...(current.homeCourtId ? [current.homeCourtId] : []),
    ...(current.courtIds ?? []),
  ]);
  const newCourts = new Set(dedupedCourts);
  const visibilityChanged = nextVisibility !== current.visibility;

  // Removed courts → delete pointer (+ emit remove so groupCount--).
  for (const courtId of oldCourts) {
    if (newCourts.has(courtId)) continue;
    const old: GroupCourtRefItem = {
      ...groupKeys.courtRef(courtId, groupId),
      entity: "GROUPCOURTREF",
      courtId,
      groupId,
      cityKey: current.cityKey,
      visibility: current.visibility,
      createdAt: current.createdAt,
    };
    await deleteItem(groupKeys.courtRef(courtId, groupId));
    await emitRemove(asItem(old));
  }

  // Added courts → put pointer (+ emit insert so groupCount++ when public).
  for (const courtId of newCourts) {
    if (oldCourts.has(courtId)) continue;
    const pointer: GroupCourtRefItem = {
      ...groupKeys.courtRef(courtId, groupId),
      entity: "GROUPCOURTREF",
      courtId,
      groupId,
      cityKey: current.cityKey,
      visibility: nextVisibility,
      createdAt: iso,
    };
    await putItem(asItem(pointer));
    await emitInsert(asItem(pointer));
  }

  // Retained courts → re-stamp visibility (+ emit modify) only if it changed.
  if (visibilityChanged) {
    for (const courtId of newCourts) {
      if (!oldCourts.has(courtId)) continue;
      const oldPtr: GroupCourtRefItem = {
        ...groupKeys.courtRef(courtId, groupId),
        entity: "GROUPCOURTREF",
        courtId,
        groupId,
        cityKey: current.cityKey,
        visibility: current.visibility,
        createdAt: current.createdAt,
      };
      const newPtr: GroupCourtRefItem = { ...oldPtr, visibility: nextVisibility };
      await putItem(asItem(newPtr));
      await emitModify(asItem(oldPtr), asItem(newPtr));
    }
  }

  return updated;
}

/**
 * Delete a group (GUARD: `requireOwner`). Removes GROUP META + every MEMBER row +
 * every COURT→GROUP pointer in ONE atomic transaction (N15). Emits removes so
 * `counts.groups` (geo) and each court's public `groupCount` decrement — but NOT the
 * member removes (the META is gone, so an `ADD memberCount` would resurrect it).
 * Meet-up pointers belong to their Outings and are left intact.
 */
export async function deleteGroup(groupId: string, actorUid: string): Promise<void> {
  await requireOwner(groupId, actorUid);
  const group = await getGroupMeta(groupId);
  if (!group) return;

  // All rows in the group's partition (META + MEMBER# + INVITE# + MEETUP#).
  const { items } = await query<{ pk: string; sk: string }>({ pk: groupKeys.meta(groupId).pk });
  const memberRows = items.filter((i) => i.sk.startsWith(groupKeys.memberPrefix()));

  const courtIds = Array.from(
    new Set([...(group.homeCourtId ? [group.homeCourtId] : []), ...(group.courtIds ?? [])]),
  );

  const del: TransactItem[] = [
    txDelete(groupKeys.meta(groupId)),
    ...memberRows.map((m) => txDelete({ pk: m.pk, sk: m.sk })),
    ...courtIds.map((courtId) => txDelete(groupKeys.courtRef(courtId, groupId))),
  ];
  await transactWrite(del);

  // Decrement the geo + court aggregates. (No member emits — META no longer exists.)
  await emitRemove(asItem(group));
  for (const courtId of courtIds) {
    await emitRemove(
      asItem({
        ...groupKeys.courtRef(courtId, groupId),
        entity: "GROUPCOURTREF",
        courtId,
        groupId,
        cityKey: group.cityKey,
        visibility: group.visibility,
      }),
    );
  }
}
