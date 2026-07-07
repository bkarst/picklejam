/**
 * gamify-celebrate.test.ts — elaborateCelebration(): picks the ONE elaborate reward
 * moment (first-time / milestone) from an award block, or null for a routine earn.
 * Priority: level > badge > first-time > quest.
 */
import { describe, it, expect } from "vitest";
import { elaborateCelebration } from "@/lib/gamify/celebrate";
import type { GamifyBlock } from "@/lib/gamify/block";

const block = (over: Partial<GamifyBlock> = {}): GamifyBlock => ({
  awards: [{ rule: "E1", points: 10, label: "Check-in" }],
  total: 10,
  ...over,
});

describe("elaborateCelebration", () => {
  it("returns null for a routine earn (no first-time / milestone)", () => {
    expect(elaborateCelebration(block())).toBeNull();
  });

  it("flags a first check-in (E25) and first review (E5)", () => {
    const checkin = elaborateCelebration(
      block({ awards: [{ rule: "E1", points: 10, label: "Check-in" }, { rule: "E25", points: 25, label: "Starter" }], total: 35 }),
    );
    expect(checkin).toMatchObject({ kind: "first", title: "First check-in!", rp: 35 });

    const review = elaborateCelebration(block({ awards: [{ rule: "E5", points: 50, label: "Review" }], total: 50 }));
    expect(review).toMatchObject({ kind: "first", title: "First review!" });
  });

  it("flags a badge unlock and a quest completion", () => {
    expect(
      elaborateCelebration(block({ badges: [{ familyId: "scout", tier: 2, name: "Scout" }] })),
    ).toMatchObject({ kind: "badge", title: "Scout", subtitle: "Tier 2 unlocked" });

    expect(
      elaborateCelebration(
        block({ quests: [{ questId: "q1", title: "Weekly warrior", count: 3, target: 3, rewardRp: 40, completed: true }] }),
      ),
    ).toMatchObject({ kind: "quest", rp: 40 });
  });

  it("does not celebrate an in-progress (incomplete) quest", () => {
    expect(
      elaborateCelebration(
        block({ quests: [{ questId: "q1", title: "Weekly warrior", count: 1, target: 3, rewardRp: 40, completed: false }] }),
      ),
    ).toBeNull();
  });

  it("prioritizes level-up over every other milestone in the same block", () => {
    const c = elaborateCelebration(
      block({
        levelUp: { level: 3, name: "Rallyer" },
        badges: [{ familyId: "scout", tier: 2, name: "Scout" }],
        awards: [{ rule: "E5", points: 50, label: "Review" }],
        total: 50,
      }),
    );
    expect(c).toMatchObject({ kind: "level", level: 3 });
  });
});
