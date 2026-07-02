/**
 * checkins.ts — durable court check-ins (PRD §6.2, §9.5 #5 & #6).
 *
 * A check-in is a durable row (no presence TTL); "today" is a court-local
 * `checkinDay` filter, not an expiry. Two reads, one Query each:
 *   #5 a court's check-ins today  → base table `COURT#id` / `begins_with(CHECKIN#)`
 *   #6 a user's check-ins         → GSI1 `USER#uid` / `begins_with(CHECKIN#)`
 *
 * Writes go through {@link createCheckin}, which copies the court's `cityKey` onto
 * the row (the CITYDAY aggregator needs it) and calls `emitInsert` so the §9.4
 * aggregates (court `checkinsTodayCount`/`playerCount`, CITYDAY rollup) reconcile.
 * ANONYMOUS check-ins carry NO `uid`/PII and get no GSI1 projection.
 */

import { ulid } from "ulid";
import { getItem, query, putItem } from "@/lib/db/client";
import { GSI } from "@/lib/db/table";
import { courtKeys, userKeys } from "@/lib/db/keys";
import { emitInsert } from "@/lib/streams/inline";
import type { CheckinItem, CourtItem } from "@/lib/db/types";

/** A check-in row carrying the denormalized `cityKey` the CITYDAY aggregator reads. */
export type CheckinRecord = CheckinItem & { cityKey?: string };

export interface CreateCheckinInput {
  courtId: string;
  /** Present for account check-ins; `null`/absent for anonymous ones. */
  uid?: string | null;
  anonymous: boolean;
  note?: string;
  skill?: number;
  lookingToPlay?: boolean;
  /** Court-local `yyyymmdd` (see {@link import("@/lib/directory/court-local-day")}). */
  day: string;
  /** Injectable for deterministic tests. */
  ts?: string;
  id?: string;
}

/** #5 — a court's check-ins for `day`, newest-first (one Query + a day filter). */
export async function getCourtCheckinsToday(courtId: string, day: string): Promise<CheckinItem[]> {
  const { items } = await query<CheckinItem>({
    pk: courtKeys.meta(courtId).pk,
    skBeginsWith: courtKeys.checkinPrefix(),
    ascending: false, // SK carries `ts` → descending = newest-first
    filter: { expression: "checkinDay = :day", values: { ":day": day } },
  });
  return items;
}

/** #6 — a user's check-ins, newest-first (one Query on GSI1). Durable across days. */
export async function getMyCheckins(uid: string): Promise<CheckinItem[]> {
  const { items } = await query<CheckinItem>({
    index: GSI.byOwner,
    pk: userKeys.profile(uid).pk,
    skBeginsWith: courtKeys.checkinPrefix(),
    ascending: false,
  });
  return items;
}

/**
 * Build a durable CHECKIN row (pure — no I/O). Anonymous check-ins get NO `uid`
 * attribute and (via `courtKeys.checkin`) no GSI1 projection, so they can never be
 * traced back to an account. `cityKey` is denormalized on for the CITYDAY rollup.
 */
export function buildCheckinItem(
  input: CreateCheckinInput,
  cityKey: string | undefined,
  now: number = Date.now(),
): CheckinRecord {
  const iso = new Date(now).toISOString();
  const ts = input.ts ?? iso;
  const id = input.id ?? ulid();
  const uid = input.uid ?? null;
  return {
    ...courtKeys.checkin(input.courtId, ts, id, uid),
    entity: "CHECKIN",
    courtId: input.courtId,
    anonymous: input.anonymous,
    checkinDay: input.day,
    ...(uid ? { uid } : {}),
    ...(input.note !== undefined ? { note: input.note } : {}),
    ...(input.skill !== undefined ? { skill: input.skill } : {}),
    ...(input.lookingToPlay !== undefined ? { lookingToPlay: input.lookingToPlay } : {}),
    ...(cityKey ? { cityKey } : {}),
    createdAt: iso,
  };
}

/**
 * Persist a check-in, then emit its INSERT so §9.4 aggregates apply (locally when
 * `STREAMS_INLINE=1`; the real Streams Lambda in prod). The court's `cityKey` is
 * fetched here so the CITYDAY metro rollup can attribute the check-in.
 */
export async function createCheckin(input: CreateCheckinInput): Promise<CheckinRecord> {
  const court = await getItem<CourtItem>(courtKeys.meta(input.courtId));
  const item = buildCheckinItem(input, court?.cityKey);
  await putItem(item as unknown as Record<string, unknown>);
  await emitInsert(item as unknown as Record<string, unknown>);
  return item;
}
