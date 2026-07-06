/**
 * gamify-quests.ts — weekly personal quests (Gamification PRD §G9/§G13.5).
 *
 * `ensureWeeklyQuests` lazily instantiates the 3 week-stamped QUESTPROG rows on the first
 * authed read of a week (create-only puts — a concurrent race instantiates exactly once).
 * `tickQuests` bumps matching rows under a `count < target` condition (distinct dimension
 * for `twocourts`), and the completing write routes E26 + `quest_completed` exactly once.
 * Selection is the pure, deterministic `selectWeeklyQuests`. Failure-isolated.
 */

import "server-only";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { putNew, query, updateItem, asRecord } from "@/lib/db/client";
import { questKeys } from "@/lib/db/keys";
import { resolveUserTz, isoWeekOf } from "@/lib/gamify/time";
import {
  QUEST_BY_SLUG,
  QUEST_ID_PREFIX,
  selectWeeklyQuests,
  weeklyQuestId,
  parseWeeklyQuestId,
  questPredicateMatches,
  type QuestEvent,
} from "@/lib/gamify/quests";
import { getGamifyProfile, awardXpSafe } from "./gamify";
import { trackServerEvent } from "@/lib/analytics/server";
import type { ActiveQuest } from "@/lib/gamify/view";
import type { QuestProgItem, GamifyProfileItem } from "@/lib/db/types";


/** Approximate selection ctx from the profile counters (dominant / least-used family + guards). */
function selectionContext(profile: GamifyProfileItem) {
  const c = profile.counters;
  return {
    familyUsage: {
      B1: c.checkins + c.courtsVisited,
      B2: c.reviews + c.photos + c.helpfulVotes,
      B3: c.tourneyMatches + c.seasonsCompleted + c.rungsClimbed,
      B4: c.outingsAttended + c.outingsHosted + c.rrCompleted,
    },
    eligibility: {
      unreviewedCourt: c.courtsVisited > c.reviews,
      activeRegistration: c.tourneyMatches + c.seasonsCompleted + c.rungsClimbed > 0,
      priorHosting: c.outingsHosted > 0,
    },
  };
}

const weekPrefix = (isoWeek: string): string =>
  `${questKeys.progressPrefix()}${QUEST_ID_PREFIX}#${isoWeek}#`;

function toActive(row: QuestProgItem): ActiveQuest | null {
  const parsed = parseWeeklyQuestId(row.questId);
  const def = parsed && QUEST_BY_SLUG[parsed.slug];
  if (!parsed || !def) return null;
  return {
    questId: row.questId,
    slug: parsed.slug,
    title: def.title,
    count: row.count,
    target: row.target,
    rewardRp: def.rewardRp,
    completed: !!row.completedAt,
  };
}

/** Read the current week's quest progress (pattern 35 — one Query, id-prefix filter). */
export async function getWeekQuests(uid: string, isoWeek: string): Promise<{ rows: QuestProgItem[]; active: ActiveQuest[] }> {
  const { items } = await query<QuestProgItem>({
    pk: questKeys.progress(uid, "").pk,
    skBeginsWith: weekPrefix(isoWeek),
  });
  return { rows: items, active: items.map(toActive).filter((q): q is ActiveQuest => !!q) };
}

/** Lazily instantiate this week's 3 quests (create-only, race-safe). Returns the active set. */
export async function ensureWeeklyQuests(
  uid: string,
  now: number,
  profile: GamifyProfileItem,
): Promise<ActiveQuest[]> {
  const tz = resolveUserTz(profile.tz, undefined);
  const isoWeek = isoWeekOf(tz, now);
  const { active } = await getWeekQuests(uid, isoWeek);
  if (active.length >= 3) return active;
  if (active.length > 0) return active; // partial (mid-instantiation race) — leave as-is

  const iso = new Date(now).toISOString();
  for (const slug of selectWeeklyQuests(uid, isoWeek, selectionContext(profile))) {
    const def = QUEST_BY_SLUG[slug];
    const questId = weeklyQuestId(isoWeek, slug);
    const item: QuestProgItem = {
      ...questKeys.progress(uid, questId),
      entity: "QUESTPROG",
      uid,
      questId,
      target: def.target,
      count: 0,
      createdAt: iso,
      updatedAt: iso,
    };
    try {
      await putNew(asRecord(item));
    } catch (err) {
      if (!(err instanceof ConditionalCheckFailedException)) throw err; // race — already created
    }
  }
  return (await getWeekQuests(uid, isoWeek)).active;
}

/** A completed-quest update for the piggyback (§G12.0). */
export interface QuestTickUpdate {
  questId: string;
  title: string;
  count: number;
  target: number;
  rewardRp: number;
  completed: boolean;
}

async function completeQuest(uid: string, row: QuestProgItem, now: number): Promise<void> {
  const parsed = parseWeeklyQuestId(row.questId);
  const def = parsed && QUEST_BY_SLUG[parsed.slug];
  if (!def) return;
  try {
    // First completer only — awards E26 exactly once.
    await updateItem({
      key: questKeys.progress(uid, row.questId),
      update: "SET completedAt = :now, updatedAt = :now",
      condition: "attribute_not_exists(completedAt)",
      values: { ":now": new Date(now).toISOString() },
    });
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) return; // already completed
    throw err;
  }
  await awardXpSafe({
    uid,
    earns: [
      {
        rule: "E26",
        source: { rule: "E26", questId: row.questId },
        ctx: { questRewardRp: def.rewardRp },
        label: `Quest: ${def.title}`,
        refType: "quest",
        refId: row.questId,
      },
    ],
    now,
  });
  trackServerEvent(uid, "quest_completed", { questId: row.questId, kind: "weekly" });
}

/**
 * Tick this week's quests against a set of actions (ledger rules + the two non-ledger
 * ticks). Returns the quests that advanced (for the piggyback). Best-effort / isolated.
 */
export async function tickQuests(
  uid: string,
  events: QuestEvent[],
  now: number = Date.now(),
): Promise<QuestTickUpdate[]> {
  try {
    if (events.length === 0) return [];
    const profile = await getGamifyProfile(uid);
    if (!profile) return [];
    const tz = resolveUserTz(profile.tz, undefined);
    const isoWeek = isoWeekOf(tz, now);
    const { rows } = await getWeekQuests(uid, isoWeek);

    const updates = new Map<string, QuestTickUpdate>();
    for (const row of rows) {
      if (row.completedAt) continue;
      const parsed = parseWeeklyQuestId(row.questId);
      const def = parsed && QUEST_BY_SLUG[parsed.slug];
      if (!def) continue;

      for (const event of events) {
        if (!questPredicateMatches(def, event)) continue;

        let updated: QuestProgItem | undefined;
        if (def.distinctBy) {
          const dim = event[def.distinctBy];
          if (!dim || (row.seen ?? []).includes(dim)) continue;
          const seen = [...(row.seen ?? []), dim];
          try {
            const attrs = await updateItem({
              key: questKeys.progress(uid, row.questId),
              update: "SET seen = :seen, #c = :c, updatedAt = :now",
              condition: "#c < :target",
              names: { "#c": "count" },
              values: { ":seen": seen, ":c": seen.length, ":target": def.target, ":now": new Date(now).toISOString() },
            });
            updated = attrs as unknown as QuestProgItem;
            row.seen = seen;
            row.count = seen.length;
          } catch (err) {
            if (!(err instanceof ConditionalCheckFailedException)) throw err;
          }
        } else {
          try {
            const attrs = await updateItem({
              key: questKeys.progress(uid, row.questId),
              update: "ADD #c :one SET updatedAt = :now",
              condition: "#c < :target",
              names: { "#c": "count" },
              values: { ":one": 1, ":target": def.target, ":now": new Date(now).toISOString() },
            });
            updated = attrs as unknown as QuestProgItem;
            row.count = (updated.count as number) ?? row.count + 1;
          } catch (err) {
            if (!(err instanceof ConditionalCheckFailedException)) throw err;
          }
        }

        if (updated) {
          const completed = row.count >= def.target;
          updates.set(row.questId, {
            questId: row.questId,
            title: def.title,
            count: row.count,
            target: def.target,
            rewardRp: def.rewardRp,
            completed,
          });
          if (completed) await completeQuest(uid, row, now);
        }
      }
    }
    return [...updates.values()];
  } catch (err) {
    console.error("[gamify] quest tick failed (isolated):", err);
    return [];
  }
}
