/**
 * outings.ts — outings/games data layer (PRD §6.7, §9.5 #8–#11).
 *
 * This is Stage 4's first COMPOSITE ATOMIC WRITE (N15) and its first CAPACITY
 * CONCURRENCY control. Every §9.5 read below is a single keyed Query (hydration
 * of pointers via BatchGet is allowed — a BatchGet is not a scan):
 *   #8  games in a city on a date   → GSI2 `CITYGAME#<cityKey>#<yyyymmdd>` (public only)
 *   #9  games at a court            → base `COURT#<id>` / `begins_with(OUTING#)` (public filter)
 *   #10 outing detail + its RSVPs   → base `OUTING#<id>` (META + RSVP# in ONE Query)
 *   #11 my outings hosting/attending→ GSI1 `USER#<uid>` (OUTING# vs RSVP# prefixes)
 *
 * ── Composite create (createOuting, N15) ─────────────────────────────────────
 * OUTING(meta) + OUTINGREF(court pointer) + optional SERIES + optional group
 * MEETUP pointer are written in ONE `transactWrite` — all-or-nothing. The court
 * pointer PROJECTS `visibility` so private meet-ups filter out of the public
 * court query in one pass, and the city index (GSI2) is only populated for PUBLIC
 * outings, so a private meet-up is never even indexed in the city finder.
 *
 * ── Capacity concurrency (rsvp) ──────────────────────────────────────────────
 * A `going` RSVP claims a spot with a CONDITIONAL atomic counter on the OUTING:
 *   ADD goingCount :1  IF (attribute_not_exists(goingCount) OR goingCount < capacity)
 * DynamoDB serializes conditional updates on a single item, so when two writers
 * race for the last spot EXACTLY ONE condition passes (→ going); the loser catches
 * `ConditionalCheckFailedException` and is placed on the WAITLIST — never oversold.
 */

import { ulid } from "ulid";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import {
  getItem,
  query,
  queryAll,
  putItem,
  putConditional,
  updateItem,
  deleteItem,
  batchGet,
  transactWrite,
  txPut,
  txDelete,
} from "@/lib/db/client";
import { GSI } from "@/lib/db/table";
import { outingKeys, courtKeys, groupKeys, userKeys } from "@/lib/db/keys";
import { courtLocalDay } from "@/lib/directory/court-local-day";
import { emitInsert, emitRemove } from "@/lib/streams/inline";
import { trackServerEvent } from "@/lib/analytics/server";
import { tickQuests } from "@/lib/data/gamify-quests";
import { getCourt } from "@/lib/data/courts";
import type {
  OutingItem,
  OutingRefItem,
  RsvpItem,
  SeriesItem,
  OutingType,
  OutingHostType,
  RsvpStatus,
  Visibility,
} from "@/lib/db/types";

// ── types ────────────────────────────────────────────────────────────────────

export interface CreateOutingInput {
  title: string;
  courtId: string;
  organizerId: string;
  startTs: string; // ISO
  endTs?: string;
  type?: OutingType; // default "open"
  visibility?: Visibility; // default "public"
  hostType?: OutingHostType; // default "USER"
  groupId?: string | null; // required when hostType === "GROUP"
  tz?: string;
  skillMin?: number;
  skillMax?: number;
  capacity?: number;
  waitlist?: boolean;
  guestPolicy?: "none" | "allowed";
  description?: string;
  /** Recurrence (RFC 5545 subset, see lib/outings/rrule). Presence ⇒ a SERIES row. */
  rrule?: string | null;
  // Injectable for deterministic tests (mirrors buildCheckinItem's id/ts hooks).
  outingId?: string;
  seriesId?: string;
  inviteToken?: string;
  now?: number;
}

/** #10 read result: the outing plus every RSVP, from a single partition Query. */
export interface OutingWithRsvps {
  outing: OutingItem;
  rsvps: RsvpItem[];
}

/** #11 read result: outings the user hosts + the ones they've RSVP'd to (hydrated). */
export interface MyOutings {
  hosting: OutingItem[];
  attending: { outing: OutingItem; rsvp: RsvpItem }[];
}

export interface RsvpResult {
  rsvp: RsvpItem;
  goingCount: number;
  waitlistCount: number;
}

// ── create (composite atomic write, N15) ─────────────────────────────────────

/**
 * Create an outing as ONE atomic transaction: OUTING(meta) + OUTINGREF(court
 * pointer) + optional SERIES (recurring) + optional group MEETUP pointer. On
 * commit, emits the OUTING + OUTINGREF inserts so §9.4 aggregates reconcile
 * (`counts.games` on the geo hierarchy + `gamesCount` on the court).
 */
export async function createOuting(input: CreateOutingInput): Promise<OutingItem> {
  const court = await getCourt(input.courtId);
  if (!court) throw new Error(`Court not found: ${input.courtId}`);

  const now = input.now ?? Date.now();
  const iso = new Date(now).toISOString();
  const outingId = input.outingId ?? ulid();
  const type: OutingType = input.type ?? "open";
  const visibility: Visibility = input.visibility ?? (type === "private" ? "private" : "public");
  const hostType: OutingHostType = input.hostType ?? "USER";
  const groupId = hostType === "GROUP" ? input.groupId ?? null : null;
  if (hostType === "GROUP" && !groupId) {
    throw new Error("hostType=GROUP requires a groupId");
  }

  const cityKey = court.cityKey;
  const startTs = input.startTs;
  const yyyymmdd = courtLocalDay(court, Date.parse(startTs)); // real tz (lat/lng/tz), lng-approx fallback
  const isPublic = visibility === "public";
  const seriesId = input.rrule ? input.seriesId ?? ulid() : null;
  const inviteToken =
    visibility === "public" ? undefined : input.inviteToken ?? ulid().toLowerCase();

  // OUTING meta. GSI1 (organizer) is always projected; GSI2 (city finder) is
  // ONLY projected for PUBLIC outings, so private/unlisted meet-ups are never
  // indexed in the city game finder (#8) — the strongest "one pass" exclusion.
  const outing: OutingItem = {
    ...outingKeys.meta(outingId),
    ...outingKeys.byOrganizer(input.organizerId, startTs),
    ...(isPublic ? outingKeys.cityGame(cityKey, yyyymmdd, startTs, outingId) : {}),
    entity: "OUTING",
    outingId,
    title: input.title,
    type,
    hostType,
    groupId,
    courtId: input.courtId,
    cityKey,
    organizerId: input.organizerId,
    startTs,
    ...(input.endTs !== undefined ? { endTs: input.endTs } : {}),
    ...(input.tz !== undefined ? { tz: input.tz } : {}),
    ...(input.skillMin !== undefined ? { skillMin: input.skillMin } : {}),
    ...(input.skillMax !== undefined ? { skillMax: input.skillMax } : {}),
    ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
    ...(input.waitlist !== undefined ? { waitlist: input.waitlist } : {}),
    seriesId,
    rrule: input.rrule ?? null,
    visibility,
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.guestPolicy !== undefined ? { guestPolicy: input.guestPolicy } : {}),
    ...(inviteToken !== undefined ? { inviteToken } : {}),
    goingCount: 0,
    waitlistCount: 0,
    createdAt: iso,
    updatedAt: iso,
  };

  // Court pointer (OUTINGREF) — projects visibility/hostType/groupId so the public
  // court query (#9) filters private meet-ups in a single pass.
  const outingRef: OutingRefItem = {
    ...courtKeys.outingRef(input.courtId, startTs, outingId),
    entity: "OUTINGREF",
    courtId: input.courtId,
    outingId,
    startTs,
    visibility,
    hostType,
    groupId,
    createdAt: iso,
  };

  // create-only guards make the whole composite idempotent by id + all-or-nothing.
  const items = [
    txPut(outing as unknown as Record<string, unknown>, "attribute_not_exists(pk)"),
    txPut(outingRef as unknown as Record<string, unknown>, "attribute_not_exists(pk)"),
  ];

  if (seriesId) {
    const series: SeriesItem = {
      ...outingKeys.series(seriesId),
      entity: "SERIES",
      seriesId,
      rrule: input.rrule as string,
      organizerId: input.organizerId,
      courtId: input.courtId,
      cityKey,
      template: { title: input.title, startTs, ...(input.endTs ? { endTs: input.endTs } : {}) },
      createdAt: iso,
    };
    items.push(txPut(series as unknown as Record<string, unknown>, "attribute_not_exists(pk)"));
  }

  if (hostType === "GROUP" && groupId) {
    const meetup = {
      ...groupKeys.meetupRef(groupId, startTs, outingId),
      entity: "MEETUP",
      groupId,
      outingId,
      startTs,
      courtId: input.courtId,
      visibility,
      createdAt: iso,
    };
    items.push(txPut(meetup as unknown as Record<string, unknown>, "attribute_not_exists(pk)"));
  }

  await transactWrite(items);

  // Reconcile §9.4 aggregates (inline locally; the real Streams Lambda in prod).
  await emitInsert(outing as unknown as Record<string, unknown>);
  await emitInsert(outingRef as unknown as Record<string, unknown>);

  return outing;
}

// ── reads ────────────────────────────────────────────────────────────────────

/** Outing META by id (GetItem). */
export async function getOutingMeta(outingId: string): Promise<OutingItem | undefined> {
  return getItem<OutingItem>(outingKeys.meta(outingId));
}

/**
 * #10 — an outing plus ALL its RSVPs in ONE Query on `PK=OUTING#<id>` (META first,
 * then every `RSVP#` row). Returns `undefined` if the outing doesn't exist.
 */
export async function getOuting(outingId: string): Promise<OutingWithRsvps | undefined> {
  const { items } = await query<OutingItem | RsvpItem>({ pk: outingKeys.meta(outingId).pk });
  const outing = items.find((i) => i.sk === "META") as OutingItem | undefined;
  if (!outing) return undefined;
  const rsvps = items.filter((i): i is RsvpItem => i.sk.startsWith(outingKeys.rsvpPrefix()));
  return { outing, rsvps };
}

/**
 * #8 — public games in a city on a court-local day (GSI2 `CITYGAME#…#yyyymmdd`),
 * ordered by start time. Only PUBLIC outings carry the GSI2 keys, so private
 * meet-ups never appear here (no read-time filter needed).
 */
export async function getCityGames(cityKey: string, yyyymmdd: string): Promise<OutingItem[]> {
  const { items } = await query<OutingItem>({
    index: GSI.byLocation,
    pk: outingKeys.cityGamePk(cityKey, yyyymmdd),
    ascending: true, // gsi2sk = `<startTs>#<outingId>` → chronological
  });
  return items.filter((o) => o.visibility === "public");
}

/**
 * #9 — upcoming PUBLIC games at a court. One keyed Query on the OUTINGREF pointer
 * partition with a `visibility="public"` FILTER (the projection lets us exclude
 * private meet-ups in a single pass, §9.5 note), then BatchGet-hydrate the OUTINGs.
 * Returns upcoming outings (startTs ≥ now), soonest first.
 *
 * The OUTINGREF SK is `OUTING#<startTs>#<outingId>` (chronological). We must NOT read
 * the partition oldest-first and drop past rows in JS (L11): an active court accumulates
 * a full 1 MB page of PAST refs, so a single begins_with page would be entirely past-
 * dated and report ZERO upcoming games though future outings exist deeper in the
 * partition. Instead the sort-key RANGE (`sk ≥ OUTING#<now>`) starts the read at the
 * first upcoming game, and `queryAll` follows pagination so none is dropped.
 */
export async function getCourtGames(
  courtId: string,
  opts?: { now?: number; includePast?: boolean },
): Promise<OutingItem[]> {
  const nowIso = new Date(opts?.now ?? Date.now()).toISOString();
  const prefix = courtKeys.outingRefPrefix();
  const refs = await queryAll<OutingRefItem>({
    pk: courtKeys.meta(courtId).pk,
    // \uffff sorts above every ASCII SK byte → an open upper bound within the prefix.
    ...(opts?.includePast
      ? { skBeginsWith: prefix }
      : { skBetween: [`${prefix}${nowIso}`, `${prefix}\uffff`] as [string, string] }),
    ascending: true,
    filter: {
      expression: "visibility = :pub",
      values: { ":pub": "public" },
    },
  });
  if (refs.length === 0) return [];

  const metas = await batchGet<OutingItem>(refs.map((r) => outingKeys.meta(r.outingId)));
  return metas
    .filter((o) => o.visibility === "public")
    .sort((a, b) => a.startTs.localeCompare(b.startTs));
}

/**
 * #11 — the caller's outings, split into `hosting` (OUTING# rows on GSI1) and
 * `attending` (RSVP# rows on GSI1, hydrated to their outings). Each list is one
 * keyed Query on the `USER#<uid>` GSI1 partition; attending outings are hydrated
 * with a single BatchGet.
 */
export async function getMyOutings(uid: string): Promise<MyOutings> {
  const userPk = userKeys.profile(uid).pk;
  const [hostingRes, rsvpRes] = await Promise.all([
    query<OutingItem>({
      index: GSI.byOwner,
      pk: userPk,
      skBeginsWith: "OUTING#",
      ascending: false,
    }),
    query<RsvpItem>({
      index: GSI.byOwner,
      pk: userPk,
      skBeginsWith: outingKeys.rsvpPrefix(),
      ascending: false,
    }),
  ]);

  const rsvps = rsvpRes.items;
  const outingsById = new Map<string, OutingItem>();
  if (rsvps.length > 0) {
    const metas = await batchGet<OutingItem>(rsvps.map((r) => outingKeys.meta(r.outingId)));
    for (const m of metas) outingsById.set(m.outingId, m);
  }
  const attending = rsvps
    .map((rsvp) => {
      const outing = outingsById.get(rsvp.outingId);
      return outing ? { outing, rsvp } : undefined;
    })
    .filter((x): x is { outing: OutingItem; rsvp: RsvpItem } => x !== undefined);

  return { hosting: hostingRes.items, attending };
}

// ── RSVP (capacity concurrency + waitlist) ───────────────────────────────────

/** Atomic ADD of a delta to a counter attr on the OUTING META. */
async function addOutingCounter(
  outingId: string,
  attr: "goingCount" | "waitlistCount",
  delta: number,
): Promise<number> {
  const attrs = await updateItem({
    key: outingKeys.meta(outingId),
    update: `ADD ${attr} :d`,
    values: { ":d": delta },
  });
  const v = attrs?.[attr];
  return typeof v === "number" ? v : 0;
}

/**
 * Try to atomically claim one of `capacity` going-spots. Returns `true` on
 * success. The CONDITIONAL update is the concurrency gate: only one racing writer
 * can move `goingCount` from `capacity-1` to `capacity`; the rest fail the
 * condition and are told to waitlist. Unlimited capacity always succeeds.
 */
async function claimGoingSpot(outingId: string, capacity: number | undefined): Promise<boolean> {
  if (capacity === undefined || capacity === null) {
    await addOutingCounter(outingId, "goingCount", 1);
    return true;
  }
  try {
    await updateItem({
      key: outingKeys.meta(outingId),
      update: "ADD goingCount :one",
      condition: "attribute_not_exists(goingCount) OR goingCount < :cap",
      values: { ":one": 1, ":cap": capacity },
    });
    return true;
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) return false;
    throw err;
  }
}

/**
 * RSVP to an outing. `going` is capacity-aware: if the outing is full the RSVP is
 * placed on the waitlist at the next position (no oversell — see module header).
 * Re-RSVPs adjust counters idempotently. Returns the RSVP plus fresh counts.
 */
export async function rsvp(
  outingId: string,
  uid: string,
  status: RsvpStatus,
  guestCount?: number,
): Promise<RsvpResult> {
  const meta = await getOutingMeta(outingId);
  if (!meta) throw new Error(`Outing not found: ${outingId}`);
  const startTs = meta.startTs;
  const key = outingKeys.rsvp(outingId, uid, startTs);
  const existing = await getItem<RsvpItem>(key);
  const sOld = existing?.status;
  const now = new Date().toISOString();

  const build = (finalStatus: RsvpStatus, waitlistPos: number | undefined): RsvpItem => ({
    ...key,
    entity: "RSVP",
    outingId,
    uid,
    status: finalStatus,
    ...(waitlistPos !== undefined ? { waitlistPos } : {}),
    ...(guestCount !== undefined ? { guestCount } : {}),
    respondedAt: now,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });

  // Same status (e.g. only guestCount changed) → no counter movement and no
  // serialization needed (a concurrent double-submit is last-write-wins on scalars,
  // never a counter drift). Preserve the held waitlist position.
  if (sOld === status) {
    const item = build(status, existing?.waitlistPos);
    await putItem(item as unknown as Record<string, unknown>);
    const same = await getOutingMeta(outingId);
    return {
      rsvp: item,
      goingCount: same?.goingCount ?? 0,
      waitlistCount: same?.waitlistCount ?? 0,
    };
  }

  // ── A genuine STATUS TRANSITION. Serialize it per user (M6): apply this call's
  // counter deltas, then COMMIT the row with a conditional put on the EXACT prior
  // status — the concurrency gate. A racing double-submit changes the row first, our
  // condition fails, and we UNDO our deltas and return the winner's state. The freed-
  // seat promotion is deferred to AFTER a winning commit so a loser never promotes.
  let finalStatus: RsvpStatus = status;
  let waitlistPos: number | undefined;
  const undo: Array<() => Promise<unknown>> = [];

  if (status === "going") {
    const claimed = await claimGoingSpot(outingId, meta.capacity);
    if (claimed) {
      finalStatus = "going";
      undo.push(() => addOutingCounter(outingId, "goingCount", -1));
    } else {
      finalStatus = "waitlist";
      waitlistPos = await addOutingCounter(outingId, "waitlistCount", 1);
      undo.push(() => addOutingCounter(outingId, "waitlistCount", -1));
    }
  } else if (status === "waitlist") {
    finalStatus = "waitlist";
    waitlistPos = await addOutingCounter(outingId, "waitlistCount", 1);
    undo.push(() => addOutingCounter(outingId, "waitlistCount", -1));
  }
  // "maybe" / "declined" carry no capacity semantics — no counter to apply.

  // Release the OLD status's counter (decrement only; promotion deferred to post-commit).
  if (sOld === "going") {
    await addOutingCounter(outingId, "goingCount", -1);
    undo.push(() => addOutingCounter(outingId, "goingCount", 1));
  } else if (sOld === "waitlist") {
    await addOutingCounter(outingId, "waitlistCount", -1);
    undo.push(() => addOutingCounter(outingId, "waitlistCount", 1));
  }

  const item = build(finalStatus, waitlistPos);
  let committed = true;
  try {
    await putConditional(
      item as unknown as Record<string, unknown>,
      sOld === undefined ? "attribute_not_exists(pk)" : "#s = :sOld",
      sOld === undefined ? undefined : { names: { "#s": "status" }, values: { ":sOld": sOld } },
    );
  } catch (err) {
    if (!(err instanceof ConditionalCheckFailedException)) throw err;
    committed = false;
  }

  if (!committed) {
    // Lost the race to a concurrent write — undo our counter deltas (in reverse) and
    // return whatever the winner left, so the double-submit nets a single mutation.
    for (const u of [...undo].reverse()) await u();
    const cur = await getItem<RsvpItem>(key);
    const lost = await getOutingMeta(outingId);
    return {
      rsvp: cur ?? item,
      goingCount: lost?.goingCount ?? 0,
      waitlistCount: lost?.waitlistCount ?? 0,
    };
  }

  // Won the race. If we vacated a `going` seat, promote the waitlist head into it now
  // (the row is committed to its new non-going status, so it can't promote itself).
  // If we vacated a WAITLIST position, renumber the survivors so positions stay
  // contiguous and a later joiner can't collide with a surviving one (M7).
  if (sOld === "going") {
    await promoteWaitlistIntoFreedSpot(outingId, startTs, meta.capacity);
  } else if (sOld === "waitlist") {
    await renumberWaitlistAfterDeparture(outingId, startTs, existing?.waitlistPos ?? Infinity);
  }

  const fresh = await getOutingMeta(outingId);

  // ⚙ rsvp_set (§2.1) — a confirmed RSVP (going / waitlist / maybe / declined).
  trackServerEvent(uid, "rsvp_set", {
    outingId,
    status: finalStatus,
    ...(waitlistPos !== undefined ? { waitlistPos } : {}),
    goingCount: fresh?.goingCount ?? 0,
  });

  // rsvp1 quest tick (non-ledger, §G9.1) — E19 itself pays at the post-event sweep.
  if (finalStatus === "going") await tickQuests(uid, [{ tick: "rsvp-going" }]);

  return {
    rsvp: item,
    goingCount: fresh?.goingCount ?? 0,
    waitlistCount: fresh?.waitlistCount ?? 0,
  };
}

/**
 * PURE waitlist-promotion helper (unit-tested): given every RSVP for an outing,
 * pick the head of the waitlist (lowest `waitlistPos`) to promote and return the
 * remaining waitlisters with their positions shifted up by one.
 */
export function promoteFromWaitlist(rsvps: RsvpItem[]): {
  promoted?: RsvpItem;
  remaining: RsvpItem[];
} {
  const waiting = rsvps
    .filter((r) => r.status === "waitlist")
    .sort((a, b) => (a.waitlistPos ?? Infinity) - (b.waitlistPos ?? Infinity));
  if (waiting.length === 0) return { remaining: [] };
  const [head, ...rest] = waiting;
  const promoted: RsvpItem = { ...head, status: "going", waitlistPos: undefined };
  const remaining = rest.map((r, i) => ({ ...r, waitlistPos: i + 1 }));
  return { promoted, remaining };
}

/**
 * A `going` seat just freed up (a cancel, or a going→declined/maybe/waitlist downgrade).
 * Promote the head of the waitlist into it (bumping `goingCount`, dropping
 * `waitlistCount`) and reposition the rest. The caller MUST have already decremented
 * `goingCount` for the departing attendee. No-op when the waitlist is empty.
 */
async function promoteWaitlistIntoFreedSpot(
  outingId: string,
  startTs: string,
  capacity: number | undefined,
): Promise<void> {
  const after = await getOuting(outingId);
  const { promoted, remaining } = promoteFromWaitlist(after?.rsvps ?? []);
  if (!promoted) return;
  // Claim the freed spot CONDITIONALLY (never oversell). Between the caller's decrement
  // and now, a concurrent new `going` RSVP may have already refilled capacity — an
  // unconditional `ADD goingCount :1` would push it past capacity (M5). If the claim
  // fails, the spot is taken: leave the waitlister in place rather than oversell.
  const claimed = await claimGoingSpot(outingId, capacity);
  if (!claimed) return;
  await putItem({
    ...outingKeys.rsvp(outingId, promoted.uid, startTs),
    entity: "RSVP",
    outingId,
    uid: promoted.uid,
    status: "going",
    ...(promoted.guestCount !== undefined ? { guestCount: promoted.guestCount } : {}),
    respondedAt: promoted.respondedAt,
    createdAt: promoted.createdAt,
    updatedAt: new Date().toISOString(),
  } as unknown as Record<string, unknown>);
  await addOutingCounter(outingId, "waitlistCount", -1);
  for (const r of remaining) {
    await updateItem({
      key: outingKeys.rsvp(outingId, r.uid, startTs),
      update: "SET waitlistPos = :p",
      values: { ":p": r.waitlistPos },
    });
  }
}

/**
 * Shift every waitlister behind `departedPos` up by one, keeping positions
 * contiguous `1..waitlistCount` after a waitlister leaves the list (a cancel, or a
 * waitlist→going/maybe/declined transition). `waitlistPos` is derived from the
 * post-ADD `waitlistCount`, so if a departure decrements the count WITHOUT
 * renumbering, the gap left behind means the next joiner — assigned the reused
 * counter value — COLLIDES with a surviving waitlister, making `promoteFromWaitlist`
 * order the duplicates arbitrarily (M7). The caller MUST have already decremented
 * `waitlistCount`. No-op when `departedPos` is unknown (nothing safe to shift).
 */
async function renumberWaitlistAfterDeparture(
  outingId: string,
  startTs: string,
  departedPos: number,
): Promise<void> {
  const after = await getOuting(outingId);
  for (const r of after?.rsvps ?? []) {
    if (r.status === "waitlist" && (r.waitlistPos ?? 0) > departedPos) {
      await updateItem({
        key: outingKeys.rsvp(outingId, r.uid, startTs),
        update: "SET waitlistPos = :p",
        values: { ":p": (r.waitlistPos ?? 1) - 1 },
      });
    }
  }
}

/**
 * Cancel the caller's RSVP. If a `going` RSVP is cancelled, the head of the
 * waitlist is promoted into the freed spot (counts adjusted accordingly), and the
 * remaining waitlisters are repositioned.
 */
export async function cancelRsvp(outingId: string, uid: string): Promise<RsvpResult | undefined> {
  const meta = await getOutingMeta(outingId);
  if (!meta) return undefined;
  const startTs = meta.startTs;
  const existing = await getItem<RsvpItem>(outingKeys.rsvp(outingId, uid, startTs));
  if (!existing) return undefined;

  // CONDITIONAL delete: it is the concurrency gate (M6). A double-submitted cancel would
  // otherwise have both requests read `existing`, both decrement, and both promote — so
  // one seat frees TWO waitlisters and the count under-reads. Only the request that
  // actually removes the row proceeds to decrement + promote; the loser no-ops.
  try {
    await deleteItem(outingKeys.rsvp(outingId, uid, startTs), "attribute_exists(pk)");
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) return undefined;
    throw err;
  }

  if (existing.status === "going") {
    await addOutingCounter(outingId, "goingCount", -1);
    // Promote the head of the waitlist into the freed spot.
    await promoteWaitlistIntoFreedSpot(outingId, startTs, meta.capacity);
  } else if (existing.status === "waitlist") {
    await addOutingCounter(outingId, "waitlistCount", -1);
    // Shift waitlisters behind the cancelled one up by a position.
    await renumberWaitlistAfterDeparture(outingId, startTs, existing.waitlistPos ?? Infinity);
  }

  const fresh = await getOutingMeta(outingId);
  return {
    rsvp: { ...existing, status: "declined" },
    goingCount: fresh?.goingCount ?? 0,
    waitlistCount: fresh?.waitlistCount ?? 0,
  };
}

// ── organizer edit / delete ──────────────────────────────────────────────────

/** Scalar fields an organizer may edit without re-keying the outing. */
export interface UpdateOutingInput {
  title?: string;
  description?: string;
  skillMin?: number;
  skillMax?: number;
  capacity?: number;
  waitlist?: boolean;
  guestPolicy?: "none" | "allowed";
  endTs?: string;
}

/**
 * Organizer edit of an outing's non-key attributes. Changing the court, start
 * time, or visibility would require re-keying the OUTINGREF / GSI rows, so those
 * are intentionally out of scope here (recreate the outing for such changes).
 */
export async function updateOuting(
  outingId: string,
  patch: UpdateOutingInput,
): Promise<OutingItem | undefined> {
  const sets: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  let i = 0;
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const nk = `#f${i}`;
    const vk = `:v${i}`;
    names[nk] = key;
    values[vk] = value;
    sets.push(`${nk} = ${vk}`);
    i++;
  }
  names["#u"] = "updatedAt";
  values[":u"] = new Date().toISOString();
  sets.push("#u = :u");

  const attrs = await updateItem({
    key: outingKeys.meta(outingId),
    update: `SET ${sets.join(", ")}`,
    names,
    values,
    condition: "attribute_exists(pk)",
  });
  return attrs as OutingItem | undefined;
}

/**
 * Delete an outing and its pointers (OUTING + OUTINGREF + SERIES? + MEETUP?) in
 * one atomic transaction, then emit removes so `counts.games`/`gamesCount` decrement.
 * RSVP rows are left to the reconcile sweep (they're child rows of the gone outing).
 */
export async function deleteOuting(outingId: string): Promise<void> {
  const meta = await getOutingMeta(outingId);
  if (!meta) return;

  const outingRef: OutingRefItem = {
    ...courtKeys.outingRef(meta.courtId, meta.startTs, outingId),
    entity: "OUTINGREF",
    courtId: meta.courtId,
    outingId,
    startTs: meta.startTs,
    visibility: meta.visibility,
    hostType: meta.hostType,
    groupId: meta.groupId ?? null,
  };

  const items = [
    txDelete(outingKeys.meta(outingId)),
    txDelete(courtKeys.outingRef(meta.courtId, meta.startTs, outingId)),
  ];
  if (meta.seriesId) items.push(txDelete(outingKeys.series(meta.seriesId)));
  if (meta.hostType === "GROUP" && meta.groupId) {
    items.push(txDelete(groupKeys.meetupRef(meta.groupId, meta.startTs, outingId)));
  }
  await transactWrite(items);

  await emitRemove(meta as unknown as Record<string, unknown>);
  await emitRemove(outingRef as unknown as Record<string, unknown>);
}
