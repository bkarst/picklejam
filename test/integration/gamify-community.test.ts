/**
 * gamify-community.test.ts — monthly city community quests (§G9.3) against DynamoDB Local.
 * Covers progress ADD + per-user contribution tracking, the ≥3-action contributor markers,
 * the close sweep paying E27 idempotently to ≥3-action contributors only, and the check-in
 * wiring. Skipped locally when DYNAMODB_ENDPOINT is unset (CI provisions it).
 */
import { describe, it, expect } from "vitest";
import {
  createCommunityQuest,
  getCityCommunityQuest,
  getMyCommunityContribution,
  tickCommunityQuest,
  closeCommunityQuest,
} from "@/lib/data/gamify-community";
import { earnCheckin } from "@/lib/data/gamify-earn";
import { getGamifyProfile, getMyLedger } from "@/lib/data/gamify";
import { communityQuestId } from "@/lib/gamify/quests";
import { userLocalMonth } from "@/lib/gamify/time";

const d = process.env.DYNAMODB_ENDPOINT ? describe : describe.skip;

let seq = 0;
const uid = (): string => `cq-test-${Date.now()}-${seq++}`;
const cityKey = (tag: string): string => `us#test#cqcity-${Date.now()}-${seq++}-${tag}`;
const MONTH = userLocalMonth("America/Chicago", Date.now());

async function seedQuest(city: string, goal = 100) {
  return createCommunityQuest({
    cityKey: city,
    month: MONTH,
    title: `${goal} check-ins`,
    goal,
    counts: ["E1"],
    startTs: "2000-01-01T00:00:00.000Z",
    endTs: "2999-01-01T00:00:00.000Z",
  });
}

d("community quest progress & contribution (DynamoDB Local)", () => {
  it("ticks advance collective progress and per-user contribution; ≥3 marks a contributor", async () => {
    const city = cityKey("prog");
    const quest = await seedQuest(city);
    const u = uid();
    const qid = communityQuestId(city, MONTH);
    expect(quest.questId).toBe(qid);

    for (let i = 0; i < 3; i++) await tickCommunityQuest(city, u, { rule: "E1" });
    const live = await getCityCommunityQuest(city);
    expect(live?.progress).toBe(3);
    expect(await getMyCommunityContribution(u, qid)).toBe(3);
  });

  it("a rule not in the quest's counts does not tick", async () => {
    const city = cityKey("norule");
    await seedQuest(city);
    const u = uid();
    await tickCommunityQuest(city, u, { rule: "E5" }); // reviews don't count this quest
    expect((await getCityCommunityQuest(city))?.progress ?? 0).toBe(0);
  });

  it("getCityCommunityQuest is null when there is no quest", async () => {
    expect(await getCityCommunityQuest(cityKey("none"))).toBeNull();
  });
});

d("community quest close & E27 (DynamoDB Local)", () => {
  it("pays E27 (50) to ≥3-action contributors only, and is idempotent", async () => {
    const city = cityKey("close");
    await seedQuest(city, 6);
    const big = uid(); // 3 contributions ⇒ eligible
    const small = uid(); // 1 contribution ⇒ not eligible
    for (let i = 0; i < 3; i++) await tickCommunityQuest(city, big, { rule: "E1" });
    await tickCommunityQuest(city, small, { rule: "E1" });

    const qid = communityQuestId(city, MONTH);
    const res = await closeCommunityQuest(qid);
    expect(res.contributors).toBe(1); // only `big` crossed ≥3
    expect(res.paid).toBe(1);

    expect((await getGamifyProfile(big))?.rp).toBe(50); // E27
    const bigRules = (await getMyLedger(big)).items.map((i) => i.rule);
    expect(bigRules).toContain("E27");
    expect(await getGamifyProfile(small)).toBeUndefined(); // never earned ⇒ no profile

    // Idempotent: re-close is a no-op (already closed).
    const again = await closeCommunityQuest(qid);
    expect(again).toEqual({ contributors: 0, paid: 0 });
    expect((await getGamifyProfile(big))?.rp).toBe(50); // unchanged
  });

  it("pays before flipping status, so a straggler is recoverable and already-paid isn't doubled", async () => {
    const city = cityKey("recover");
    await seedQuest(city, 6);
    const a = uid();
    for (let i = 0; i < 3; i++) await tickCommunityQuest(city, a, { rule: "E1" });
    const qid = communityQuestId(city, MONTH);
    expect((await closeCommunityQuest(qid)).paid).toBe(1);

    // Simulate a crash where the payout ran but the terminal flip didn't persist: reopen, then a
    // NEW contributor crosses the threshold. A re-close must pay the straggler without re-paying `a`.
    const { updateItem } = await import("@/lib/db/client");
    const { questKeys } = await import("@/lib/db/keys");
    await updateItem({ key: questKeys.meta(qid), update: "SET #s = :a", names: { "#s": "status" }, values: { ":a": "active" } });
    const b = uid();
    for (let i = 0; i < 3; i++) await tickCommunityQuest(city, b, { rule: "E1" });

    const second = await closeCommunityQuest(qid);
    expect(second.contributors).toBe(2);
    expect((await getGamifyProfile(a))?.rp).toBe(50); // idempotent — NOT doubled to 100
    expect((await getGamifyProfile(b))?.rp).toBe(50); // straggler paid
  });
});

d("community quest check-in wiring (DynamoDB Local)", () => {
  it("earnCheckin advances the city's community quest", async () => {
    const city = cityKey("wire");
    await seedQuest(city);
    const u = uid();
    await earnCheckin({ uid: u, courtId: `court-${Date.now()}`, courtCityKey: city, day: MONTH + "05" });
    expect((await getCityCommunityQuest(city))?.progress).toBe(1);
  });
});
