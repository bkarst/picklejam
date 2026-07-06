/**
 * gamify-badges.ts — badge awarding + the collection view (Gamification PRD §G6/§G13.4).
 *
 * `awardBadges` diffs the before/after counter snapshot (via the pure
 * `evaluateBadgeUpgrades`) and writes one `BADGE#<family>` row per family, tier upgraded
 * IN PLACE under a `tier < :new` condition — race-safe and monotonic (a revocation-driven
 * counter decrement never confiscates an earned tier). `getMyBadges` (pattern 31) returns
 * earned badges + per-family locked-with-progress for the collection / trophy case.
 */

import "server-only";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { query, updateItem } from "@/lib/db/client";
import { gamifyKeys } from "@/lib/db/keys";
import {
  BADGE_FAMILIES,
  BADGE_FAMILY_BY_ID,
  TIER_NAMES,
  counterValue,
  tierForFamily,
  evaluateBadgeUpgrades,
  type BadgeSnapshot,
  type BadgeUpgrade,
} from "@/lib/gamify/badges";
import type { BadgeCollectionEntry, MyBadgesView } from "@/lib/gamify/view";
import type { BadgeAwardItem } from "@/lib/db/types";

/**
 * Award any newly-crossed badge tiers moving `before → after`. Writes/upgrades the
 * `BADGE#<family>` rows and returns the upgrades (for the piggyback + notifications).
 * Failure-isolated per family — one bad write can't block the others or the award.
 */
export async function awardBadges(
  uid: string,
  before: BadgeSnapshot,
  after: BadgeSnapshot,
  now: number = Date.now(),
): Promise<BadgeUpgrade[]> {
  const upgrades = evaluateBadgeUpgrades(before, after);
  const ts = new Date(now).toISOString();
  for (const up of upgrades) {
    const key = gamifyKeys.badge(uid, up.familyId, ts);
    try {
      await updateItem({
        key: { pk: key.pk, sk: key.sk },
        update:
          "SET entity = :e, uid = :uid, familyId = :fam, #tier = :t, gsi1pk = :g1, gsi1sk = if_not_exists(gsi1sk, :g1s), awardedAt = if_not_exists(awardedAt, :now), updatedAt = :now, tierHistory = list_append(if_not_exists(tierHistory, :empty), :hist)",
        // Monotonic: only create, or upgrade to a strictly higher tier.
        condition: "attribute_not_exists(sk) OR #tier < :t",
        names: { "#tier": "tier" },
        values: {
          ":e": "BADGE",
          ":uid": uid,
          ":fam": up.familyId,
          ":t": up.tier,
          ":g1": key.gsi1pk,
          ":g1s": key.gsi1sk,
          ":now": ts,
          ":empty": [] as unknown[],
          ":hist": [{ tier: up.tier, at: ts }],
        },
      });
    } catch (err) {
      if (!(err instanceof ConditionalCheckFailedException)) {
        console.error(`[gamify] badge write failed for ${up.familyId} (isolated):`, err);
      }
      // A concurrent write already reached this tier or higher — monotonic no-op.
    }
  }
  return upgrades;
}

/** Award a one-off special badge (tier 0) — Trailblazer, First Reviewer, etc. Idempotent. */
export async function awardSpecialBadge(uid: string, familyId: string, now: number = Date.now()): Promise<void> {
  const ts = new Date(now).toISOString();
  const key = gamifyKeys.badge(uid, familyId, ts);
  try {
    await updateItem({
      key: { pk: key.pk, sk: key.sk },
      update:
        "SET entity = :e, uid = :uid, familyId = :fam, #tier = :t, gsi1pk = :g1, gsi1sk = if_not_exists(gsi1sk, :g1s), awardedAt = if_not_exists(awardedAt, :now), updatedAt = :now, tierHistory = if_not_exists(tierHistory, :empty)",
      condition: "attribute_not_exists(sk)",
      names: { "#tier": "tier" },
      values: { ":e": "BADGE", ":uid": uid, ":fam": familyId, ":t": 0, ":g1": key.gsi1pk, ":g1s": key.gsi1sk, ":now": ts, ":empty": [] as unknown[] },
    });
  } catch (err) {
    if (!(err instanceof ConditionalCheckFailedException)) {
      console.error(`[gamify] special badge ${familyId} write failed (isolated):`, err);
    }
  }
}

/** Access pattern 31 — my badges (one Query), joined with per-family progress from counters. */
export async function getMyBadges(uid: string, snapshot: BadgeSnapshot, showcase: string[] = []): Promise<MyBadgesView> {
  const { items } = await query<BadgeAwardItem>({
    pk: gamifyKeys.profile(uid).pk,
    skBeginsWith: gamifyKeys.badgePrefix(),
  });
  const earnedByFamily = new Map(items.map((b) => [b.familyId, b]));

  const entries: BadgeCollectionEntry[] = BADGE_FAMILIES.map((family) => {
    const earned = earnedByFamily.get(family.id);
    const tier = earned?.tier ?? tierForFamily(family, snapshot);
    const count = counterValue(family, snapshot);
    const nextThreshold = family.tiers[tier]; // threshold for the NEXT tier (undefined at max)
    return {
      familyId: family.id,
      name: family.name,
      behavior: family.behavior,
      flavor: family.flavor,
      tier,
      tierName: TIER_NAMES[tier] ?? "",
      ...(earned?.awardedAt ? { awardedAt: earned.awardedAt } : {}),
      ...(nextThreshold !== undefined ? { progress: { count, nextThreshold } } : {}),
    };
  });

  return {
    entries,
    showcase: showcase.filter((id) => BADGE_FAMILY_BY_ID[id]),
    earnedCount: entries.filter((e) => e.tier > 0).length,
  };
}
