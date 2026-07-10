// Aggregates apply inline (no real Streams over DynamoDB Local) and TransactWrite
// is emulated sequentially with rollback (dynalite has no TransactWriteItems). Both
// must be set BEFORE the data layer reads them at call time.
process.env.STREAMS_INLINE = "1";
process.env.DYNAMO_EMULATE_TRANSACTIONS = "1";

import { describe, it, expect, beforeAll } from "vitest";
import { getItem, putItem } from "@/lib/db/client";
import { courtKeys, outingKeys } from "@/lib/db/keys";
import {
  buildReminderItem,
  checkInToEvent,
  createOuting,
  getOuting,
  rsvp,
  REMINDER_LEAD_MS,
} from "@/lib/data/outings";
import { createGroup, joinGroup } from "@/lib/data/groups";
import { followCourt } from "@/lib/data/follows";
import { buildProfileItem } from "@/lib/data/users";
import { getMyNotifications } from "@/lib/data/notifications";
import { notifyRsvpChange, notifyEventCheckin } from "@/lib/outings/notify";
import { sendDueOutingReminders } from "@/lib/jobs/outing-reminders";
import type { OutingReminderItem, RsvpItem } from "@/lib/db/types";

/**
 * Group-event notification rail (§9.3/§6.7/§6.9): RSVP fan-out, anonymous event
 * check-in fan-out (+ arrival), and the pre-event RSVP reminder sweep. Skipped
 * without DYNAMODB_ENDPOINT. Per-run ids isolate partitions (parallel-safe).
 */
const d = process.env.DYNAMODB_ENDPOINT ? describe : describe.skip;

const RUN = Math.random().toString(36).slice(2, 8);
const CITY_KEY = `zz#onotif#${RUN}`;
const COURT = `court-on-${RUN}`;
const START_TS = "2099-06-15T18:00:00.000Z";

const ORGANIZER = `u-on-org-${RUN}`;
const MEMBER_A = `u-on-a-${RUN}`; // the actor in most tests
const MEMBER_B = `u-on-b-${RUN}`; // a quiet member who receives fan-outs
const FOLLOWER = `u-on-f-${RUN}`; // follows the court, not in the group
const GROUP_ID = `grp-on-${RUN}`;

async function seedProfile(uid: string, displayName: string): Promise<void> {
  await putItem(
    buildProfileItem({
      uid,
      username: `${uid}`,
      displayName,
      visibility: "public",
    }) as unknown as Record<string, unknown>,
  );
}

const notifTitles = async (uid: string) => (await getMyNotifications(uid)).map((n) => n.title);

d("outing notifications + reminders (integration)", () => {
  beforeAll(async () => {
    await putItem({
      ...courtKeys.meta(COURT),
      entity: "COURT",
      courtId: COURT,
      name: `Notify Test Court ${RUN}`,
      slug: COURT,
      cityKey: CITY_KEY,
      lat: 0,
      lng: 0,
      geohash: "000000000",
      totalCourts: 4,
      hasPickleball: true,
    });
    await Promise.all(
      [
        [ORGANIZER, "Orla Organizer"],
        [MEMBER_A, "Aidan Actor"],
        [MEMBER_B, "Bree Bystander"],
        [FOLLOWER, "Frida Follower"],
      ].map(([uid, name]) => seedProfile(uid, name)),
    );
    await createGroup({
      name: `Notify Crew ${RUN}`,
      creatorId: ORGANIZER,
      cityKey: CITY_KEY,
      homeCourtId: COURT,
      joinPolicy: "open",
      visibility: "public",
      groupId: GROUP_ID,
      slug: `notify-crew-${RUN}`,
    });
    await joinGroup(GROUP_ID, MEMBER_A);
    await joinGroup(GROUP_ID, MEMBER_B);
    await followCourt(FOLLOWER, COURT);
  });

  it("createOuting enqueues a reminder row due 24h before start (REMDAY bucket)", async () => {
    const outing = await createOuting({
      title: `Enqueue Game ${RUN}`,
      courtId: COURT,
      organizerId: ORGANIZER,
      startTs: START_TS,
      hostType: "GROUP",
      groupId: GROUP_ID,
      visibility: "private",
      type: "private",
    });
    const dueTs = new Date(Date.parse(START_TS) - REMINDER_LEAD_MS).toISOString();
    const row = await getItem<OutingReminderItem>(outingKeys.reminder(dueTs, outing.outingId));
    expect(row?.entity).toBe("OUTINGREM");
    expect(row?.occurrenceTs).toBe(START_TS);
  });

  it("RSVP fan-out reaches the organizer + group members, never the actor", async () => {
    const outing = await createOuting({
      title: `Rsvp Game ${RUN}`,
      courtId: COURT,
      organizerId: ORGANIZER,
      startTs: START_TS,
      hostType: "GROUP",
      groupId: GROUP_ID,
      visibility: "private",
      type: "private",
    });
    const result = await rsvp(outing.outingId, MEMBER_A, "going");
    expect(result.changed).toBe(true);
    expect(result.previousStatus).toBeUndefined();
    await notifyRsvpChange({ outing, actorUid: MEMBER_A, status: result.rsvp.status });

    const expected = `Aidan Actor is going to Rsvp Game ${RUN}`;
    expect(await notifTitles(ORGANIZER)).toContain(expected);
    expect(await notifTitles(MEMBER_B)).toContain(expected);
    expect(await notifTitles(MEMBER_A)).not.toContain(expected);

    // A re-submit of the SAME status is a no-op transition → no second fan-out.
    const again = await rsvp(outing.outingId, MEMBER_A, "going");
    expect(again.changed).toBe(false);
    expect(again.previousStatus).toBe("going");
  });

  it("event check-in marks the RSVP arrived and fans out ANONYMOUS notifications", async () => {
    const outing = await createOuting({
      title: `Checkin Game ${RUN}`,
      courtId: COURT,
      organizerId: ORGANIZER,
      startTs: START_TS,
      hostType: "GROUP",
      groupId: GROUP_ID,
      visibility: "private",
      type: "private",
    });
    // A has an RSVP → check-in stamps arrival, exactly once (a re-tap reports
    // "not new" so the caller never re-notifies).
    await rsvp(outing.outingId, MEMBER_A, "going");
    expect(await checkInToEvent(outing, MEMBER_A)).toBe(true);
    expect(await checkInToEvent(outing, MEMBER_A)).toBe(false);
    // B is a WALK-UP (no RSVP) → check-in creates a "going" RSVP, then stamps.
    expect(await checkInToEvent(outing, MEMBER_B)).toBe(true);

    const detail = await getOuting(outing.outingId);
    const byUid = new Map(detail?.rsvps.map((r: RsvpItem) => [r.uid, r]));
    expect(byUid.get(MEMBER_A)?.arrivedAt).toBeTruthy();
    expect(byUid.get(MEMBER_B)?.status).toBe("going");
    expect(byUid.get(MEMBER_B)?.arrivedAt).toBeTruthy();

    await notifyEventCheckin({ outing, courtName: "Notify Test Court", actorUid: MEMBER_A });
    const groupTitle = `A player checked in for Checkin Game ${RUN}`;
    const followerTitle = "Check-in at Notify Test Court";
    // Group members hear it (anonymous copy — the actor is never named)…
    const bNotifs = await getMyNotifications(MEMBER_B);
    const checkinNotif = bNotifs.find((n) => n.title === groupTitle);
    expect(checkinNotif).toBeTruthy();
    expect(`${checkinNotif!.title} ${checkinNotif!.body ?? ""}`).not.toContain("Aidan");
    // …the court's follower hears it…
    expect(await notifTitles(FOLLOWER)).toContain(followerTitle);
    // …and the actor hears nothing.
    expect(await notifTitles(MEMBER_A)).not.toContain(groupTitle);
  });

  it("reminder sweep asks exactly the undecided members, claims the row, and requeues a recurring series", async () => {
    const now = Date.now();
    const start = new Date(now + 12 * 60 * 60 * 1000).toISOString(); // inside the lead window
    const outing = await createOuting({
      title: `Sweep Game ${RUN}`,
      courtId: COURT,
      organizerId: ORGANIZER,
      startTs: start,
      hostType: "GROUP",
      groupId: GROUP_ID,
      visibility: "private",
      type: "private",
      rrule: "FREQ=WEEKLY;INTERVAL=1",
      now, // pin the clock: the clamped dueTs must be ≤ the sweep's `now`
    });
    // MEMBER_A has answered (going); MEMBER_B is silent → only B gets the ask.
    await rsvp(outing.outingId, MEMBER_A, "going");

    const stats = await sendDueOutingReminders(now);
    expect(stats.processed).toBeGreaterThanOrEqual(1);
    const ask = `Can you make it to Sweep Game ${RUN}?`;
    expect(await notifTitles(MEMBER_B)).toContain(ask);
    expect(await notifTitles(MEMBER_A)).not.toContain(ask);
    expect(await notifTitles(ORGANIZER)).not.toContain(ask);

    // The recurring series re-enqueued its NEXT occurrence…
    const next = new Date(Date.parse(start) + 7 * 24 * 60 * 60 * 1000).toISOString();
    const expected = buildReminderItem(outing.outingId, next, now);
    const requeued = await getItem<OutingReminderItem>({ pk: expected.pk, sk: expected.sk });
    expect(requeued?.occurrenceTs).toBe(next);

    // …and the processed row was CLAIMED: a second sweep never double-sends.
    const again = await sendDueOutingReminders(now);
    expect(again.notified).toBe(0);
    const asks = (await getMyNotifications(MEMBER_B)).filter((n) => n.title === ask);
    expect(asks).toHaveLength(1);
  });
});
