/**
 * gamify-community.ts — monthly city-scoped community quests (Gamification PRD §G9.3).
 *
 * A community quest is a single collective goal ("500 check-ins in Wichita this month").
 * It is keyed deterministically per city + calendar month (`communityQuestId`), so a city's
 * live quest is one GetItem — no GSI. Qualifying actions atomically ADD the collective
 * `progress` and bump a per-user contribution count; crossing ≥3 contributions writes a
 * durable `CONTRIB#<uid>` marker in the quest partition. `closeCommunityQuest` reads those
 * markers (one Query) and pays **E27** (+ the seasonal badge) to every ≥3-action contributor,
 * idempotently. Everything here is failure-isolated — a tick never fails the underlying earn.
 */

import "server-only";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { getItem, putItem, putNew, queryAll, updateItem, asRecord } from "@/lib/db/client";
import { questKeys } from "@/lib/db/keys";
import { communityQuestId } from "@/lib/gamify/quests";
import { awardXpSafe } from "./gamify";
import { awardSpecialBadge } from "./gamify-badges";
import { cityBoardMonth } from "./gamify-boards";
import type { QuestItem, QuestProgItem } from "@/lib/db/types";
import type { QuestEvent } from "@/lib/gamify/quests";

const CONTRIB_THRESHOLD = 3; // ≥3 qualifying actions ⇒ E27 at close (§G9.3)

/** Create/activate a city's community quest for a month (ops/admin action). */
export async function createCommunityQuest(input: {
  cityKey: string;
  month: string;
  title: string;
  goal: number;
  /** Which earn rules count toward the goal (e.g. `["E1"]` for check-ins). */
  counts: string[];
  rewardRp?: number;
  badgeId?: string;
  startTs: string;
  endTs: string;
  now?: number;
}): Promise<QuestItem> {
  const questId = communityQuestId(input.cityKey, input.month);
  const iso = new Date(input.now ?? Date.now()).toISOString();
  const item: QuestItem = {
    ...questKeys.meta(questId),
    entity: "QUEST",
    questId,
    kind: "community",
    scope: input.cityKey,
    title: input.title,
    rule: { counts: input.counts, target: input.goal },
    rewardRp: input.rewardRp ?? 50,
    startTs: input.startTs,
    endTs: input.endTs,
    ...(input.badgeId ? { badgeId: input.badgeId } : {}),
    goal: input.goal,
    progress: 0,
    status: "active",
    createdAt: iso,
    updatedAt: iso,
  };
  await putItem(asRecord(item));
  return item;
}

/** The city's live community quest (active + within window), or null. One GetItem (§G9.3). */
export async function getCityCommunityQuest(cityKey: string, now: number = Date.now()): Promise<QuestItem | null> {
  const q = await getItem<QuestItem>(questKeys.meta(communityQuestId(cityKey, cityBoardMonth(now))));
  if (!q || q.status !== "active") return null;
  const iso = new Date(now).toISOString();
  if (q.startTs && iso < q.startTs) return null;
  if (q.endTs && iso > q.endTs) return null;
  return q;
}

/** The viewer's contribution count toward a community quest ("Your contributions: N"). */
export async function getMyCommunityContribution(uid: string, questId: string): Promise<number> {
  const row = await getItem<QuestProgItem>(questKeys.progress(uid, questId));
  return row?.count ?? 0;
}

/**
 * Advance a city's community quest for a qualifying action (§G9.3). Atomically bumps the
 * collective `progress` and the user's contribution count; crossing ≥3 writes a durable
 * contributor marker. No-op when there's no live quest or the rule doesn't count. Isolated.
 */
export async function tickCommunityQuest(cityKey: string, uid: string, event: QuestEvent, now: number = Date.now()): Promise<void> {
  try {
    if (!event.rule) return;
    const quest = await getCityCommunityQuest(cityKey, now);
    if (!quest || !quest.rule.counts.includes(event.rule)) return;
    const questId = quest.questId;
    const iso = new Date(now).toISOString();

    // Collective progress — atomic ADD, only while active.
    try {
      await updateItem({
        key: questKeys.meta(questId),
        update: "ADD progress :one SET updatedAt = :now",
        condition: "#s = :active",
        names: { "#s": "status" },
        values: { ":one": 1, ":now": iso, ":active": "active" },
      });
    } catch (e) {
      if (!(e instanceof ConditionalCheckFailedException)) throw e; // closed mid-tick — fine
    }

    // Per-user contribution count.
    const attrs = await updateItem({
      key: questKeys.progress(uid, questId),
      update:
        "ADD #c :one SET entity = if_not_exists(entity, :e), uid = if_not_exists(uid, :uid), questId = if_not_exists(questId, :qid), target = if_not_exists(target, :t), createdAt = if_not_exists(createdAt, :now), updatedAt = :now",
      names: { "#c": "count" },
      values: { ":one": 1, ":e": "QUESTPROG", ":uid": uid, ":qid": questId, ":t": CONTRIB_THRESHOLD, ":now": iso },
    });
    const count = (attrs?.count as number) ?? 0;

    // At/after the threshold, write the contributor marker (create-only ⇒ idempotent).
    if (count >= CONTRIB_THRESHOLD) {
      try {
        await putNew(asRecord({ ...questKeys.contributor(questId, uid), entity: "QUESTCONTRIB", uid, questId, createdAt: iso, updatedAt: iso }));
      } catch (e) {
        if (!(e instanceof ConditionalCheckFailedException)) throw e;
      }
    }
  } catch (err) {
    console.error("[gamify] community quest tick failed (isolated):", err);
  }
}

/**
 * Close a community quest (the month-close / goal-met sweep): pay E27 + the seasonal badge to
 * every ≥3-action contributor, THEN flip status → closed. Paying before the flip is deliberate:
 * E27 (sourceKey `E27#<questId>`) and the badge write are both idempotent, so a crash mid-payout
 * is fully recoverable — a re-run re-pays the stragglers (no double RP) and then flips. Closing
 * first would strand anyone not yet paid, because a re-run would early-return on `closed`.
 */
export async function closeCommunityQuest(questId: string, now: number = Date.now()): Promise<{ contributors: number; paid: number }> {
  const iso = new Date(now).toISOString();
  const quest = await getItem<QuestItem>(questKeys.meta(questId));
  if (!quest || quest.status !== "active") return { contributors: 0, paid: 0 }; // nothing to close

  const contribs = await queryAll<{ uid: string }>({ pk: questKeys.contributor(questId, "").pk, skBeginsWith: questKeys.contributorPrefix() });
  let paid = 0;
  for (const c of contribs) {
    const res = await awardXpSafe({
      uid: c.uid,
      earns: [{ rule: "E27", source: { rule: "E27", questId }, label: `Community quest: ${quest.title ?? "goal met"}`, refType: "quest", refId: questId }],
      now,
    });
    if (res?.awarded) paid++;
    if (quest.badgeId) await awardSpecialBadge(c.uid, quest.badgeId, now);
  }

  // Terminal flip, last — conditional so concurrent closes settle to one winner (both pay
  // idempotently first). A benign CCFE here means another close already flipped it.
  try {
    await updateItem({
      key: questKeys.meta(questId),
      update: "SET #s = :closed, updatedAt = :now",
      condition: "#s = :active",
      names: { "#s": "status" },
      values: { ":closed": "closed", ":active": "active", ":now": iso },
    });
  } catch (e) {
    if (!(e instanceof ConditionalCheckFailedException)) throw e;
  }
  return { contributors: contribs.length, paid };
}
