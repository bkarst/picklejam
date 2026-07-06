/**
 * gamify-stats.test.ts — the "vs. your past self" month-stats aggregation (§G12.6 item 3)
 * against DynamoDB Local. Verifies month bucketing (by the user's tz — UTC here), distinct
 * check-in days / courts from E1 sourceKeys, match counts (E14) with revocations excluded,
 * and net RP (revocations subtract). Skipped locally when DYNAMODB_ENDPOINT is unset.
 */
import { describe, it, expect } from "vitest";
import { getMyMonthStats, ensureGamifyProfile } from "@/lib/data/gamify";
import { putItem } from "@/lib/db/client";
import { gamifyKeys } from "@/lib/db/keys";
import { userLocalMonth } from "@/lib/gamify/time";

const d = process.env.DYNAMODB_ENDPOINT ? describe : describe.skip;

let seq = 0;
const uid = (): string => `stats-test-${Date.now()}-${seq++}`;

const NOW = Date.now();
const THIS = userLocalMonth("UTC", NOW); // profile has no tz ⇒ UTC bucketing
const LAST = `${Number(THIS.slice(0, 4)) - (THIS.slice(4) === "01" ? 1 : 0)}${
  THIS.slice(4) === "01" ? "12" : String(Number(THIS.slice(4)) - 1).padStart(2, "0")
}`;
const thisIso = new Date(NOW).toISOString();
const lastIso = `${LAST.slice(0, 4)}-${LAST.slice(4)}-15T12:00:00.000Z`;

async function seedXp(u: string, rule: string, sourceKey: string, ts: string, points: number) {
  const k = gamifyKeys.ledger(u, sourceKey, ts);
  await putItem({ ...k, entity: "XP", uid: u, rule, points, sourceKey, label: rule, ts, createdAt: ts } as unknown as Record<string, unknown>);
}

d("getMyMonthStats (DynamoDB Local)", () => {
  it("buckets by month and aggregates the four metrics, excluding revoked matches", async () => {
    const u = uid();
    await ensureGamifyProfile(u);

    // This month: 3 check-ins across 2 days + 2 courts; 1 match confirmed then revoked-away.
    await seedXp(u, "E1", "E1#courtA#20990101", thisIso, 10);
    await seedXp(u, "E1", "E1#courtA#20990102", thisIso, 10);
    await seedXp(u, "E1", "E1#courtB#20990101", thisIso, 10);
    await seedXp(u, "E14", "E14#lid#m1", thisIso, 25);
    await seedXp(u, "E14", "E14#lid#m2", thisIso, 25);
    await seedXp(u, "E14", "E14#lid#m2#REV", thisIso, -25); // m2 revoked

    // Last month: a single check-in.
    await seedXp(u, "E1", "E1#courtC#20990201", lastIso, 10);

    const stats = await getMyMonthStats(u, NOW);
    expect(stats.labels).toEqual({ this: THIS, last: LAST });

    // This month
    expect(stats.thisMonth.checkinDays).toBe(2); // days 0101, 0102
    expect(stats.thisMonth.courtsVisited).toBe(2); // courtA, courtB
    expect(stats.thisMonth.matches).toBe(1); // m1 counts, m2 revoked ⇒ excluded from the count
    expect(stats.thisMonth.rp).toBe(55); // net: E1 30 + m1 25 + (m2 25 − 25 = 0)

    // Last month
    expect(stats.lastMonth).toEqual({ rp: 10, checkinDays: 1, matches: 0, courtsVisited: 1 });
  });

  it("returns zeros for a user with no ledger", async () => {
    const u = uid();
    await ensureGamifyProfile(u);
    const stats = await getMyMonthStats(u, NOW);
    expect(stats.thisMonth).toEqual({ rp: 0, checkinDays: 0, matches: 0, courtsVisited: 0 });
    expect(stats.lastMonth).toEqual({ rp: 0, checkinDays: 0, matches: 0, courtsVisited: 0 });
  });
});
