// Aggregates apply inline (no real Streams over DynamoDB Local) and TransactWrite
// is emulated sequentially with rollback (dynalite has no TransactWriteItems). Both
// must be set BEFORE the data layer reads them at call time.
process.env.STREAMS_INLINE = "1";
process.env.DYNAMO_EMULATE_TRANSACTIONS = "1";

import { describe, it, expect, beforeAll, vi } from "vitest";
import { getItem, putItem } from "@/lib/db/client";
import { getDocClient } from "@/lib/db/table";
import { courtKeys, groupKeys, geoKeys, userKeys, parseCityKey } from "@/lib/db/keys";
import { reconcileGroupMemberCount } from "@/lib/streams/reconcile";
import { createOuting } from "@/lib/data/outings";
import {
  createGroup,
  getGroup,
  getGroupMeta,
  getGroupBySlug,
  getGroupsInCity,
  getGroupsAtCourt,
  getMyGroups,
  joinGroup,
  approveMember,
  declineMember,
  createInvite,
  acceptInvite,
  leaveGroup,
  updateGroup,
  deleteGroup,
  GroupJoinError,
  GroupFullError,
  InviteError,
} from "@/lib/data/groups";
import { DEFAULT_GROUP_MAX_MEMBERS } from "@/lib/groups/limits";
import type { CourtItem, GroupCourtRefItem, GroupMemberItem, Counts } from "@/lib/db/types";

/**
 * Stage 8 Groups & Clubs data + Streams wiring against DynamoDB Local (§6.9, §9.5
 * #24–#28). Skipped without DYNAMODB_ENDPOINT. Parallel-safe + re-runnable: a
 * per-run cityKey/ids + synthetic courts isolate every counter and index partition.
 */
const d = process.env.DYNAMODB_ENDPOINT ? describe : describe.skip;

const RUN = Math.random().toString(36).slice(2, 8);
const CITY_KEY = `zz#grptest#${RUN}`;
const CITY_CNT = `zz#grpcnt#${RUN}`;
const START_TS = "2099-06-15T18:00:00.000Z";

const COURT_HOME = `court-grp-${RUN}-home`;
const COURT_ALT = `court-grp-${RUN}-alt`;
const COURT_CNT = `court-grp-${RUN}-cnt`;

async function makeCourt(courtId: string, cityKey = CITY_KEY): Promise<void> {
  await putItem({
    ...courtKeys.meta(courtId),
    entity: "COURT",
    courtId,
    name: `Group Test Court ${courtId}`,
    slug: courtId,
    cityKey,
    lat: 0,
    lng: 0,
    geohash: "000000000",
    totalCourts: 4,
    hasPickleball: true,
  });
}

async function makeUser(
  uid: string,
  checkinVisibility: "public" | "private" = "public",
): Promise<void> {
  await putItem({
    ...userKeys.profile(uid),
    entity: "USER",
    uid,
    username: `u-${uid}`,
    displayName: `Player ${uid}`,
    visibility: "public",
    checkinVisibility,
  });
}

d("groups data + streams wiring (DynamoDB Local)", () => {
  beforeAll(async () => {
    await Promise.all([
      makeCourt(COURT_HOME),
      makeCourt(COURT_ALT),
      makeCourt(COURT_CNT, CITY_CNT),
    ]);
  });

  // ── #24 / #26 / #27 / #28 reads + the composite create ──────────────────────
  it("createGroup writes GROUP+owner MEMBER+court pointers; reads #24/#26/#27/#28", async () => {
    const owner = `grp-${RUN}-owner`;
    const group = await createGroup({
      name: "East Side Dinkers",
      creatorId: owner,
      cityKey: CITY_KEY,
      homeCourtId: COURT_HOME,
      courtIds: [COURT_ALT],
      visibility: "public",
      joinPolicy: "open",
    });
    expect(group.visibility).toBe("public");
    // memberCount is seeded 0 and owned by the aggregator (via the emitted creator
    // MEMBER insert), so read the post-stream stored value, not the write snapshot.
    expect((await getGroupMeta(group.groupId))?.memberCount).toBe(1);

    // #26 — detail in ONE Query: META + owner MEMBER + court lookup.
    const detail = await getGroup(group.groupId);
    expect(detail?.group.groupId).toBe(group.groupId);
    expect(detail?.members.map((m) => m.uid)).toEqual([owner]);
    expect(detail?.members[0].role).toBe("owner");
    expect(detail?.courts[COURT_HOME]?.name).toBeTruthy();

    // #24 — by slug (GSI3).
    const bySlug = await getGroupBySlug(group.slug);
    expect(bySlug?.groupId).toBe(group.groupId);

    // #27 — my groups (GSI1). The creator is a member.
    const mine = await getMyGroups(owner);
    expect(mine.map((m) => m.group.groupId)).toContain(group.groupId);
    expect(mine.find((m) => m.group.groupId === group.groupId)?.membership.role).toBe("owner");

    // #28 — INVARIANT: a group always appears at its home court (public).
    const atHome = await getGroupsAtCourt(COURT_HOME);
    expect(atHome.map((g) => g.groupId)).toContain(group.groupId);
    // …and at its extra court too.
    const atAlt = await getGroupsAtCourt(COURT_ALT);
    expect(atAlt.map((g) => g.groupId)).toContain(group.groupId);
  });

  // ── #25 — city finder (public only) ─────────────────────────────────────────
  it("#25 getGroupsInCity returns PUBLIC groups only; private/unlisted are excluded", async () => {
    const pub = await createGroup({
      name: "Public Crew",
      creatorId: `grp-${RUN}-p`,
      cityKey: CITY_KEY,
      homeCourtId: COURT_HOME,
      visibility: "public",
    });
    const priv = await createGroup({
      name: "Secret Squad",
      creatorId: `grp-${RUN}-s`,
      cityKey: CITY_KEY,
      homeCourtId: COURT_HOME,
      visibility: "private",
    });
    const unlisted = await createGroup({
      name: "Hidden Hitters",
      creatorId: `grp-${RUN}-u`,
      cityKey: CITY_KEY,
      homeCourtId: COURT_HOME,
      visibility: "unlisted",
    });

    const inCity = await getGroupsInCity(CITY_KEY);
    const ids = inCity.map((g) => g.groupId);
    expect(ids).toContain(pub.groupId);
    expect(ids).not.toContain(priv.groupId); // private never indexed in GSI2
    expect(ids).not.toContain(unlisted.groupId); // unlisted never indexed either

    // #28 — the SAME exclusion holds on the public court rail.
    const atCourt = await getGroupsAtCourt(COURT_HOME);
    const courtIds = atCourt.map((g) => g.groupId);
    expect(courtIds).toContain(pub.groupId);
    expect(courtIds).not.toContain(priv.groupId);
    expect(courtIds).not.toContain(unlisted.groupId);
  });

  // ── composite create is all-or-nothing (N15) ────────────────────────────────
  it("createGroup TransactWrite is all-or-nothing (mid-tx failure → no partial GROUP/MEMBER/pointer)", async () => {
    const owner = `grp-${RUN}-tx`;
    const groupId = `fixed-${RUN}-tx`;
    // Pre-create the home-court POINTER (the LAST tx item) so its create-only
    // condition fails AFTER the GROUP META (1st) + owner MEMBER (2nd) are applied.
    const conflicting: GroupCourtRefItem = {
      ...groupKeys.courtRef(COURT_HOME, groupId),
      entity: "GROUPCOURTREF",
      courtId: COURT_HOME,
      groupId,
      cityKey: CITY_KEY,
      visibility: "public",
      createdAt: new Date().toISOString(),
    };
    await putItem(conflicting as unknown as Record<string, unknown>);

    await expect(
      createGroup({
        name: "Doomed Group",
        creatorId: owner,
        cityKey: CITY_KEY,
        homeCourtId: COURT_HOME,
        visibility: "public",
        groupId,
      }),
    ).rejects.toBeTruthy();

    // Both the GROUP META and the owner MEMBER (applied first) must be ROLLED BACK.
    expect(await getGroupMeta(groupId)).toBeUndefined();
    expect(await getItem(groupKeys.member(groupId, owner))).toBeUndefined();
  });

  // ── reconcile heals a drifted (orphaned) memberCount (§14.6) ─────────────────
  it("reconcile heals an orphaned memberCount drift", async () => {
    const owner = `grp-${RUN}-rec`;
    const group = await createGroup({
      name: "Reconcile Club",
      creatorId: owner,
      cityKey: CITY_KEY,
      homeCourtId: COURT_HOME,
      visibility: "public",
      joinPolicy: "open",
    });

    // Simulate drift: write a SECOND active member row DIRECTLY (bypassing streams),
    // so the stored memberCount (1) is now stale vs. the 2 real active members.
    const ghost: GroupMemberItem = {
      ...groupKeys.member(group.groupId, `grp-${RUN}-ghost`),
      entity: "GROUPMEMBER",
      groupId: group.groupId,
      uid: `grp-${RUN}-ghost`,
      role: "member",
      status: "active",
      joinedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await putItem(ghost as unknown as Record<string, unknown>);
    expect((await getGroupMeta(group.groupId))?.memberCount).toBe(1); // stale

    const healed = await reconcileGroupMemberCount(group.groupId);
    expect(healed).toBe(2);
    expect((await getGroupMeta(group.groupId))?.memberCount).toBe(2); // corrected
  });

  // ── join-policy variants ─────────────────────────────────────────────────────
  it("join policy: open ⇒ active, request ⇒ pending, invite ⇒ rejected", async () => {
    // OPEN
    const openG = await createGroup({
      name: "Open Group",
      creatorId: `grp-${RUN}-og`,
      cityKey: CITY_KEY,
      homeCourtId: COURT_HOME,
      visibility: "public",
      joinPolicy: "open",
    });
    const openJoin = await joinGroup(openG.groupId, `grp-${RUN}-o1`);
    expect(openJoin.status).toBe("active");
    expect((await getGroupMeta(openG.groupId))?.memberCount).toBe(2); // owner + joiner

    // REQUEST
    const reqG = await createGroup({
      name: "Request Group",
      creatorId: `grp-${RUN}-rg`,
      cityKey: CITY_KEY,
      homeCourtId: COURT_HOME,
      visibility: "public",
      joinPolicy: "request",
    });
    const reqJoin = await joinGroup(reqG.groupId, `grp-${RUN}-r1`);
    expect(reqJoin.status).toBe("pending");
    expect((await getGroupMeta(reqG.groupId))?.memberCount).toBe(1); // pending doesn't count

    // INVITE — refused without a token.
    const invG = await createGroup({
      name: "Invite Group",
      creatorId: `grp-${RUN}-ig`,
      cityKey: CITY_KEY,
      homeCourtId: COURT_HOME,
      visibility: "private",
      joinPolicy: "invite",
    });
    await expect(joinGroup(invG.groupId, `grp-${RUN}-i1`)).rejects.toBeInstanceOf(GroupJoinError);
    expect((await getGroupMeta(invG.groupId))?.memberCount).toBe(1);
  });

  // ── approve flow: pending → active + memberCount++ ───────────────────────────
  it("approve moves pending→active and bumps memberCount; decline removes the request", async () => {
    const owner = `grp-${RUN}-ap-owner`;
    const g = await createGroup({
      name: "Approvals",
      creatorId: owner,
      cityKey: CITY_KEY,
      homeCourtId: COURT_HOME,
      visibility: "public",
      joinPolicy: "request",
    });

    const pendA = `grp-${RUN}-ap-a`;
    const pendB = `grp-${RUN}-ap-b`;
    await joinGroup(g.groupId, pendA);
    await joinGroup(g.groupId, pendB);
    expect((await getGroupMeta(g.groupId))?.memberCount).toBe(1); // both pending

    // Non-manager cannot approve.
    await expect(approveMember(g.groupId, pendB, pendA)).rejects.toBeTruthy();

    // Owner approves A → active, memberCount 2.
    const approved = await approveMember(g.groupId, owner, pendA);
    expect(approved.status).toBe("active");
    expect((await getGroupMeta(g.groupId))?.memberCount).toBe(2);

    // Owner declines B → the pending row is removed, count unchanged.
    await declineMember(g.groupId, owner, pendB);
    expect(await getItem(groupKeys.member(g.groupId, pendB))).toBeUndefined();
    expect((await getGroupMeta(g.groupId))?.memberCount).toBe(2);
  });

  // ── member cap (§6.9) ────────────────────────────────────────────────────────
  it("createGroup defaults maxMembers to 40 when none is given", async () => {
    const g = await createGroup({
      name: "Default Cap",
      creatorId: `grp-${RUN}-cap-def`,
      cityKey: CITY_KEY,
      homeCourtId: COURT_HOME,
    });
    expect(g.maxMembers).toBe(DEFAULT_GROUP_MAX_MEMBERS);
    expect((await getGroupMeta(g.groupId))?.maxMembers).toBe(40);
  });

  it("open join is refused once the group hits its member cap (GroupFullError)", async () => {
    const g = await createGroup({
      name: "Capped Open",
      creatorId: `grp-${RUN}-cap-o`,
      cityKey: CITY_KEY,
      homeCourtId: COURT_HOME,
      visibility: "public",
      joinPolicy: "open",
      maxMembers: 2, // owner + exactly one more
    });
    // Owner is #1; this join fills the last seat.
    expect((await joinGroup(g.groupId, `grp-${RUN}-cap-o1`)).status).toBe("active");
    expect((await getGroupMeta(g.groupId))?.memberCount).toBe(2);

    // The group is full — the next join is rejected and the count doesn't move.
    await expect(joinGroup(g.groupId, `grp-${RUN}-cap-o2`)).rejects.toBeInstanceOf(GroupFullError);
    expect((await getGroupMeta(g.groupId))?.memberCount).toBe(2);

    // Raising the cap lets the blocked user in.
    await updateGroup(g.groupId, `grp-${RUN}-cap-o`, { maxMembers: 3 });
    expect((await joinGroup(g.groupId, `grp-${RUN}-cap-o2`)).status).toBe("active");
    expect((await getGroupMeta(g.groupId))?.memberCount).toBe(3);
  });

  it("approving a pending member past the cap is refused (GroupFullError)", async () => {
    const owner = `grp-${RUN}-cap-ap`;
    const g = await createGroup({
      name: "Capped Approvals",
      creatorId: owner,
      cityKey: CITY_KEY,
      homeCourtId: COURT_HOME,
      visibility: "public",
      joinPolicy: "request",
      maxMembers: 2,
    });
    const a = `grp-${RUN}-cap-ap-a`;
    const b = `grp-${RUN}-cap-ap-b`;
    await joinGroup(g.groupId, a); // pending
    await joinGroup(g.groupId, b); // pending
    // First approval fills the group (owner + a = 2).
    expect((await approveMember(g.groupId, owner, a)).status).toBe("active");
    expect((await getGroupMeta(g.groupId))?.memberCount).toBe(2);
    // Second approval would exceed the cap → refused; the request stays pending.
    await expect(approveMember(g.groupId, owner, b)).rejects.toBeInstanceOf(GroupFullError);
    expect((await getGroupMeta(g.groupId))?.memberCount).toBe(2);
  });

  it("accepting an invite past the cap is refused (GroupFullError)", async () => {
    const owner = `grp-${RUN}-cap-inv`;
    const g = await createGroup({
      name: "Capped Invites",
      creatorId: owner,
      cityKey: CITY_KEY,
      homeCourtId: COURT_HOME,
      visibility: "private",
      joinPolicy: "invite",
      maxMembers: 2,
    });
    const T0 = Date.parse("2099-01-01T00:00:00.000Z");
    const inv1 = await createInvite(g.groupId, owner, { now: T0 });
    // First accept fills the group (owner + guest1 = 2).
    await acceptInvite(g.groupId, inv1.token, `grp-${RUN}-cap-inv-1`, { now: T0 });
    expect((await getGroupMeta(g.groupId))?.memberCount).toBe(2);
    // A second invite can't push past the cap.
    const inv2 = await createInvite(g.groupId, owner, { now: T0 });
    await expect(
      acceptInvite(g.groupId, inv2.token, `grp-${RUN}-cap-inv-2`, { now: T0 }),
    ).rejects.toBeInstanceOf(GroupFullError);
    expect((await getGroupMeta(g.groupId))?.memberCount).toBe(2);
  });

  // ── invites: valid accept ⇒ active; expired token rejected (TTL) ─────────────
  it("invite: a valid token joins active; an expired token is rejected", async () => {
    const owner = `grp-${RUN}-inv-owner`;
    const g = await createGroup({
      name: "Invite Only",
      creatorId: owner,
      cityKey: CITY_KEY,
      homeCourtId: COURT_HOME,
      visibility: "private",
      joinPolicy: "invite",
    });

    const T0 = Date.parse("2099-01-01T00:00:00.000Z");
    const invite = await createInvite(g.groupId, owner, { now: T0, ttlDays: 7 });
    expect(invite.ttl).toBe(Math.floor(Date.parse(invite.expiresAt) / 1000)); // epoch-seconds TTL

    // Expired: accepting AFTER expiresAt is rejected.
    const expired = Date.parse(invite.expiresAt) + 1;
    await expect(
      acceptInvite(g.groupId, invite.token, `grp-${RUN}-late`, { now: expired }),
    ).rejects.toBeInstanceOf(InviteError);

    // A bogus token is rejected too.
    await expect(
      acceptInvite(g.groupId, "not-a-real-token", `grp-${RUN}-late`, { now: T0 }),
    ).rejects.toBeInstanceOf(InviteError);

    // Valid + unexpired ⇒ ACTIVE member (memberCount++).
    const member = await acceptInvite(g.groupId, invite.token, `grp-${RUN}-guest`, {
      now: T0 + 1000,
    });
    expect(member.status).toBe("active");
    expect((await getGroupMeta(g.groupId))?.memberCount).toBe(2);
  });

  // ── member hydration respects checkinVisibility ──────────────────────────────
  it("getGroup withholds the profile of a member with private check-in visibility", async () => {
    const owner = `grp-${RUN}-vis-owner`;
    const pubUid = `grp-${RUN}-vis-pub`;
    const privUid = `grp-${RUN}-vis-priv`;
    await Promise.all([
      makeUser(owner, "public"),
      makeUser(pubUid, "public"),
      makeUser(privUid, "private"),
    ]);

    const g = await createGroup({
      name: "Visibility Group",
      creatorId: owner,
      cityKey: CITY_KEY,
      homeCourtId: COURT_HOME,
      visibility: "public",
      joinPolicy: "open",
    });
    await joinGroup(g.groupId, pubUid);
    await joinGroup(g.groupId, privUid);

    const detail = await getGroup(g.groupId);
    const pub = detail?.members.find((m) => m.uid === pubUid);
    const priv = detail?.members.find((m) => m.uid === privUid);
    expect(pub?.profile?.displayName).toBe(`Player ${pubUid}`); // public identity shown
    expect(priv?.profile).toBeUndefined(); // private check-in ⇒ identity withheld
    expect(priv?.uid).toBe(privUid); // …but the seat is still listed
  });

  // ── meet-up hydration (group Outings) ────────────────────────────────────────
  it("getGroup hydrates group meet-ups from the MEETUP pointers written by createOuting", async () => {
    const owner = `grp-${RUN}-meet-owner`;
    const g = await createGroup({
      name: "Meetup Group",
      creatorId: owner,
      cityKey: CITY_KEY,
      homeCourtId: COURT_HOME,
      visibility: "public",
      joinPolicy: "open",
    });
    const outing = await createOuting({
      title: "Group Game Night",
      courtId: COURT_HOME,
      organizerId: owner,
      startTs: START_TS,
      hostType: "GROUP",
      groupId: g.groupId,
      visibility: "public",
    });

    const detail = await getGroup(g.groupId);
    expect(detail?.meetups.map((m) => m.outingId)).toContain(outing.outingId);
    expect(detail?.courts[COURT_HOME]?.url).toBeTruthy();
  });

  // ── leave decrements memberCount; owner can't leave ──────────────────────────
  it("leaveGroup drops an active member (memberCount--); the owner cannot leave", async () => {
    const owner = `grp-${RUN}-lv-owner`;
    const g = await createGroup({
      name: "Leavers",
      creatorId: owner,
      cityKey: CITY_KEY,
      homeCourtId: COURT_HOME,
      visibility: "public",
      joinPolicy: "open",
    });
    const joiner = `grp-${RUN}-lv-1`;
    await joinGroup(g.groupId, joiner);
    expect((await getGroupMeta(g.groupId))?.memberCount).toBe(2);

    await leaveGroup(g.groupId, joiner);
    expect(await getItem(groupKeys.member(g.groupId, joiner))).toBeUndefined();
    expect((await getGroupMeta(g.groupId))?.memberCount).toBe(1);

    // The owner is blocked from leaving (must transfer or delete).
    await expect(leaveGroup(g.groupId, owner)).rejects.toBeTruthy();
  });

  // ── streams: counts.groups (geo) + court groupCount (public only) ────────────
  it("streams-inline: GROUP create bumps counts.groups (geo) + court groupCount (public only)", async () => {
    // Public group in a DEDICATED city/court so the counters equal exactly this.
    const pub = await createGroup({
      name: "Counted Public",
      creatorId: `grp-${RUN}-cnt-p`,
      cityKey: CITY_CNT,
      homeCourtId: COURT_CNT,
      visibility: "public",
    });
    // A private group at the SAME court must NOT bump the public court groupCount…
    await createGroup({
      name: "Counted Private",
      creatorId: `grp-${RUN}-cnt-s`,
      cityKey: CITY_CNT,
      homeCourtId: COURT_CNT,
      visibility: "private",
    });

    const court = await getItem<CourtItem>(courtKeys.meta(COURT_CNT));
    expect(court?.groupCount).toBe(1); // only the public group counted

    const { country, state, city } = parseCityKey(CITY_CNT);
    const cityItem = await getItem<{ counts?: Counts }>(geoKeys.city(country, state, city));
    expect(cityItem?.counts?.groups).toBe(2); // counts.groups counts ALL groups

    // Deleting the public group decrements both aggregates.
    await deleteGroup(pub.groupId, `grp-${RUN}-cnt-p`);
    const court2 = await getItem<CourtItem>(courtKeys.meta(COURT_CNT));
    expect(court2?.groupCount).toBe(0);
    const cityItem2 = await getItem<{ counts?: Counts }>(geoKeys.city(country, state, city));
    expect(cityItem2?.counts?.groups).toBe(1);
    expect(await getGroupMeta(pub.groupId)).toBeUndefined(); // gone
  });

  // ── updateGroup re-keys discovery surfaces on a visibility flip ──────────────
  it("updateGroup public→private drops the group from #25 + #28 public reads", async () => {
    const owner = `grp-${RUN}-upd-owner`;
    const g = await createGroup({
      name: "Going Dark",
      creatorId: owner,
      cityKey: CITY_KEY,
      homeCourtId: COURT_HOME,
      visibility: "public",
      joinPolicy: "open",
    });
    expect((await getGroupsInCity(CITY_KEY)).map((x) => x.groupId)).toContain(g.groupId);
    expect((await getGroupsAtCourt(COURT_HOME)).map((x) => x.groupId)).toContain(g.groupId);

    await updateGroup(g.groupId, owner, { visibility: "private" });

    expect((await getGroupsInCity(CITY_KEY)).map((x) => x.groupId)).not.toContain(g.groupId);
    expect((await getGroupsAtCourt(COURT_HOME)).map((x) => x.groupId)).not.toContain(g.groupId);
  });

  // ── updateGroup must not clobber a concurrent aggregator memberCount bump (L9) ─
  it("L9: a settings edit racing a join does not erase the aggregator's memberCount bump", async () => {
    const owner = `grp-${RUN}-l9`;
    const g = await createGroup({
      name: "Race Club",
      creatorId: owner,
      cityKey: CITY_KEY,
      homeCourtId: COURT_HOME,
      visibility: "public",
      joinPolicy: "open",
    });
    expect((await getGroupMeta(g.groupId))?.memberCount).toBe(1); // creator only

    // Deterministically stage the exact lost-update window: intercept updateGroup's own META
    // write and, just before it commits, land a real member JOIN (the inline aggregator applies
    // an atomic `ADD memberCount +1` → 2). updateGroup had already read `current` (memberCount=1)
    // by then, so pre-fix its full Put re-wrote memberCount=1, erasing the join. The interceptor
    // works for BOTH shapes: a PutCommand (pre-fix) and an UpdateCommand (fixed) targeting META.
    const client = getDocClient();
    const originalSend = client.send.bind(client); // real send, captured before spying
    const meta = groupKeys.meta(g.groupId);
    const isMetaKey = (k: { pk?: string; sk?: string } | undefined) =>
      !!k && k.pk === meta.pk && k.sk === meta.sk;
    let injected = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sendSpy = vi.spyOn(client, "send").mockImplementation(async (command: any) => {
      const input = command?.input ?? {};
      const isMetaWrite =
        (input.Item && isMetaKey(input.Item)) || // PutCommand (pre-fix)
        (input.Key && input.UpdateExpression && isMetaKey(input.Key)); // UpdateCommand (fixed)
      if (isMetaWrite && !injected) {
        injected = true;
        // The join's own writes (incl. the aggregator's `ADD memberCount` on META) re-enter this
        // mock, but `injected` is now set so they fall through to the real send — no recursion.
        await joinGroup(g.groupId, `grp-${RUN}-l9-joiner`); // aggregator: memberCount 1 → 2
        return originalSend(command); // now let updateGroup's original META write land
      }
      return originalSend(command);
    });

    await updateGroup(g.groupId, owner, { name: "Race Club Renamed" });
    sendSpy.mockRestore();

    const after = await getGroupMeta(g.groupId);
    expect(after?.name).toBe("Race Club Renamed"); // the edit still applied
    expect(after?.memberCount).toBe(2); // pre-fix: 1 (the concurrent join was clobbered)
  });

  // ── two concurrent joins for one uid bump memberCount ONCE, not twice (L10) ────
  it("L10: a double-submitted join for the same uid counts once (no double memberCount)", async () => {
    const owner = `grp-${RUN}-l10`;
    const joiner = `grp-${RUN}-l10-joiner`;
    const g = await createGroup({
      name: "Double Join",
      creatorId: owner,
      cityKey: CITY_KEY,
      homeCourtId: COURT_HOME,
      visibility: "public",
      joinPolicy: "open",
    });
    expect((await getGroupMeta(g.groupId))?.memberCount).toBe(1); // creator only

    // Deterministically stage the race: intercept the first join's MEMBER-row write and, right
    // before it commits, run a SECOND join for the SAME uid to completion (double-tap / two
    // devices). Both saw no member, so pre-fix both `emitInsert` → memberCount +2 for one member.
    const client = getDocClient();
    const originalSend = client.send.bind(client);
    const memberKey = groupKeys.member(g.groupId, joiner);
    let injected = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sendSpy = vi.spyOn(client, "send").mockImplementation(async (command: any) => {
      const input = command?.input ?? {};
      const isMemberWrite =
        input.Item && input.Item.pk === memberKey.pk && input.Item.sk === memberKey.sk;
      if (isMemberWrite && !injected) {
        injected = true;
        await joinGroup(g.groupId, joiner); // concurrent second join, same uid, run to completion
        return originalSend(command); // then let the first join's write land
      }
      return originalSend(command);
    });

    await joinGroup(g.groupId, joiner);
    sendSpy.mockRestore();

    // One real joiner + the creator. Pre-fix: 3 (the same join was counted twice).
    expect((await getGroupMeta(g.groupId))?.memberCount).toBe(2);
  });
});
