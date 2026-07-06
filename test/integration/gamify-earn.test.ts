/**
 * gamify-earn.test.ts — the per-feature earn orchestrators (§G4.2 call sites) against
 * DynamoDB Local. Verifies the check-in/review earn sets, the E3 first-visit gate, and
 * the review-EDIT partial-overlap fix (E6 pays without re-paying E5).
 */
import { describe, it, expect } from "vitest";
import { earnCheckin, earnReview } from "@/lib/data/gamify-earn";
import { claimTrailblazer } from "@/lib/data/gamify-crew";
import { getGamifyProfile, getMyLedger } from "@/lib/data/gamify";

const hasLocal = !!process.env.DYNAMODB_ENDPOINT;
const d = hasLocal ? describe : describe.skip;

let seq = 0;
const uid = (): string => `earn-test-${Date.now()}-${seq++}`;

d("earnCheckin (DynamoDB Local)", () => {
  it("a first-EVER check-in awards E1+E3+E25 (50); a repeat visit is E1 only (10)", async () => {
    const u = uid();
    await claimTrailblazer("c1", "someone-else"); // isolate: this court is already discovered (no E4 here)
    const first = await earnCheckin({ uid: u, courtId: "c1", courtName: "Riverside", day: "20260705" });
    expect(first?.total).toBe(50); // E1 10 + E3 15 (first visit) + E25 25 (first-ever, starter step)
    expect(new Set(first?.awards.map((a) => a.rule))).toEqual(new Set(["E1", "E3", "E25"]));

    const repeat = await earnCheckin({ uid: u, courtId: "c1", courtName: "Riverside", day: "20260706" });
    expect(repeat?.total).toBe(10); // E3 + E25 already earned ⇒ E1 only
    expect(repeat?.awards.map((a) => a.rule)).toEqual(["E1"]);
  });

  it("awards E1+E2+E3 for a first-visit check-in with a note (30), then E1 only next time", async () => {
    const u = uid();
    await claimTrailblazer("cc", "someone-else"); // isolate from the court-global Trailblazer (E4)
    const first = await earnCheckin({
      uid: u, courtId: "cc", courtName: "Central", day: "20260705",
      note: "Great nets and plenty of open play tonight!",
    });
    expect(first?.total).toBe(55); // E1 10 + E2 5 + E3 15 + E25 25 (first-ever)
    expect(new Set(first?.awards.map((a) => a.rule))).toEqual(new Set(["E1", "E2", "E3", "E25"]));

    // A DIFFERENT day at the same court: E3 already earned ⇒ only E1 (+E2 for the note).
    const again = await earnCheckin({
      uid: u, courtId: "cc", courtName: "Central", day: "20260706", note: "Back again, still great here.",
    });
    expect(again?.awards.map((a) => a.rule).sort()).toEqual(["E1", "E2"]); // no E3
  });

  it("lookingToPlay alone triggers E2", async () => {
    const u = uid();
    const block = await earnCheckin({ uid: u, courtId: "cd", day: "20260705", lookingToPlay: true });
    expect(block?.awards.some((a) => a.rule === "E2")).toBe(true);
  });
});

d("earnReview (DynamoDB Local)", () => {
  it("first publish pays E5 (+E7 when verified)", async () => {
    const u = uid();
    const block = await earnReview({
      uid: u, courtId: "cr", courtName: "Riverside", body: "Nice courts.", hasPhoto: false, checkinVerified: true,
    });
    expect(block?.awards.map((a) => a.rule).sort()).toEqual(["E5", "E7"]);
    expect(block?.total).toBe(60);
  });

  it("an EDIT that adds a photo + long body pays E6 WITHOUT re-paying E5 (partial-overlap fix)", async () => {
    const u = uid();
    await earnReview({ uid: u, courtId: "cr2", body: "short", hasPhoto: false, checkinVerified: false }); // E5 only
    const longBody = Array.from({ length: 120 }, (_, i) => `word${i}`).join(" ");
    const edit = await earnReview({ uid: u, courtId: "cr2", body: longBody, hasPhoto: true, checkinVerified: false });
    expect(edit?.awards.map((a) => a.rule)).toEqual(["E6"]); // E5 filtered out (already earned)
    expect(edit?.total).toBe(25);

    // The profile reflects E5 (50) + E6 (25) exactly once each.
    const p = await getGamifyProfile(u);
    expect(p?.rp).toBe(75);
    const rules = (await getMyLedger(u)).items.map((i) => i.rule).sort();
    expect(rules).toEqual(["E5", "E6"]);
  });

  it("re-submitting an unchanged review pays nothing (idempotent no-op)", async () => {
    const u = uid();
    await earnReview({ uid: u, courtId: "cr3", body: "ok", hasPhoto: false, checkinVerified: false });
    const again = await earnReview({ uid: u, courtId: "cr3", body: "ok edited", hasPhoto: false, checkinVerified: false });
    expect(again).toBeUndefined(); // nothing new to award
  });
});

d("competition + organizing + starter earns (DynamoDB Local)", async () => {
  const {
    earnLeagueRegistration, earnTournamentRegistration, earnLeagueMatch, earnLadderMatch,
    earnStarterStep, awardOutingCompletion,
  } = await import("@/lib/data/gamify-earn");
  const { getGamifyProfile: profile, pruneStaleDailyEarn, awardXp } = await import("@/lib/data/gamify");
  const { updateItem } = await import("@/lib/db/client");
  const { gamifyKeys } = await import("@/lib/db/keys");

  it("league registration (E13=150) and tournament registration (E10=100)", async () => {
    const u = uid();
    expect((await earnLeagueRegistration(u, "l1"))?.total).toBe(150);
    expect((await earnTournamentRegistration(u, "t1", "d1"))?.total).toBe(100);
    expect((await profile(u))?.rp).toBe(250);
    // replay is a no-op
    expect(await earnLeagueRegistration(u, "l1")).toBeUndefined();
  });

  it("a confirmed league fixture pays E14 (25) to each of the two parties", async () => {
    const a = uid();
    const b = uid();
    await Promise.all([earnLeagueMatch(a, "lg", "m1"), earnLeagueMatch(b, "lg", "m1")]);
    expect((await profile(a))?.rp).toBe(25);
    expect((await profile(b))?.rp).toBe(25);
  });

  it("a ladder challenge pays E16 (25) to both participants", async () => {
    const a = uid();
    const b = uid();
    await Promise.all([earnLadderMatch(a, "ld", "c1"), earnLadderMatch(b, "ld", "c1")]);
    expect((await profile(a))?.rp).toBe(25);
    expect((await profile(b))?.rp).toBe(25);
  });

  it("starter steps pay E25 (25) each, once ever", async () => {
    const u = uid();
    for (const step of ["profile", "checkin", "follow"] as const) await earnStarterStep(u, step);
    expect((await profile(u))?.rp).toBe(75);
    expect(await earnStarterStep(u, "profile")).toBeUndefined(); // replay no-op
  });

  it("outing completion pays E19 to attendees and E20 to the host only when ≥4 were going", async () => {
    const host = uid();
    const goers = [uid(), uid(), uid(), host];
    await awardOutingCompletion({ outingId: "o1", goingUids: goers, hostUid: host, hostType: undefined, goingCount: 4 });
    // host: E19 (15, as a goer) + E20 (40) = 55; a plain goer: E19 (15)
    expect((await profile(goers[0]))?.rp).toBe(15);
    expect((await profile(host))?.rp).toBe(55);

    const soloHost = uid();
    await awardOutingCompletion({ outingId: "o2", goingUids: [soloHost, uid()], hostUid: soloHost, goingCount: 2 });
    expect((await profile(soloHost))?.rp).toBe(15); // < 4 going ⇒ E19 only, no host bonus
  });

  it("pruneStaleDailyEarn removes old day keys but keeps today's", async () => {
    const u = uid();
    await awardXp({ uid: u, earns: [{ rule: "E1", source: { rule: "E1", courtId: "cx", day: "20260101" }, label: "c" }] });
    // inject a stale key
    await updateItem({ key: gamifyKeys.profile(u), update: "SET dailyEarn.#old = :v", names: { "#old": "20200101#presence" }, values: { ":v": 50 } });
    const pruned = await pruneStaleDailyEarn(u);
    expect(pruned).toBe(1);
    const de = (await profile(u))?.dailyEarn ?? {};
    expect(Object.keys(de).some((k) => k.startsWith("20200101"))).toBe(false);
    expect(Object.keys(de).length).toBeGreaterThan(0); // today's key survives
  });
});

d("badges (§G6 · DynamoDB Local)", async () => {
  const { awardXp, revokeXp, getGamifyProfile } = await import("@/lib/data/gamify");
  const { getMyBadges } = await import("@/lib/data/gamify-badges");

  const snap = async (u: string) => {
    const p = await getGamifyProfile(u);
    return { ...(p!.counters), streakBest: p!.streakBest };
  };

  it("crossing a counter threshold awards the tier (Scout Bronze on first review)", async () => {
    const u = uid();
    const res = await awardXp({ uid: u, earns: [{ rule: "E5", source: { rule: "E5", courtId: "c1" }, label: "Review" }] });
    expect(res.badges?.map((b) => b.familyId)).toContain("scout");
    expect(res.badges?.find((b) => b.familyId === "scout")?.tier).toBe(1);

    const view = await getMyBadges(u, await snap(u), []);
    const scout = view.entries.find((e) => e.familyId === "scout");
    expect(scout?.tier).toBe(1);
    expect(scout?.tierName).toBe("Bronze");
    expect(view.earnedCount).toBe(1);
  });

  it("badge tier is monotonic — a revocation lowers the counter but never confiscates the tier", async () => {
    const u = uid();
    await awardXp({ uid: u, earns: [{ rule: "E5", source: { rule: "E5", courtId: "cm" }, label: "Review" }] }); // Scout Bronze
    await revokeXp({ uid: u, earns: [{ rule: "E5", source: { rule: "E5", courtId: "cm" }, label: "Revoked" }] }); // reviews → 0
    expect((await getGamifyProfile(u))?.counters.reviews).toBe(0);
    const view = await getMyBadges(u, await snap(u), []);
    expect(view.entries.find((e) => e.familyId === "scout")?.tier).toBe(1); // kept
  });

  it("locked families render endowed progress toward the next tier", async () => {
    const u = uid();
    await awardXp({ uid: u, earns: [{ rule: "E5", source: { rule: "E5", courtId: "cp" }, label: "Review" }] });
    const view = await getMyBadges(u, await snap(u), []);
    const explorer = view.entries.find((e) => e.familyId === "explorer");
    expect(explorer?.tier).toBe(0);
    expect(explorer?.progress).toEqual({ count: 0, nextThreshold: 3 });
  });
});

d("Play Streak crediting (§G8 · DynamoDB Local)", async () => {
  const { creditPlayedWeek } = await import("@/lib/data/gamify-streak");
  const { awardXp, getGamifyProfile: prof } = await import("@/lib/data/gamify");
  const WEEK = 7 * 86_400_000;
  const monday = Date.parse("2026-01-05T12:00:00Z"); // Monday, 2026-W02

  it("advances the streak week over week; week 4 pays the E28 milestone + banks a Rain Check", async () => {
    const u = uid();
    await awardXp({ uid: u, earns: [{ rule: "E24", source: { rule: "E24" }, label: "welcome" }] });
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await creditPlayedWeek(u, monday + i * WEEK));
    expect(results.map((r) => r!.weeks)).toEqual([1, 2, 3, 4]);
    expect(results[3]!.milestone).toBe(4);
    const p = await prof(u);
    expect(p?.streakWeeks).toBe(4);
    expect(p?.streakBest).toBe(4);
    expect(p?.rainChecks).toBe(1);
    expect((await getMyLedger(u)).items.some((l) => l.rule === "E28")).toBe(true); // milestone RP
  });

  it("is idempotent within a week (only the first play credits)", async () => {
    const u = uid();
    await awardXp({ uid: u, earns: [{ rule: "E24", source: { rule: "E24" }, label: "w" }] });
    const first = await creditPlayedWeek(u, monday);
    const second = await creditPlayedWeek(u, monday);
    expect(first?.firstOfWeek).toBe(true);
    expect(second?.firstOfWeek).toBe(false);
    expect((await prof(u))?.streakWeeks).toBe(1);
  });

  it("a missed week with a banked Rain Check preserves the chain without incrementing", async () => {
    const u = uid();
    await awardXp({ uid: u, earns: [{ rule: "E24", source: { rule: "E24" }, label: "w" }] });
    for (let i = 0; i < 4; i++) await creditPlayedWeek(u, monday + i * WEEK); // chain 4, 1 Rain Check
    // skip week 5, play week 6 → Rain Check covers the gap, then week increments to 5
    const r = await creditPlayedWeek(u, monday + 5 * WEEK);
    expect(r?.weeks).toBe(5);
    expect((await prof(u))?.rainChecks).toBe(0); // spent
  });

  it("earnCheckin surfaces the streak tick on the first play of the week", async () => {
    const u = uid();
    const block = await earnCheckin({ uid: u, courtId: "cstreak", day: "20260705" });
    expect(block?.streak?.firstOfWeek).toBe(true);
    expect(block?.streak?.weeks).toBe(1);
  });
});

d("weekly quests (§G9 · DynamoDB Local)", async () => {
  const { ensureWeeklyQuests, tickQuests, getWeekQuests } = await import("@/lib/data/gamify-quests");
  const { awardXp } = await import("@/lib/data/gamify");
  const { isoWeekOf } = await import("@/lib/gamify/time");
  const now = Date.parse("2026-01-07T12:00:00Z"); // Wed, 2026-W02
  const week = isoWeekOf("UTC", now);
  const newProfile = async (u: string) =>
    (await awardXp({ uid: u, earns: [{ rule: "E24", source: { rule: "E24" }, label: "w" }] })).profile;

  it("instantiates the fallback trio, ticks count + distinct quests, and completes → E26", async () => {
    const u = uid();
    const quests = await ensureWeeklyQuests(u, now, await newProfile(u));
    expect(quests.map((q) => q.slug).sort()).toEqual(["checkin3", "lookingtoplay", "twocourts"]);

    await tickQuests(u, [{ rule: "E1", courtId: "cA" }], now);
    await tickQuests(u, [{ rule: "E1", courtId: "cA" }], now); // same court
    await tickQuests(u, [{ rule: "E1", courtId: "cB" }], now); // new court → both complete

    const { active } = await getWeekQuests(u, week);
    expect(active.find((q) => q.slug === "checkin3")).toMatchObject({ count: 3, completed: true });
    expect(active.find((q) => q.slug === "twocourts")).toMatchObject({ count: 2, completed: true });
    const e26 = (await getMyLedger(u)).items.filter((l) => l.rule === "E26");
    expect(e26.length).toBe(2); // checkin3 (30) + twocourts (40)
    expect(e26.reduce((s, l) => s + l.points, 0)).toBe(70);
  });

  it("lazy instantiation is race-safe — exactly 3 rows under concurrency", async () => {
    const u = uid();
    const p = await newProfile(u);
    await Promise.all([ensureWeeklyQuests(u, now, p), ensureWeeklyQuests(u, now, p), ensureWeeklyQuests(u, now, p)]);
    expect((await getWeekQuests(u, week)).active.length).toBe(3);
  });

  it("lookingtoplay ticks only on E2 WITH the flag", async () => {
    const u = uid();
    await ensureWeeklyQuests(u, now, await newProfile(u));
    await tickQuests(u, [{ rule: "E2" }], now); // no flag → no tick
    expect((await getWeekQuests(u, week)).active.find((q) => q.slug === "lookingtoplay")?.count).toBe(0);
    await tickQuests(u, [{ rule: "E2", lookingToPlay: true }], now);
    expect((await getWeekQuests(u, week)).active.find((q) => q.slug === "lookingtoplay")).toMatchObject({
      count: 1,
      completed: true,
    });
  });
});

d("digest + streak reminder (§G12.19/§G14 · DynamoDB Local)", async () => {
  const { buildWeeklyDigest, notifyStreakAtRisk } = await import("@/lib/data/gamify-digest");
  const { awardXp, updateGamifyPrefs } = await import("@/lib/data/gamify");
  const { getMyNotifications } = await import("@/lib/data/notifications");
  const { updateItem } = await import("@/lib/db/client");
  const { gamifyKeys } = await import("@/lib/db/keys");
  const now = Date.parse("2026-01-07T12:00:00Z"); // Wed, 2026-W02

  it("assembles the weekly digest from this week's ledger + quests", async () => {
    const u = uid();
    await awardXp({ uid: u, earns: [{ rule: "E13", source: { rule: "E13", lid: "ld" }, label: "reg" }], now }); // +150 this week
    const digest = await buildWeeklyDigest(u, now);
    expect(digest?.rpThisWeek).toBe(150);
    expect(digest?.level).toBe(2);
    expect(digest?.levelName).toBe("Dinker");
  });

  it("streak reminder fires only when opted-in and this week is unplayed", async () => {
    const u = uid();
    await awardXp({ uid: u, earns: [{ rule: "E24", source: { rule: "E24" }, label: "w" }], now });
    // default: streakReminders off, no streak → no reminder
    expect(await notifyStreakAtRisk(u, now)).toBe(false);
    // opt in + give a streak, still unplayed this week
    await updateGamifyPrefs(u, { streakReminders: true });
    await updateItem({ key: gamifyKeys.profile(u), update: "SET streakWeeks = :s, lastPlayedWeek = :w", values: { ":s": 3, ":w": "2026-W01" } });
    expect(await notifyStreakAtRisk(u, now)).toBe(true);
    expect((await getMyNotifications(u)).some((n) => n.type === "streak_at_risk")).toBe(true);
  });
});

d("leaderboards (§G13.6 · DynamoDB Local)", async () => {
  const { tallyCourtCheckin, getCourtBoard, getMyCourtTally } = await import("@/lib/data/gamify-boards");
  const { putItem } = await import("@/lib/db/client");
  const { userKeys } = await import("@/lib/db/keys");
  const { ensureGamifyProfile, updateGamifyPrefs } = await import("@/lib/data/gamify");

  async function player(name: string, opts?: { hidden?: boolean; priv?: boolean }): Promise<string> {
    const u = uid();
    await putItem({
      ...userKeys.profile(u), entity: "USER", uid: u, username: u, displayName: name,
      visibility: opts?.priv ? "private" : "public", createdAt: "2026-01-01", updatedAt: "2026-01-01",
    });
    await ensureGamifyProfile(u);
    if (opts?.hidden) await updateGamifyPrefs(u, { leaderboards: "hidden" });
    return u;
  }

  it("ranks a court board by check-in days; hidden/private users are off RANK but keep a self-tally", async () => {
    const court = `court-${Date.now()}-${seq}`;
    const month = "202607";
    const a = await player("Alice");
    const b = await player("Bob");
    const hank = await player("Hank", { hidden: true });
    const priv = await player("Priv", { priv: true });

    for (let i = 0; i < 3; i++) await tallyCourtCheckin(court, month, a); // Alice 3
    await tallyCourtCheckin(court, month, b); // Bob 1
    for (let i = 0; i < 5; i++) await tallyCourtCheckin(court, month, hank); // Hank 5 (hidden)
    for (let i = 0; i < 4; i++) await tallyCourtCheckin(court, month, priv); // Priv 4 (private)

    const board = await getCourtBoard(court, month);
    const names = board.map((r) => r.displayName);
    expect(names).toEqual(["Alice", "Bob"]); // ranked; hidden + private excluded
    expect(board[0].value).toBe(3);
    expect(board[0].rank).toBe(1);
    expect(await getMyCourtTally(court, month, hank)).toBe(5); // hidden still self-ranks
    expect(await getMyCourtTally(court, month, priv)).toBe(4);
  });

  it("recomputes movement vs the prior month", async () => {
    const court = `mv-${Date.now()}-${seq}`;
    const a = await player("A");
    const b = await player("B");
    // June: A=1 (rank1), B=2 → wait, higher value = rank1. B=2 rank1, A=1 rank2.
    await tallyCourtCheckin(court, "202606", a);
    for (let i = 0; i < 2; i++) await tallyCourtCheckin(court, "202606", b);
    // July: A surges to 5 (rank1), B stays 1 (rank2) → A moves up 1, B down 1.
    for (let i = 0; i < 5; i++) await tallyCourtCheckin(court, "202607", a);
    await tallyCourtCheckin(court, "202607", b);
    const board = await getCourtBoard(court, "202607");
    expect(board.find((r) => r.displayName === "A")).toMatchObject({ rank: 1, movement: 1 }); // 2 → 1
    expect(board.find((r) => r.displayName === "B")).toMatchObject({ rank: 2, movement: -1 }); // 1 → 2
  });
});
