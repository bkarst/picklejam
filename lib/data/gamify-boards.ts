/**
 * gamify-boards.ts — monthly leaderboards, materialized like RR standings (§G13.6).
 *
 * A tally is an atomic ADD per qualifying earn (court board = check-in days; city board =
 * RP). RANK rows are rebuilt FLOOR-GATED: each partition's META caches {floor, rankCount,
 * version}; a tally write triggers a rebuild only when `newValue ≥ floor` or the board
 * isn't yet full — cost tracks utility (cheap early when partitions are tiny, rare late
 * when they're large). A rebuild is a pure function of the tallies (version-conditioned;
 * one retry on a concurrent bump). Only public, `leaderboards≠hidden` profiles project
 * into RANK; tallies exist for everyone (a private user reads their own TALLY for self-rank).
 * Failure-isolated — a board write never fails the underlying earn.
 */

import "server-only";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { batchGet, getItem, query, queryAll, transactWrite, txPut, txDelete, txUpdate, updateItem } from "@/lib/db/client";
import { boardKeys, userKeys, gamifyKeys } from "@/lib/db/keys";
import { getHeadlineRatings } from "./users";
import { userLocalMonth } from "@/lib/gamify/time";
import type {
  LbTallyItem,
  LbRankItem,
  LbBoardMetaItem,
  UserProfileItem,
  GamifyProfileItem,
} from "@/lib/db/types";

export const COURT_TOP_N = 10;
export const CITY_TOP_N = 25;
type Scope = "court" | "city";

/**
 * The month bucket for CITY-scoped surfaces (the city RP board + community quests), as
 * `yyyymm`. Cities span time zones, so we bucket on a single fixed reference (`America/Chicago`,
 * the US centroid) — a day's drift at a month edge is immaterial for a monthly status board.
 * The one thing that matters is that the WRITE side (a check-in's city tally) and every READ
 * side (the leaderboard page, the directory teaser, community quests) use THIS same basis, so
 * a check-in always lands in the month the pages read back. (Court boards, by contrast, bucket
 * on the court's own local month — see `earnCheckin`.)
 */
export function cityBoardMonth(now: number = Date.now()): string {
  return userLocalMonth("America/Chicago", now);
}

/** Previous `yyyymm`. */
export function prevMonth(yyyymm: string): string {
  const y = Number(yyyymm.slice(0, 4));
  const m = Number(yyyymm.slice(4, 6));
  const d = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  return `${d.y}${String(d.m).padStart(2, "0")}`;
}

/** Add `delta` to a user's board tally; returns the new value (ReturnValues ALL_NEW). */
async function addTally(
  boardPk: string,
  scope: Scope,
  scopeId: string,
  month: string,
  uid: string,
  delta: number,
): Promise<number> {
  const iso = new Date().toISOString();
  const attrs = await updateItem({
    key: boardKeys.tally(boardPk, uid),
    update:
      "ADD #v :d SET entity = if_not_exists(entity, :e), #scope = if_not_exists(#scope, :sc), scopeId = if_not_exists(scopeId, :sid), #month = if_not_exists(#month, :m), uid = if_not_exists(uid, :uid), updatedAt = :now",
    names: { "#v": "value", "#scope": "scope", "#month": "month" },
    values: { ":d": delta, ":e": "LBTALLY", ":sc": scope, ":sid": scopeId, ":m": month, ":uid": uid, ":now": iso },
  });
  return ((attrs?.value as number) ?? delta);
}

interface Rankable {
  uid: string;
  value: number;
  displayName: string;
  username: string;
  avatarUrl?: string;
  level: number;
}

/** Rebuild the top-N RANK rows for a partition (version-conditioned; one retry). */
async function rebuild(boardPk: string, scope: Scope, scopeId: string, month: string, topN: number, attempt = 0): Promise<void> {
  const meta = await getItem<LbBoardMetaItem>(boardKeys.meta(boardPk));
  if (meta?.frozen) return; // admin freeze — stop rebuilding (§G16)

  const tallies = await queryAll<LbTallyItem>({ pk: boardPk, skBeginsWith: boardKeys.tallyPrefix() });
  if (tallies.length === 0) return;
  tallies.sort((a, b) => b.value - a.value || a.uid.localeCompare(b.uid));

  // Hydrate the candidates and filter to public, leaderboards≠hidden profiles.
  const uids = tallies.map((t) => t.uid);
  const [users, gamifies] = await Promise.all([
    batchGet<UserProfileItem>(uids.map((u) => userKeys.profile(u))),
    batchGet<GamifyProfileItem>(uids.map((u) => gamifyKeys.profile(u))),
  ]);
  const userBy = new Map(users.map((u) => [u.uid, u]));
  const gamifyBy = new Map(gamifies.map((g) => [g.uid, g]));

  const eligible: Rankable[] = [];
  for (const t of tallies) {
    const u = userBy.get(t.uid);
    const g = gamifyBy.get(t.uid);
    if (!u || u.visibility !== "public") continue;
    if (g?.prefs?.leaderboards === "hidden") continue;
    eligible.push({ uid: t.uid, value: t.value, displayName: u.displayName, username: u.username, avatarUrl: u.avatarUrl, level: g?.level ?? 1 });
    if (eligible.length >= topN) break;
  }

  // Prior-month movement (one extra Query) — swap the trailing `#<month>` for the prior month.
  const priorBoardPk = boardPk.replace(new RegExp(`#${month}$`), `#${prevMonth(month)}`);
  const priorRanks = await query<LbRankItem>({
    pk: priorBoardPk,
    skBeginsWith: boardKeys.rankPrefix(),
  }).then((r) => new Map(r.items.map((row) => [row.uid, row.rank])));

  const items = [] as ReturnType<typeof txPut>[];
  eligible.forEach((e, i) => {
    const rank = i + 1;
    const prior = priorRanks.get(e.uid);
    const row: LbRankItem = {
      ...boardKeys.rank(boardPk, rank),
      entity: "LBRANK",
      scope,
      scopeId,
      month,
      rank,
      uid: e.uid,
      value: e.value,
      ...(prior !== undefined ? { movement: prior - rank } : {}),
      displayName: e.displayName,
      username: e.username,
      ...(e.avatarUrl ? { avatarUrl: e.avatarUrl } : {}),
      level: e.level,
    };
    items.push(txPut(row as unknown as Record<string, unknown>));
  });

  // Delete stale RANK rows beyond the new count.
  const oldCount = meta?.rankCount ?? 0;
  for (let r = eligible.length + 1; r <= oldCount; r++) items.push(txDelete(boardKeys.rank(boardPk, r)));

  // Version CAS. A META can exist WITHOUT a `version` (e.g. `freezeBoard` created a partial row
  // before any rebuild ran); guarding on the presence of `version` — not of the item — keeps the
  // check-and-set correct in that case (a `version = :expected` with `:expected` undefined would
  // be dropped by `removeUndefinedValues` and throw). `attribute_not_exists(version)` is still
  // race-safe: a concurrent first rebuild that sets it makes the other retry into the CAS branch.
  const hasVersion = typeof meta?.version === "number";
  const version = (meta?.version ?? 0) + 1;
  const metaItem: LbBoardMetaItem = {
    ...boardKeys.meta(boardPk),
    entity: "LBMETA",
    scopeId,
    month,
    floor: eligible.length ? eligible[eligible.length - 1].value : 0,
    rankCount: eligible.length,
    version,
    ...(meta?.frozen ? { frozen: true } : {}),
  };
  items.push(
    txUpdate({
      key: boardKeys.meta(boardPk),
      update: "SET entity = :e, scopeId = :sid, #month = :m, floor = :f, rankCount = :rc, version = :v",
      names: { "#month": "month" },
      condition: hasVersion ? "version = :expected" : "attribute_not_exists(version)",
      values: {
        ":e": "LBMETA",
        ":sid": scopeId,
        ":m": month,
        ":f": metaItem.floor,
        ":rc": metaItem.rankCount,
        ":v": version,
        ...(hasVersion ? { ":expected": meta!.version } : {}),
      },
    }),
  );

  try {
    await transactWrite(items);
  } catch (err) {
    const conflict = err instanceof ConditionalCheckFailedException || (err as { name?: string })?.name === "TransactionCanceledException";
    if (conflict && attempt < 1) return rebuild(boardPk, scope, scopeId, month, topN, attempt + 1);
    if (!conflict) throw err;
  }
}

/** A tally write + floor-gated rebuild. */
async function tallyAndRebuild(boardPk: string, scope: Scope, scopeId: string, month: string, uid: string, delta: number, topN: number): Promise<void> {
  const newValue = await addTally(boardPk, scope, scopeId, month, uid, delta);
  const meta = await getItem<LbBoardMetaItem>(boardKeys.meta(boardPk));
  if (meta?.frozen) return;
  const floor = meta?.floor ?? Number.NEGATIVE_INFINITY;
  const rankCount = meta?.rankCount ?? 0;
  if (newValue >= floor || rankCount < topN) {
    await rebuild(boardPk, scope, scopeId, month, topN);
  }
}

/** Court board — add a check-in DAY for a court's local month, then floor-gated rebuild (§G13.6). */
export async function tallyCourtCheckin(courtId: string, cityMonth: string, uid: string): Promise<void> {
  try {
    await tallyAndRebuild(boardKeys.courtBoardPk(courtId, cityMonth), "court", courtId, cityMonth, uid, 1, COURT_TOP_N);
  } catch (err) {
    console.error("[gamify] court board tally failed (isolated):", err);
  }
}

/** City board — add RP for a city's month, then floor-gated rebuild (§G13.6). */
export async function tallyCityRp(cityKey: string, month: string, uid: string, rp: number): Promise<void> {
  if (rp <= 0) return;
  try {
    await tallyAndRebuild(boardKeys.cityBoardPk(cityKey, month), "city", cityKey, month, uid, rp, CITY_TOP_N);
  } catch (err) {
    console.error("[gamify] city board tally failed (isolated):", err);
  }
}

// ── Reads (patterns 32/33) ──────────────────────────────────────────────────

export interface AnonBoardRow {
  rank: number;
  uid: string;
  /** Headline rating — the only per-player fact a check-in board shows (§6.2). */
  rating?: number;
  value: number;
  movement?: number;
}

/**
 * The court board — check-in days. Check-ins are anonymous (§6.2): the denormalized
 * identity on the RANK rows is deliberately NOT surfaced; each row carries only rank,
 * value, movement, and the player's headline rating. (`uid` stays for the viewer's
 * own-row highlight — it is never rendered.)
 */
export async function getCourtBoard(courtId: string, yyyymm: string): Promise<AnonBoardRow[]> {
  const { items } = await query<LbRankItem>({
    pk: boardKeys.courtBoardPk(courtId, yyyymm),
    skBeginsWith: boardKeys.rankPrefix(),
  });
  const ratings = await getHeadlineRatings(items.map((r) => r.uid));
  return items.map((r) => ({
    rank: r.rank,
    uid: r.uid,
    value: r.value,
    ...(ratings.has(r.uid) ? { rating: ratings.get(r.uid) } : {}),
    ...(r.movement !== undefined ? { movement: r.movement } : {}),
  }));
}

export async function getCityBoard(cityKey: string, yyyymm: string): Promise<LbRankItem[]> {
  const { items } = await query<LbRankItem>({
    pk: boardKeys.cityBoardPk(cityKey, yyyymm),
    skBeginsWith: boardKeys.rankPrefix(),
  });
  return items;
}

/** A user's own tally on a board (self-rank for private / below-cut users). */
export async function getMyCourtTally(courtId: string, yyyymm: string, uid: string): Promise<number> {
  const row = await getItem<LbTallyItem>(boardKeys.tally(boardKeys.courtBoardPk(courtId, yyyymm), uid));
  return row?.value ?? 0;
}

// ── Group board (§G12.13) ────────────────────────────────────────────────────

export interface GroupBoardMember {
  uid: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
}
export interface GroupBoardRow extends GroupBoardMember {
  rank: number;
  level: number;
  value: number; // this-month RP
}

/**
 * Rank a group's members by this-month RP (§G12.13) — a BatchGet of `GAMIFY#META` (bounded by
 * member count, no fan-out writes, pattern 26). `monthEarn.rp` counts only when its stamped
 * month is the current one (a stale prior-month value reads as 0). Members with
 * `leaderboards=hidden` are omitted (returned as `hiddenCount`) — except the viewer, who
 * always sees their own row.
 */
export async function getGroupBoard(
  members: GroupBoardMember[],
  viewerUid: string | undefined,
  now: number = Date.now(),
): Promise<{ rows: GroupBoardRow[]; hiddenCount: number }> {
  if (members.length === 0) return { rows: [], hiddenCount: 0 };
  const month = userLocalMonth("America/Chicago", now);
  const gamifies = await batchGet<GamifyProfileItem>(members.map((m) => gamifyKeys.profile(m.uid)));
  const gBy = new Map(gamifies.map((g) => [g.uid, g]));

  let hiddenCount = 0;
  const ranked: Omit<GroupBoardRow, "rank">[] = [];
  for (const m of members) {
    const g = gBy.get(m.uid);
    if (g?.prefs?.leaderboards === "hidden" && m.uid !== viewerUid) {
      hiddenCount++;
      continue;
    }
    const value = g?.monthEarn?.month === month ? g.monthEarn.rp ?? 0 : 0;
    ranked.push({ ...m, level: g?.level ?? 1, value });
  }
  ranked.sort((a, b) => b.value - a.value || a.displayName.localeCompare(b.displayName));
  return { rows: ranked.map((r, i) => ({ ...r, rank: i + 1 })), hiddenCount };
}
