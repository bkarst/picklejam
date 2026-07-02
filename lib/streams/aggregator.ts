/**
 * aggregator.ts — the DynamoDB Streams → aggregate dispatcher (PRD §9.4, Stage 0.5).
 *
 * A stream consumer (Lambda in prod; the `local.ts` poller in dev/tests) hands us a
 * NORMALIZED record `{ eventName, newImage?, oldImage? }`. We route by the item's
 * key prefixes (`pk`/`sk`, defined in `lib/db/keys.ts`) — which double as the
 * `entity` discriminator (§9.3) — and apply the §9.4 denormalized aggregates with
 * atomic single-item writes on the parent item.
 *
 * ── Idempotency strategy ─────────────────────────────────────────────────────
 * DynamoDB Streams give AT-LEAST-ONCE delivery, so a record may be replayed and
 * handlers must not drift when it is. Our strategy:
 *
 *  1. COUNTERS use atomic `ADD` deltas (`reviewCount`, `checkinsTodayCount`,
 *     `memberCount`, `registeredCount`, `spotsLeft`, geo `counts.*`). `ADD` is
 *     commutative, so re-ordered records converge — BUT it is NOT exactly-once:
 *     a genuinely duplicated record double-counts. That residual drift is healed
 *     by the periodic reconcile sweep (`reconcile.ts`, §9.1), which recomputes
 *     each aggregate from its source items.
 *
 *  2. AVERAGES avoid the classic non-idempotent "rolling average" trap by storing
 *     a running `ratingSum` + `reviewCount` (both atomic `ADD`) and DERIVING
 *     `ratingAvg = ratingSum / reviewCount` from the post-write (`ALL_NEW`)
 *     snapshot. A MODIFY that only changes a rating applies the delta
 *     `(newRating - oldRating)` to the sum, leaving the count untouched.
 *
 *  3. TRANSITION events (a REG becoming `paid`) fire the aggregate exactly on the
 *     `!= 'paid' → == 'paid'` edge (detected in MODIFY, plus an INSERT that is
 *     already `paid`), so a replay of the same post-transition image is a no-op
 *     edge and does not re-increment.
 *
 * Handlers only act on their own trigger event (e.g. counts roll up on INSERT
 * only), so the aggregator's OWN writes to parent items (COURT/META, DIVISION,
 * GROUP/META, CITYDAY, geo) — which themselves emit MODIFY stream records — are
 * ignored on the way back through and never form a feedback loop.
 */

import "server-only";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { updateItem } from "@/lib/db/client";
import {
  courtKeys,
  geoKeys,
  groupKeys,
  parseCityKey,
  type PrimaryKey,
} from "@/lib/db/keys";
import type { Counts } from "@/lib/db/types";

// ── normalized record shape (what a consumer feeds us) ──────────────────────

export type StreamEventName = "INSERT" | "MODIFY" | "REMOVE";

/** A single stream event, normalized + unmarshalled (see `local.ts`). */
export interface StreamRecord {
  eventName: StreamEventName;
  /** The item as it looks AFTER the change (INSERT/MODIFY). */
  newImage?: Record<string, unknown>;
  /** The item as it looked BEFORE the change (MODIFY/REMOVE). */
  oldImage?: Record<string, unknown>;
}

/** Standings host entities (§9.4 STANDING row). */
export type StandingsEntityType = "RR" | "LEAGUE" | "TOURNEY";

// ── typed image accessors (no `any`) ────────────────────────────────────────

function str(img: Record<string, unknown>, key: string): string | undefined {
  const v = img[key];
  return typeof v === "string" ? v : undefined;
}

function num(img: Record<string, unknown>, key: string): number | undefined {
  const v = img[key];
  return typeof v === "number" ? v : undefined;
}

/** Strip a `PREFIX#` from a key value; `undefined` if it doesn't match. */
function stripPrefix(value: string, prefix: string): string | undefined {
  return value.startsWith(prefix) ? value.slice(prefix.length) : undefined;
}

/** The image to route on: the new one for INSERT/MODIFY, the old one for REMOVE. */
function currentImage(record: StreamRecord): Record<string, unknown> | undefined {
  return record.newImage ?? record.oldImage;
}

// ── geo counts helper (§9.4 counts{courts,games,players,groups}) ─────────────

/**
 * `SET counts.<field> = if_not_exists(counts.<field>, 0) + delta` on a geo item.
 * If the `counts` map itself is absent (or the whole item is new), the nested SET
 * would raise a ValidationException ("document path invalid"); we then initialize
 * the map and retry once. Geo items created by the ingestion pipeline (§9.8)
 * already carry `counts{}`, so the fallback is only exercised by fresh/local data.
 */
async function addCount(key: PrimaryKey, field: keyof Counts, delta: number): Promise<void> {
  const names = { "#c": "counts", "#f": field };
  const values = { ":z": 0, ":d": delta };
  const update = "SET #c.#f = if_not_exists(#c.#f, :z) + :d";
  try {
    await updateItem({ key, update, names, values });
  } catch (err) {
    if (!isMissingPathError(err)) throw err;
    await updateItem({
      key,
      update: "SET #c = if_not_exists(#c, :empty)",
      names: { "#c": "counts" },
      values: { ":empty": {} },
    });
    await updateItem({ key, update, names, values });
  }
}

function isMissingPathError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { name?: string; message?: string };
  return e.name === "ValidationException" && typeof e.message === "string" && e.message.includes("document path");
}

/** Roll a `counts.<field>` delta up the geo hierarchy: CITY → STATE → COUNTRY. */
async function bumpCityStateCountry(cityKey: string, field: keyof Counts, delta: number): Promise<void> {
  const { country, state, city } = parseCityKey(cityKey);
  const cityKeyPk = geoKeys.city(country, state, city);
  const stateKeyPk = geoKeys.state(country, state);
  const countryKeyPk = geoKeys.country(country);
  await Promise.all([
    addCount({ pk: cityKeyPk.pk, sk: cityKeyPk.sk }, field, delta),
    addCount({ pk: stateKeyPk.pk, sk: stateKeyPk.sk }, field, delta),
    addCount({ pk: countryKeyPk.pk, sk: countryKeyPk.sk }, field, delta),
  ]);
}

// ── REVIEW → reviewCount + ratingSum + ratingAvg on COURT/META ───────────────

async function onReview(record: StreamRecord): Promise<void> {
  const cur = currentImage(record);
  if (!cur) return;
  const pk = str(cur, "pk");
  const courtId = pk ? stripPrefix(pk, "COURT#") : undefined;
  if (!courtId) return;

  let dCount = 0;
  let dSum = 0;
  if (record.eventName === "INSERT") {
    dCount = 1;
    dSum = num(record.newImage ?? {}, "rating1to5") ?? 0;
  } else if (record.eventName === "REMOVE") {
    dCount = -1;
    dSum = -(num(record.oldImage ?? {}, "rating1to5") ?? 0);
  } else {
    // MODIFY: only the rating delta matters; count is unchanged.
    const nr = num(record.newImage ?? {}, "rating1to5");
    const or = num(record.oldImage ?? {}, "rating1to5");
    if (nr === undefined || or === undefined || nr === or) return; // no rating-relevant change
    dSum = nr - or;
  }

  const key = courtKeys.meta(courtId);
  // Atomic ADD of the deltas; ALL_NEW gives us the fresh running totals.
  const attrs = await updateItem({
    key,
    update: "ADD reviewCount :dc, ratingSum :ds",
    values: { ":dc": dCount, ":ds": dSum },
  });
  const count = num(attrs ?? {}, "reviewCount") ?? 0;
  const sum = num(attrs ?? {}, "ratingSum") ?? 0;
  const avg = count > 0 ? sum / count : 0;
  // Derived `ratingAvg` can't be folded into the atomic ADD (no division in an update
  // expression), so guard the follow-up SET against the EXACT totals this ADD produced:
  // if a concurrent review has since changed count or sum, its (fresher) SET is the
  // authoritative one and ours is skipped — otherwise a stale SET could clobber it.
  try {
    await updateItem({
      key,
      update: "SET ratingAvg = :a",
      condition: "reviewCount = :count AND ratingSum = :sum",
      values: { ":a": avg, ":count": count, ":sum": sum },
    });
  } catch (err) {
    if (!(err instanceof ConditionalCheckFailedException)) throw err;
    // A newer review won the race; its SET reflects the latest totals. (Reconcile
    // also recomputes the ground truth from the REVIEW# rows, §14.6.)
  }
}

// ── CHECKIN → court checkinsTodayCount + CITYDAY rollup + playerCount ─────────

async function onCheckin(record: StreamRecord): Promise<void> {
  if (record.eventName !== "INSERT") return; // §9.4: check-in aggregate is insert-only
  const img = record.newImage;
  if (!img) return;
  const pk = str(img, "pk");
  const courtId = pk ? stripPrefix(pk, "COURT#") : undefined;
  if (!courtId) return;

  // `playerCount` is distinct-ish only: we +1 for any check-in carrying a uid, so a
  // returning player is double-counted. True distinctness needs a per-uid marker;
  // the reconcile sweep (or a future SET-based dedupe) can correct it.
  const hasUid = (str(img, "uid") ?? "").length > 0;

  // Court META.
  const courtAdd = hasUid ? "checkinsTodayCount :one, playerCount :one" : "checkinsTodayCount :one";
  await updateItem({ key: courtKeys.meta(courtId), update: `ADD ${courtAdd}`, values: { ":one": 1 } });

  // CITYDAY rollup. Requires `cityKey` denormalized onto the check-in item + its
  // court-local `checkinDay`; if either is missing we can't attribute the metro
  // rollup, so we skip it (the court counter above still landed).
  const cityKey = str(img, "cityKey");
  const day = str(img, "checkinDay");
  if (!cityKey || !day) return;
  const cd = geoKeys.cityDay(cityKey, day);
  const cityAdd = hasUid ? "checkinsCount :one, playerCount :one" : "checkinsCount :one";
  await updateItem({
    key: cd,
    // Seed the descriptive attrs on first touch (`day` is a DynamoDB reserved word → #d).
    update: `SET #e = if_not_exists(#e, :e), cityKey = if_not_exists(cityKey, :ck), #d = if_not_exists(#d, :day) ADD ${cityAdd}`,
    names: { "#e": "entity", "#d": "day" },
    values: { ":one": 1, ":e": "CITYDAY", ":ck": cityKey, ":day": day },
  });
}

// ── entity create → geo counts{courts,games,players,groups} ──────────────────

async function onCreateGeoCount(
  record: StreamRecord,
  field: keyof Counts,
  cityKeyAttr: string,
): Promise<void> {
  if (record.eventName !== "INSERT") return; // count on create only
  const img = record.newImage;
  if (!img) return;
  const cityKey = str(img, cityKeyAttr);
  if (!cityKey) return; // e.g. a user with no homeCityKey — nothing to attribute
  await bumpCityStateCountry(cityKey, field, 1);
}

// NOTE: seed ingestion (§9.8) rolls `counts` up via a dedicated BATCH path, not
// per-item Streams, precisely to avoid double-counting the ~16K bulk court import.
// This stream path is for organic (post-launch) creates.

// ── GROUP/META insert/remove → geo counts.groups (§9.4) ──────────────────────

/**
 * A group create/delete rolls `counts.groups` up the geo hierarchy (CITY → STATE →
 * COUNTRY). Unlike the court `groupCount` (public-only), this counts EVERY group
 * regardless of visibility — it's the total-communities metric for the geo pages.
 */
async function onGroupMeta(record: StreamRecord): Promise<void> {
  let delta = 0;
  if (record.eventName === "INSERT") delta = 1;
  else if (record.eventName === "REMOVE") delta = -1;
  else return; // a META edit (e.g. visibility toggle) never changes the group count
  const img = currentImage(record);
  if (!img) return;
  const cityKey = str(img, "cityKey");
  if (!cityKey) return;
  await bumpCityStateCountry(cityKey, "groups", delta);
}

// ── GROUPMEMBER insert/remove/modify → GROUP/META memberCount ─────────────────

/** Is this membership image an ACTIVE seat? */
function isActiveMember(img: Record<string, unknown> | undefined): boolean {
  return !!img && str(img, "status") === "active";
}

/**
 * `memberCount` counts ACTIVE members only, so it stays in step with the group's
 * join lifecycle (request/invite → pending, then approve → active):
 *   - INSERT active            → +1 (open-join / accepted invite)
 *   - INSERT pending/invited   →  0 (a request or unaccepted invite doesn't count)
 *   - MODIFY pending→active    → +1 (approve), active→removed → -1
 *   - REMOVE active            → -1 (leave / kick), REMOVE pending → 0
 * `ADD` is commutative (converges on replay); the reconcile sweep recomputes the
 * ground truth from the active MEMBER# rows.
 */
async function onMember(record: StreamRecord): Promise<void> {
  const wasActive =
    record.eventName === "MODIFY" || record.eventName === "REMOVE"
      ? isActiveMember(record.oldImage)
      : false;
  const isActive =
    record.eventName === "MODIFY" || record.eventName === "INSERT"
      ? isActiveMember(record.newImage)
      : false;
  const delta = (isActive ? 1 : 0) - (wasActive ? 1 : 0);
  if (delta === 0) return;

  const img = currentImage(record);
  if (!img) return;
  const pk = str(img, "pk");
  const groupId = pk ? stripPrefix(pk, "GROUP#") : undefined;
  if (!groupId) return;
  await updateItem({
    key: groupKeys.meta(groupId),
    update: "ADD memberCount :d",
    values: { ":d": delta },
  });
}

// ── GROUPCOURTREF insert/remove/modify → COURT/META groupCount (PUBLIC only) ──

/** Is this COURT→GROUP pointer image a PUBLIC one? */
function isPublicPointer(img: Record<string, unknown> | undefined): boolean {
  return !!img && str(img, "visibility") === "public";
}

/**
 * A COURT→GROUP pointer landing/leaving bumps the court's denormalized `groupCount`
 * — but ONLY public pointers count, so private/unlisted groups never inflate the
 * "groups that play here" number on a court page (§9.5 note). A visibility toggle
 * (MODIFY) applies the public↔non-public edge delta.
 */
async function onGroupCourtRef(record: StreamRecord): Promise<void> {
  const wasPublic =
    record.eventName === "MODIFY" || record.eventName === "REMOVE"
      ? isPublicPointer(record.oldImage)
      : false;
  const isPublic =
    record.eventName === "MODIFY" || record.eventName === "INSERT"
      ? isPublicPointer(record.newImage)
      : false;
  const delta = (isPublic ? 1 : 0) - (wasPublic ? 1 : 0);
  if (delta === 0) return;

  const img = currentImage(record);
  if (!img) return;
  const pk = str(img, "pk");
  const courtId = pk ? stripPrefix(pk, "COURT#") : undefined;
  if (!courtId) return;
  await updateItem({
    key: courtKeys.meta(courtId),
    update: "ADD groupCount :d",
    values: { ":d": delta },
  });
}

// ── MATCH score write → materialize standings (STUB) ─────────────────────────

/**
 * STUB hook (§9.4 STANDING row). The real standings/tiebreak materialization —
 * RR (§6.8 tiebreak ladder), LEAGUE and TOURNEY — lands in Stage 5/6/7; this is a
 * documented no-op so the dispatcher can already be wired to it on MATCH writes.
 * Kept idempotent by contract: the eventual impl must RECOMPUTE standings from the
 * event's match items (not incrementally mutate them), so a replayed score write
 * yields the same STANDING rows.
 */
export async function materializeStandings(entityType: StandingsEntityType, id: string): Promise<void> {
  // Intentionally does nothing yet. Params referenced to keep the signature stable.
  void entityType;
  void id;
}

async function onMatch(record: StreamRecord): Promise<void> {
  const img = currentImage(record);
  if (!img) return;
  const pk = str(img, "pk");
  if (!pk) return;
  const rr = stripPrefix(pk, "RR#");
  const lid = stripPrefix(pk, "LEAGUE#");
  const tid = stripPrefix(pk, "TOURNEY#");
  if (rr) await materializeStandings("RR", rr);
  else if (lid) await materializeStandings("LEAGUE", lid);
  else if (tid) await materializeStandings("TOURNEY", tid);
}

// ── OUTINGREF insert/remove → COURT/META gamesCount (§9.4, Stage 4) ──────────

/**
 * A court→outing pointer (`COURT#<id>` / `OUTING#<startTs>#<outingId>`) landing or
 * leaving bumps the court's denormalized `gamesCount`. Insert-only +1 / remove-only
 * -1 (an `ADD` atomic counter, healed by the reconcile sweep like every counter).
 * The geo `counts.games` rollup is handled separately on the OUTING/META insert.
 */
async function onOutingRef(record: StreamRecord): Promise<void> {
  let delta = 0;
  if (record.eventName === "INSERT") delta = 1;
  else if (record.eventName === "REMOVE") delta = -1;
  else return;
  const img = currentImage(record);
  if (!img) return;
  const pk = str(img, "pk");
  const courtId = pk ? stripPrefix(pk, "COURT#") : undefined;
  if (!courtId) return;
  await updateItem({
    key: courtKeys.meta(courtId),
    update: "ADD gamesCount :d",
    values: { ":d": delta },
  });
}

// ── dispatcher ───────────────────────────────────────────────────────────────

/**
 * Route a single normalized stream record to the right §9.4 aggregate handler.
 * Unhandled items (pointers, GSI-only rows, aggregate targets themselves) are
 * silently ignored — that's what keeps the aggregator's own writes from looping.
 */
export async function applyStreamRecord(record: StreamRecord): Promise<void> {
  const img = currentImage(record);
  if (!img) return;
  const pk = str(img, "pk");
  const sk = str(img, "sk");
  if (pk === undefined || sk === undefined) return;

  if (pk.startsWith("COURT#")) {
    if (sk === "META") await onCreateGeoCount(record, "courts", "cityKey");
    else if (sk.startsWith("REVIEW#")) await onReview(record);
    else if (sk.startsWith("CHECKIN#")) await onCheckin(record);
    else if (sk.startsWith("OUTING#")) await onOutingRef(record);
    else if (sk.startsWith("GROUP#")) await onGroupCourtRef(record);
    return;
  }

  if (pk.startsWith("USER#")) {
    if (sk === "PROFILE") await onCreateGeoCount(record, "players", "homeCityKey");
    return;
  }

  if (pk.startsWith("GROUP#")) {
    if (sk === "META") await onGroupMeta(record);
    else if (sk.startsWith("MEMBER#")) await onMember(record);
    return;
  }

  if (pk.startsWith("OUTING#")) {
    if (sk === "META") await onCreateGeoCount(record, "games", "cityKey");
    return;
  }

  if (pk.startsWith("TOURNEY#")) {
    // REG# rows are NOT handled here: `registeredCount` is owned end-to-end by the
    // data layer's claim/release (the up-front capacity reservation), so a Stream
    // increment on pending→paid would double-count in prod (invisible to the inline
    // dev stream, which only fires on emitted writes). `spotsLeft` is derived at read.
    if (sk.startsWith("BRACKET#")) await onMatch(record);
    return;
  }

  if (pk.startsWith("LEAGUE#")) {
    // REG# rows: see the TOURNEY# note — `registeredCount` is data-layer-owned.
    if (sk.startsWith("WEEK#") && sk.includes("MATCH")) await onMatch(record);
    return;
  }

  if (pk.startsWith("RR#")) {
    if (sk.startsWith("ROUND#") && sk.includes("MATCH#")) await onMatch(record);
    return;
  }
}
