/**
 * gamify-moderation.ts — the admin/moderation data layer behind the Gamify admin tab
 * (Gamification PRD §G16.6 a–c). The admin *UI* lives on the (deferred, post-launch)
 * court-admin surface; these are the audited operations it will call:
 *   • **(a) User lookup + revoke** — `getGamifyProfile` + `getMyLedger` + `revokeXp` (in
 *     `gamify.ts`) append a `#REV` counter-entry; an optional strike issues in the same step.
 *   • **(b) Strikes** — issue / expire / list `STRIKE#` rows (access pattern 38), reason +
 *     evidence link + `issuedBy`.
 *   • **(c) Boards** — freeze / unfreeze a board partition (META `frozen`); a frozen board
 *     stops rebuilding and renders a notice, with a `frozenBy`/`frozenAt` audit trail.
 * Every write records who did it. No client ever calls these directly (admin-gated route).
 */

import "server-only";
import { getItem, query, updateItem } from "@/lib/db/client";
import { gamifyKeys, boardKeys } from "@/lib/db/keys";
import type { StrikeItem, LbBoardMetaItem } from "@/lib/db/types";

// ── (b) Moderation strikes (pattern 38) ──────────────────────────────────────

/** Issue a moderation strike against a user (§G16.6b) — audited by `issuedBy`. */
export async function issueStrike(input: {
  uid: string;
  reason: string;
  issuedBy: string;
  refType?: string;
  refId?: string;
  expiresAt?: string;
  now?: number;
}): Promise<StrikeItem> {
  const ts = new Date(input.now ?? Date.now()).toISOString();
  const item: StrikeItem = {
    ...gamifyKeys.strike(input.uid, ts),
    entity: "STRIKE",
    uid: input.uid,
    reason: input.reason,
    issuedBy: input.issuedBy,
    ts,
    ...(input.refType ? { refType: input.refType } : {}),
    ...(input.refId ? { refId: input.refId } : {}),
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
  };
  await updateItem({
    key: gamifyKeys.strike(input.uid, ts),
    update:
      "SET entity = :e, uid = :uid, reason = :r, issuedBy = :by, ts = :ts" +
      (input.refType ? ", refType = :rt" : "") +
      (input.refId ? ", refId = :ri" : "") +
      (input.expiresAt ? ", expiresAt = :ex" : ""),
    values: {
      ":e": "STRIKE",
      ":uid": input.uid,
      ":r": input.reason,
      ":by": input.issuedBy,
      ":ts": ts,
      ...(input.refType ? { ":rt": input.refType } : {}),
      ...(input.refId ? { ":ri": input.refId } : {}),
      ...(input.expiresAt ? { ":ex": input.expiresAt } : {}),
    },
  });
  return item;
}

/** Expire a strike (soft — sets `expiresAt`, keeping the audit row). `ts` is the strike's SK ts. */
export async function expireStrike(uid: string, ts: string, now: number = Date.now()): Promise<void> {
  await updateItem({
    key: gamifyKeys.strike(uid, ts),
    update: "SET expiresAt = :now",
    condition: "attribute_exists(sk)",
    values: { ":now": new Date(now).toISOString() },
  });
}

/** A user's strikes — one Query (pattern 38). `activeOnly` drops expired ones. */
export async function getStrikes(uid: string, opts?: { activeOnly?: boolean; now?: number }): Promise<StrikeItem[]> {
  const { items } = await query<StrikeItem>({ pk: gamifyKeys.strike(uid, "").pk, skBeginsWith: gamifyKeys.strikePrefix() });
  if (!opts?.activeOnly) return items;
  const nowIso = new Date(opts.now ?? Date.now()).toISOString();
  return items.filter((s) => !s.expiresAt || s.expiresAt > nowIso);
}

// ── (c) Board freeze (§G16.6c) ───────────────────────────────────────────────

/** Freeze a board partition — it stops rebuilding and renders a frozen notice. Audited. */
export async function freezeBoard(boardPk: string, frozenBy: string, now: number = Date.now()): Promise<void> {
  await updateItem({
    key: boardKeys.meta(boardPk),
    update: "SET frozen = :t, frozenBy = :by, frozenAt = :now, entity = if_not_exists(entity, :e)",
    values: { ":t": true, ":by": frozenBy, ":now": new Date(now).toISOString(), ":e": "LBMETA" },
  });
}

/** Unfreeze a board partition — the next qualifying tally rebuilds it. */
export async function unfreezeBoard(boardPk: string): Promise<void> {
  await updateItem({
    key: boardKeys.meta(boardPk),
    update: "REMOVE frozen, frozenBy, frozenAt",
    condition: "attribute_exists(pk)",
  });
}

/** Whether a board partition is currently frozen (for the admin panel / a frozen notice). */
export async function isBoardFrozen(boardPk: string): Promise<boolean> {
  const meta = await getItem<LbBoardMetaItem>(boardKeys.meta(boardPk));
  return !!meta?.frozen;
}
