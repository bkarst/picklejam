/**
 * gamify-crew.test.ts — Court Crew, Captain & Trailblazer (§G7) against DynamoDB Local.
 *
 * Covers the race-safe first-forever claims (Trailblazer / First Reviewer), the threshold
 * Crew roster with its rolling two-month window + privacy filtering, viewer crew progress,
 * and the monthly Captain crowning (max check-in days, min 6, privacy-respecting).
 * Skipped locally when DYNAMODB_ENDPOINT is unset (CI provisions it).
 */
import { describe, it, expect } from "vitest";
import {
  claimTrailblazer,
  claimFirstReviewer,
  getCourtCrew,
  getCrewProgress,
  crownCaptain,
  getCourtStatus,
  getCaptainHistory,
} from "@/lib/data/gamify-crew";
import { tallyCourtCheckin } from "@/lib/data/gamify-boards";
import { earnCheckin } from "@/lib/data/gamify-earn";
import { ensureGamifyProfile } from "@/lib/data/gamify";
import { buildProfileItem, buildRatingItem, upsertRating } from "@/lib/data/users";
import { getItem, putItem } from "@/lib/db/client";
import { courtKeys, gamifyKeys } from "@/lib/db/keys";
import type { CourtItem, BadgeAwardItem, NotificationItem } from "@/lib/db/types";

const d = process.env.DYNAMODB_ENDPOINT ? describe : describe.skip;

let seq = 0;
const uid = (): string => `crew-test-${Date.now()}-${seq++}`;
const court = (tag: string): string => `crew-court-${Date.now()}-${seq++}-${tag}`;

async function seedUser(
  u: string,
  opts: { visibility?: "public" | "unlisted" | "private"; checkinVisibility?: "public" | "private"; leaderboards?: "public" | "hidden"; name?: string } = {},
): Promise<void> {
  await putItem(
    buildProfileItem({
      uid: u,
      username: `crew-${u}`,
      displayName: opts.name ?? u,
      visibility: opts.visibility ?? "public",
      ...(opts.checkinVisibility ? { checkinVisibility: opts.checkinVisibility } : {}),
    }) as unknown as Record<string, unknown>,
  );
  await ensureGamifyProfile(u);
  if (opts.leaderboards === "hidden") {
    const { updateItem } = await import("@/lib/db/client");
    await updateItem({ key: gamifyKeys.profile(u), update: "SET prefs.leaderboards = :h", values: { ":h": "hidden" } });
  }
}

/** Add `n` check-in days for a user at a court in a given month (bypasses the day dedup). */
async function tallyDays(courtId: string, month: string, u: string, n: number): Promise<void> {
  for (let i = 0; i < n; i++) await tallyCourtCheckin(courtId, month, u);
}

async function badge(u: string, familyId: string): Promise<BadgeAwardItem | undefined> {
  const key = gamifyKeys.badge(u, familyId, "");
  return getItem<BadgeAwardItem>({ pk: key.pk, sk: key.sk });
}

d("Trailblazer & First Reviewer claims (DynamoDB Local)", () => {
  it("a first-ever check-in claim is race-safe — exactly one winner, who gets the badge", async () => {
    const a = uid();
    const b = uid();
    const c = court("tb");
    const [wa, wb] = await Promise.all([claimTrailblazer(c, a), claimTrailblazer(c, b)]);
    expect([wa, wb].filter(Boolean).length).toBe(1); // exactly one winner

    const winner = wa ? a : b;
    const loser = wa ? b : a;
    const meta = await getItem<CourtItem>(courtKeys.meta(c));
    expect(meta?.trailblazerUid).toBe(winner);
    expect((await badge(winner, "trailblazer"))?.tier).toBe(0); // winner has the badge
    expect(await badge(loser, "trailblazer")).toBeUndefined();
  });

  it("re-claiming an already-discovered court is a no-op (idempotent)", async () => {
    const a = uid();
    const b = uid();
    const c = court("tb2");
    expect(await claimTrailblazer(c, a)).toBe(true);
    expect(await claimTrailblazer(c, b)).toBe(false); // already claimed
    const meta = await getItem<CourtItem>(courtKeys.meta(c));
    expect(meta?.trailblazerUid).toBe(a); // unchanged
  });

  it("First Reviewer is a separate first-forever claim + badge", async () => {
    const a = uid();
    const b = uid();
    const c = court("fr");
    expect(await claimFirstReviewer(c, a)).toBe(true);
    expect(await claimFirstReviewer(c, b)).toBe(false);
    const meta = await getItem<CourtItem>(courtKeys.meta(c));
    expect(meta?.firstReviewerUid).toBe(a);
    expect((await badge(a, "first-reviewer"))?.tier).toBe(0);
  });

  it("earnCheckin at a brand-new court awards E4 + surfaces the Trailblazer badge in the block", async () => {
    const u = uid();
    await seedUser(u);
    const c = court("e4");
    const block = await earnCheckin({ uid: u, courtId: c, courtName: "Pioneer Park", day: "20260705" });
    expect(block?.awards.some((x) => x.rule === "E4")).toBe(true);
    expect(block?.badges?.some((x) => x.familyId === "trailblazer")).toBe(true);
    expect((await badge(u, "trailblazer"))?.tier).toBe(0);

    // A second user's first check-in at the SAME court gets NO E4 (already discovered).
    const u2 = uid();
    await seedUser(u2);
    const block2 = await earnCheckin({ uid: u2, courtId: c, courtName: "Pioneer Park", day: "20260705" });
    expect(block2?.awards.some((x) => x.rule === "E4")).toBe(false);
  });
});

d("Court Crew roster (DynamoDB Local)", () => {
  it("includes ≥4-day public members, excludes below-threshold and private, sorted by days", async () => {
    const month = "202607";
    const c = court("crew");
    const crewA = uid(); // 5 days — crew
    const crewB = uid(); // 4 days — crew
    const notC = uid(); // 3 days — below threshold
    const privD = uid(); // 6 days but private profile
    const hiddenE = uid(); // 6 days but checkinVisibility private
    await Promise.all([
      seedUser(crewA, { name: "Ada" }),
      seedUser(crewB, { name: "Ben" }),
      seedUser(notC, { name: "Cal" }),
      seedUser(privD, { visibility: "private", name: "Dot" }),
      seedUser(hiddenE, { checkinVisibility: "private", name: "Eve" }),
    ]);
    await tallyDays(c, month, crewA, 5);
    await tallyDays(c, month, crewB, 4);
    await tallyDays(c, month, notC, 3);
    await tallyDays(c, month, privD, 6);
    await tallyDays(c, month, hiddenE, 6);

    await upsertRating(buildRatingItem({ uid: crewA, system: "SELF", value: 3.5, verified: false }));

    const crew = await getCourtCrew(c, month);
    expect(crew.map((m) => m.uid)).toEqual([crewA, crewB]); // sorted by days desc, privates gone
    expect(crew[0].days).toBe(5);
    // Anonymous (§6.2): a member carries at most a headline rating, never identity.
    expect(crew[0].rating).toBe(3.5);
    expect(crew[1].rating).toBeUndefined();
    expect(Object.keys(crew[0]).sort()).toEqual(["days", "rating", "uid"]);
  });

  it("counts the rolling current + previous month toward the ≥4 threshold", async () => {
    const cur = "202607";
    const prev = "202606";
    const c = court("crew2");
    const u = uid();
    await seedUser(u);
    await tallyDays(c, prev, u, 2);
    await tallyDays(c, cur, u, 2); // 2 + 2 = 4 across the window ⇒ crew
    const crew = await getCourtCrew(c, cur);
    expect(crew.map((m) => m.uid)).toContain(u);
  });

  it("getCrewProgress reports this-month days and crew status", async () => {
    const cur = "202607";
    const prev = "202606";
    const c = court("prog");
    const u = uid();
    await seedUser(u);
    await tallyDays(c, prev, u, 1);
    await tallyDays(c, cur, u, 3); // this month 3, window total 4 ⇒ crew
    const p = await getCrewProgress(c, u, cur);
    expect(p.monthDays).toBe(3);
    expect(p.isCrew).toBe(true);

    const other = uid();
    await seedUser(other);
    await tallyDays(c, cur, other, 1);
    const p2 = await getCrewProgress(c, other, cur);
    expect(p2).toEqual({ monthDays: 1, isCrew: false });
  });
});

d("Court Captain crowning (DynamoDB Local)", () => {
  it("crowns the most-active public member (min 6 days), writes meta + notification", async () => {
    const month = "202607";
    const c = court("cap");
    const top = uid(); // 9 days — captain
    const runner = uid(); // 7 days
    const low = uid(); // 5 days — below the min
    await Promise.all([seedUser(top, { name: "Cap" }), seedUser(runner), seedUser(low)]);
    await tallyDays(c, month, top, 9);
    await tallyDays(c, month, runner, 7);
    await tallyDays(c, month, low, 5);

    const crowned = await crownCaptain(c, month);
    expect(crowned).toBe(top);
    const meta = await getItem<CourtItem>(courtKeys.meta(c));
    expect(meta?.captainUid).toBe(top);
    expect(meta?.captainMonth).toBe(month);

    // The captain got a court_captain notification.
    const { query } = await import("@/lib/db/client");
    const { notifKeys } = await import("@/lib/db/keys");
    const { items } = await query<NotificationItem>({ pk: notifKeys.notif(top, "", "").pk, skBeginsWith: notifKeys.notifPrefix() });
    expect(items.some((n) => n.type === "court_captain")).toBe(true);
  });

  it("skips a private front-runner and crowns the next eligible; null when none reach the min", async () => {
    const month = "202607";
    const c = court("cap2");
    const privTop = uid(); // 10 days but private
    const eligible = uid(); // 6 days — the real captain
    await Promise.all([seedUser(privTop, { visibility: "private" }), seedUser(eligible)]);
    await tallyDays(c, month, privTop, 10);
    await tallyDays(c, month, eligible, 6);
    expect(await crownCaptain(c, month)).toBe(eligible);

    // A court where nobody reaches 6 ⇒ no captain.
    const empty = court("cap3");
    const u = uid();
    await seedUser(u);
    await tallyDays(empty, month, u, 5);
    expect(await crownCaptain(empty, month)).toBeNull();
  });
});

d("Court status line & captain history (DynamoDB Local)", () => {
  it("getCourtStatus is anonymous: Captain + Trailblazer carry only a rating", async () => {
    const capUid = uid();
    const tbUid = uid();
    await Promise.all([seedUser(capUid, { name: "Cappy" }), seedUser(tbUid, { name: "Blazer" })]);
    await Promise.all([
      upsertRating(buildRatingItem({ uid: capUid, system: "SELF", value: 3.5, verified: false })),
      upsertRating(buildRatingItem({ uid: tbUid, system: "SELF", value: 4.0, verified: false })),
    ]);

    const status = await getCourtStatus({
      captainUid: capUid,
      captainMonth: "202606",
      trailblazerUid: tbUid,
      trailblazerAt: "2026-03-05T12:00:00.000Z",
    });
    // Check-ins are anonymous (§6.2): even public profiles carry no identity — rating only.
    expect(status.captain).toEqual({ rating: 3.5, month: "202606" });
    expect(status.trailblazer).toEqual({ rating: 4.0, at: "2026-03-05T12:00:00.000Z" });
  });

  it("getCourtStatus trailblazer omits the rating when the player has none", async () => {
    const tbUid = uid();
    await seedUser(tbUid, { visibility: "private", name: "Secret" });
    const status = await getCourtStatus({ trailblazerUid: tbUid, trailblazerAt: "2026-03-05T12:00:00.000Z" });
    expect(status.trailblazer).toEqual({ at: "2026-03-05T12:00:00.000Z" });
  });

  it("crownCaptain records into the board meta, and getCaptainHistory reads recent months anonymously", async () => {
    const c = court("hist");
    const capUid = uid();
    await seedUser(capUid, { name: "Historic" });
    await upsertRating(buildRatingItem({ uid: capUid, system: "SELF", value: 4.5, verified: false }));
    await tallyDays(c, "202606", capUid, 8);
    await crownCaptain(c, "202606");

    const history = await getCaptainHistory(c, "202607", 6); // current + back 5 covers 202606
    expect(history.map((h) => h.month)).toContain("202606");
    // Anonymous (§6.2): month + headline rating only — no uid, name, or link data.
    expect(history.find((h) => h.month === "202606")).toEqual({ month: "202606", rating: 4.5 });
  });

  it("getCourtStatus returns {} when the court has neither fact", async () => {
    expect(await getCourtStatus({})).toEqual({});
  });
});
