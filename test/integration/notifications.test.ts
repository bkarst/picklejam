import { describe, it, expect } from "vitest";
import {
  createNotification,
  getMyNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
} from "@/lib/data/notifications";
import { fanOut } from "@/lib/notify";

/**
 * Notification rail integration (PRD §9.3) against DynamoDB Local — skipped when
 * DYNAMODB_ENDPOINT is unset (CI provides it + provisions PickleLokoAppTest).
 * Asserts: create → list (ONE GSI1 query, newest-first) → unread count → mark one
 * read → mark all read, plus fan-out writing N notifications.
 *
 * Parallel-safe + re-runnable: a per-run token makes every uid unique.
 */
const d = process.env.DYNAMODB_ENDPOINT ? describe : describe.skip;

const RUN = Math.random().toString(36).slice(2, 8);
const uid = `notif-itest-${RUN}`;

d("notification rail (DynamoDB Local)", () => {
  it("create → list (GSI1, newest-first) → unread → markRead → markAllRead", async () => {
    const t0 = Date.now();
    const n1 = await createNotification(uid, { type: "system", title: "one" }, { now: new Date(t0) });
    await createNotification(uid, { type: "system", title: "two" }, { now: new Date(t0 + 1000) });
    await createNotification(
      uid,
      { type: "outing_rsvp", title: "three", body: "b", entityRef: "/outings/x" },
      { now: new Date(t0 + 2000) },
    );

    // One Query on GSI1, newest-first.
    const list = await getMyNotifications(uid);
    expect(list).toHaveLength(3);
    expect(list.map((n) => n.title)).toEqual(["three", "two", "one"]);
    expect(list.every((n) => n.readAt === null)).toBe(true);
    expect(list[0].channelsSent).toEqual(["inapp"]);
    expect(list[0].entityRef).toBe("/outings/x");

    expect(await getUnreadCount(uid)).toBe(3);

    await markRead(uid, n1.id, n1.ts);
    expect(await getUnreadCount(uid)).toBe(2);

    const marked = await markAllRead(uid);
    expect(marked).toBe(2);
    expect(await getUnreadCount(uid)).toBe(0);

    // markRead on an unknown id is a no-op (no throw, no phantom row).
    await markRead(uid, "does-not-exist", new Date(t0).toISOString());
    expect(await getUnreadCount(uid)).toBe(0);
  });

  it("fanOut writes one notification per recipient", async () => {
    const uids = [`${uid}-a`, `${uid}-b`, `${uid}-c`];
    await fanOut(uids, (u) => ({ type: "system", title: `game near ${u}` }));

    for (const u of uids) {
      const list = await getMyNotifications(u);
      expect(list).toHaveLength(1);
      expect(list[0].title).toBe(`game near ${u}`);
    }
  });
});
