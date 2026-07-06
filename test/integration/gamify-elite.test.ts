/**
 * gamify-elite.test.ts — the Elite program data layer (§G11) against DynamoDB Local:
 * `computeEliteStats` from seeded reviews/ledger/strikes, the config evaluator, idempotent
 * nomination + auto-flag, and admin approve/reject (badge + roster + `eliteYears` + audit).
 * Skipped locally when DYNAMODB_ENDPOINT is unset.
 */
import { describe, it, expect } from "vitest";
import {
  computeEliteStats,
  evaluateEliteEligibility,
  nominateElite,
  autoFlagElite,
  getEliteRoster,
  decideElite,
  getEliteCohort,
  getMyEliteStatus,
} from "@/lib/data/gamify-elite";
import { issueStrike } from "@/lib/data/gamify-moderation";
import { getGamifyProfile, ensureGamifyProfile } from "@/lib/data/gamify";
import { buildProfileItem } from "@/lib/data/users";
import { getItem, putItem } from "@/lib/db/client";
import { gamifyKeys, courtKeys, userKeys } from "@/lib/db/keys";

const d = process.env.DYNAMODB_ENDPOINT ? describe : describe.skip;

const YEAR = "2026";
let seq = 0;
const uid = (): string => `elite-test-${Date.now()}-${seq++}`;
const iso = (i: number): string => `${YEAR}-06-${String((i % 27) + 1).padStart(2, "0")}T12:00:00.000Z`;
const body80 = Array.from({ length: 85 }, (_, i) => `word${i}`).join(" ");

async function seedXp(u: string, rule: string, sourceKey: string, ts: string, points = 10) {
  const k = gamifyKeys.ledger(u, sourceKey, ts);
  await putItem({ ...k, entity: "XP", uid: u, rule, points, sourceKey, label: rule, ts, createdAt: ts } as unknown as Record<string, unknown>);
}
async function seedReview(u: string, courtId: string, ts: string, verified: boolean, body = body80) {
  const k = courtKeys.reviewByUser(courtId, u, ts);
  await putItem({ ...k, entity: "REVIEW", courtId, uid: u, rating1to5: 5, body, checkinVerified: verified, helpfulCount: 0, createdAt: ts, updatedAt: ts } as unknown as Record<string, unknown>);
}

/** Seed a user who exactly clears every Elite threshold. */
async function seedQualifying(u: string) {
  await putItem(buildProfileItem({ uid: u, username: u, displayName: `Elite ${u}`, visibility: "public" }) as unknown as Record<string, unknown>);
  await ensureGamifyProfile(u);
  for (let i = 0; i < 40; i++) await seedXp(u, "E1", `E1#court${i}#${YEAR}0601`, iso(i)); // 40 check-ins
  await seedXp(u, "E10", `E10#t1#d1`, iso(1), 100); // 1 competition entry
  for (let i = 0; i < 12; i++) await seedReview(u, `court-${u}-${i}`, iso(i), i < 8); // 12 reviews, 8 verified (>60%)
}

d("Elite stats & evaluation (DynamoDB Local)", () => {
  it("computeEliteStats reflects seeded reviews/ledger; a qualifying user is eligible", async () => {
    const u = uid();
    await seedQualifying(u);
    const stats = await computeEliteStats(u, YEAR);
    expect(stats.reviews).toBe(12);
    expect(stats.medianReviewWords).toBe(85);
    expect(stats.checkins).toBe(40);
    expect(stats.competitions).toBe(1);
    expect(stats.verifiedPct).toBeCloseTo(8 / 12, 5);
    expect(stats.strikes).toBe(0);
    expect((await evaluateEliteEligibility(u, YEAR)).eligible).toBe(true);
  });

  it("a moderation strike voids eligibility", async () => {
    const u = uid();
    await seedQualifying(u);
    await issueStrike({ uid: u, reason: "fabricated check-ins", issuedBy: "admin" });
    expect((await computeEliteStats(u, YEAR)).strikes).toBe(1);
    expect((await evaluateEliteEligibility(u, YEAR)).eligible).toBe(false);
  });

  it("a revoked check-in does not count toward Elite (honest totals, §G4.5)", async () => {
    const u = uid();
    await seedQualifying(u);
    expect((await computeEliteStats(u, YEAR)).checkins).toBe(40);
    // Claw back 5 check-ins with `#REV` revocation rows (mirrors moderation delete, §G4.3).
    for (let i = 0; i < 5; i++) await seedXp(u, "E1", `E1#court${i}#${YEAR}0601#REV`, iso(i), -10);
    const stats = await computeEliteStats(u, YEAR);
    expect(stats.checkins).toBe(35); // the 5 revoked originals no longer count
    expect((await evaluateEliteEligibility(u, YEAR)).eligible).toBe(false); // now below 40
  });

  it("a prior-year ledger/review does not count toward this year", async () => {
    const u = uid();
    await putItem(buildProfileItem({ uid: u, username: u, displayName: u, visibility: "public" }) as unknown as Record<string, unknown>);
    await ensureGamifyProfile(u);
    await seedXp(u, "E1", "E1#old#20250601", "2025-06-01T12:00:00.000Z");
    const stats = await computeEliteStats(u, YEAR);
    expect(stats.checkins).toBe(0); // last year's check-in is out of window
  });
});

d("Elite nomination & decision (DynamoDB Local)", () => {
  it("self-nomination is idempotent", async () => {
    const u = uid();
    await seedQualifying(u);
    const first = await nominateElite(u, YEAR);
    expect(first.status).toBe("nominated");
    const second = await nominateElite(u, YEAR);
    expect(second.status).toBe("nominated");
    expect((await getEliteRoster(YEAR, "nominated")).filter((r) => r.uid === u).length).toBe(1);
  });

  it("autoFlagElite nominates an eligible user once, and skips an ineligible one", async () => {
    const eligible = uid();
    await seedQualifying(eligible);
    expect(await autoFlagElite(eligible, YEAR)).toBe(true);
    expect(await autoFlagElite(eligible, YEAR)).toBe(false); // already in roster

    const ineligible = uid();
    await putItem(buildProfileItem({ uid: ineligible, username: ineligible, displayName: ineligible, visibility: "public" }) as unknown as Record<string, unknown>);
    await ensureGamifyProfile(ineligible);
    expect(await autoFlagElite(ineligible, YEAR)).toBe(false);
  });

  it("approve writes status + badge + eliteYears + notification; reject just sets status", async () => {
    const u = uid();
    await seedQualifying(u);
    await nominateElite(u, YEAR);

    const decided = await decideElite(YEAR, u, "approved", "admin-1");
    expect(decided?.status).toBe("approved");
    expect(decided?.decidedBy).toBe("admin-1");

    // Year-stamped badge + profile.eliteYears.
    const badgeKey = gamifyKeys.badge(u, `elite-${YEAR}`, "");
    expect((await getItem({ pk: badgeKey.pk, sk: badgeKey.sk }))).toBeTruthy();
    expect((await getGamifyProfile(u))?.eliteYears).toContain(YEAR);

    // elite_status notification landed.
    const { query } = await import("@/lib/db/client");
    const { notifKeys } = await import("@/lib/db/keys");
    const { items } = await query({ pk: notifKeys.notif(u, "", "").pk, skBeginsWith: notifKeys.notifPrefix() });
    expect((items as { type?: string }[]).some((n) => n.type === "elite_status")).toBe(true);

    // Re-decide is a no-op (already decided).
    expect(await decideElite(YEAR, u, "rejected", "admin-2")).toBeNull();
    expect((await getMyEliteStatus(u, YEAR)).status).toBe("approved");
  });

  it("getEliteCohort returns approved public members only", async () => {
    const pub = uid();
    const priv = uid();
    await seedQualifying(pub);
    await putItem(buildProfileItem({ uid: priv, username: priv, displayName: priv, visibility: "private" }) as unknown as Record<string, unknown>);
    await ensureGamifyProfile(priv);
    await nominateElite(pub, YEAR);
    await nominateElite(priv, YEAR);
    await decideElite(YEAR, pub, "approved", "admin");
    await decideElite(YEAR, priv, "approved", "admin");

    const cohort = await getEliteCohort(YEAR);
    expect(cohort.some((m) => m.uid === pub)).toBe(true);
    expect(cohort.some((m) => m.uid === priv)).toBe(false); // private excluded
    expect(await getItem(userKeys.profile(pub))).toBeTruthy();
  });
});
