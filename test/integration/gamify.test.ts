/**
 * gamify.test.ts — awardXp exactly-once + caps + reconcile against DynamoDB Local
 * (§G13.2, §14.6). Skipped locally when DYNAMODB_ENDPOINT is unset (CI provisions it).
 */
import { describe, it, expect } from "vitest";
import {
  awardXp,
  getGamifyProfile,
  getMyLedger,
  reconcileGamifyProfile,
  revokeXp,
} from "@/lib/data/gamify";
import { updateItem, query } from "@/lib/db/client";
import { gamifyKeys } from "@/lib/db/keys";
import type { XpLedgerItem } from "@/lib/db/types";

const hasLocal = !!process.env.DYNAMODB_ENDPOINT;
const d = hasLocal ? describe : describe.skip;

// Unique uid per test so partitions never collide.
let seq = 0;
const uid = (): string => `gamify-test-${Date.now()}-${seq++}`;

const ledgerCount = async (u: string): Promise<number> =>
  (await query<XpLedgerItem>({ pk: gamifyKeys.profile(u).pk, skBeginsWith: gamifyKeys.ledgerPrefix() })).items.length;

d("awardXp (DynamoDB Local)", () => {
  it("creates the profile lazily and awards the welcome bonus (patterns 29 + 30)", async () => {
    const u = uid();
    const res = await awardXp({ uid: u, earns: [{ rule: "E24", source: { rule: "E24" }, label: "Welcome bonus" }] });
    expect(res.awarded).toBe(true);
    expect(res.total).toBe(25);

    const profile = await getGamifyProfile(u); // #29
    expect(profile?.rp).toBe(25);
    expect(profile?.level).toBe(1);

    const { items } = await getMyLedger(u); // #30
    expect(items).toHaveLength(1);
    expect(items[0].sourceKey).toBe("E24");
  });

  it("replays award EXACTLY once — a single ledger row + single ADD", async () => {
    const u = uid();
    const earn = { rule: "E1" as const, source: { rule: "E1" as const, courtId: "c1", day: "20260705" }, label: "Check-in" };
    const first = await awardXp({ uid: u, earns: [earn] });
    const second = await awardXp({ uid: u, earns: [earn] }); // identical action ⇒ replay

    expect(first.awarded).toBe(true);
    expect(second.awarded).toBe(false); // idempotent no-op
    expect(await ledgerCount(u)).toBe(1);
    expect((await getGamifyProfile(u))?.rp).toBe(10); // NOT 20
  });

  it("awards a multi-rule check-in with the right total and counters", async () => {
    const u = uid();
    const res = await awardXp({
      uid: u,
      earns: [
        { rule: "E1", source: { rule: "E1", courtId: "cx", day: "20260705" }, label: "Check-in" },
        { rule: "E2", source: { rule: "E2", courtId: "cx", day: "20260705" }, label: "Note" },
        { rule: "E3", source: { rule: "E3", courtId: "cx" }, label: "New court" },
      ],
    });
    expect(res.total).toBe(30);
    const p = await getGamifyProfile(u);
    expect(p?.counters.checkins).toBe(1);
    expect(p?.counters.courtsVisited).toBe(1);
  });

  it("fires a level-up when the watermark crosses a threshold", async () => {
    const u = uid();
    await awardXp({ uid: u, earns: [{ rule: "E13", source: { rule: "E13", lid: "l1" }, label: "League reg" }] }); // 150
    const res = await awardXp({ uid: u, earns: [{ rule: "E15", source: { rule: "E15", lid: "l1" }, label: "Season" }] }); // +200 → 350
    expect(res.levelUp).toEqual({ level: 3, name: "Rally Regular" });
    expect((await getGamifyProfile(u))?.level).toBe(3);
  });

  it("rejects an over-cap presence earn cleanly — nothing written, capped:true", async () => {
    const u = uid();
    // Prime dailyEarn to 150 (the presence cap) for today via 15 distinct check-ins.
    // Use a single big competition earn is uncapped; instead push presence to the limit:
    // 150/10 = 15 distinct-court check-ins today.
    for (let i = 0; i < 15; i++) {
      await awardXp({
        uid: u,
        earns: [{ rule: "E1", source: { rule: "E1", courtId: `court-${i}`, day: dayToday() }, label: "Check-in" }],
      });
    }
    const before = (await getGamifyProfile(u))?.rp;
    const capped = await awardXp({
      uid: u,
      earns: [{ rule: "E1", source: { rule: "E1", courtId: "court-over", day: dayToday() }, label: "Over cap" }],
    });
    expect(capped.awarded).toBe(false);
    expect(capped.capped).toBe(true);
    expect((await getGamifyProfile(u))?.rp).toBe(before); // nothing written
  });

  it("revocation appends #REV and subtracts, freezing the level", async () => {
    const u = uid();
    await awardXp({ uid: u, earns: [{ rule: "E13", source: { rule: "E13", lid: "l9" }, label: "League reg" }] }); // 150 → Level 2
    const before = await getGamifyProfile(u);
    await revokeXp({ uid: u, earns: [{ rule: "E13", source: { rule: "E13", lid: "l9" }, label: "Refund" }] });
    const after = await getGamifyProfile(u);
    expect(after?.rp).toBe((before?.rp ?? 0) - 150);
    expect(after?.level).toBe(before?.level); // level never regresses
    expect(after?.rpLevelWatermark).toBe(before?.rpLevelWatermark);
  });

  it("reconcile heals an injected profile/ledger divergence", async () => {
    const u = uid();
    await awardXp({ uid: u, earns: [{ rule: "E13", source: { rule: "E13", lid: "lz" }, label: "League reg" }] });
    // Corrupt the aggregate.
    await updateItem({ key: gamifyKeys.profile(u), update: "SET rp = :bad, rpLifetime = :bad", values: { ":bad": 9999 } });
    const healed = await reconcileGamifyProfile(u);
    expect(healed?.rp).toBe(150); // recomputed from the ledger
    expect(healed?.rpLifetime).toBe(150);
  });
});

function dayToday(): string {
  const d2 = new Date();
  return `${d2.getUTCFullYear()}${String(d2.getUTCMonth() + 1).padStart(2, "0")}${String(d2.getUTCDate()).padStart(2, "0")}`;
}

d("gamify view / prefs / ledger (DynamoDB Local)", async () => {
  const { getGamifyMe, updateGamifyPrefs, getGamifyProfile, awardXp } = await import("@/lib/data/gamify");

  it("getGamifyMe returns a null profile for a fresh user and defaults on prefs", async () => {
    const u = uid();
    const view = await getGamifyMe(u);
    expect(view.profile).toBeNull();
    expect(view.enabled).toBe(true);
    expect(view.prefs.enabled).toBe(true);
    expect(view.prefs.streakReminders).toBe(false);
  });

  it("getGamifyMe self-heals the stored tz from the browser value", async () => {
    const u = uid();
    await awardXp({ uid: u, earns: [{ rule: "E24", source: { rule: "E24" }, label: "Welcome" }] });
    await getGamifyMe(u, { browserTz: "America/Chicago" });
    expect((await getGamifyProfile(u))?.tz).toBe("America/Chicago");
  });

  it("getGamifyMe projects the level view", async () => {
    const u = uid();
    await awardXp({ uid: u, earns: [{ rule: "E13", source: { rule: "E13", lid: "lm" }, label: "reg" }] }); // 150 → L2
    const view = await getGamifyMe(u);
    expect(view.profile?.level).toBe(2);
    expect(view.profile?.levelName).toBe("Dinker");
    expect(view.profile?.rp).toBe(150);
  });

  it("updateGamifyPrefs merges only the provided keys", async () => {
    const u = uid();
    await awardXp({ uid: u, earns: [{ rule: "E24", source: { rule: "E24" }, label: "Welcome" }] });
    const prefs = await updateGamifyPrefs(u, { enabled: false });
    expect(prefs.enabled).toBe(false);
    expect(prefs.leaderboards).toBe("public"); // untouched
    const view = await getGamifyMe(u);
    expect(view.enabled).toBe(false); // effective visibility off
  });

  it("ledger paginates with a cursor", async () => {
    const u = uid();
    for (let i = 0; i < 3; i++) {
      await awardXp({ uid: u, earns: [{ rule: "E1", source: { rule: "E1", courtId: `p${i}`, day: "20260705" }, label: "c" }] });
    }
    const page1 = await getMyLedger(u, { limit: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.cursor).toBeDefined();
    const page2 = await getMyLedger(u, { limit: 2, cursor: page1.cursor });
    expect(page2.items).toHaveLength(1);
  });
});

d("gamify notifications (§G14)", async () => {
  const { awardXp, updateGamifyPrefs } = await import("@/lib/data/gamify");
  const { getMyNotifications } = await import("@/lib/data/notifications");

  it("a level-up creates a level_up notification; the master switch silences it", async () => {
    // enabled (default) → notification
    const on = uid();
    await awardXp({ uid: on, earns: [{ rule: "E13", source: { rule: "E13", lid: "ln1" }, label: "reg" }] }); // 150 → Level 2
    expect((await getMyNotifications(on)).some((n) => n.type === "level_up")).toBe(true);

    // prefs.enabled = false → the whole gamify family is silenced
    const off = uid();
    await updateGamifyPrefs(off, { enabled: false });
    await awardXp({ uid: off, earns: [{ rule: "E13", source: { rule: "E13", lid: "ln2" }, label: "reg" }] }); // 150 → Level 2
    expect((await getMyNotifications(off)).some((n) => n.type === "level_up")).toBe(false);
  });
});
