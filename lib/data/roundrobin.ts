/**
 * roundrobin.ts — the Round-Robin free-tool data layer (PRD §6.8, Stage 5,
 * §9.5 access pattern 16).
 *
 * A NO-LOGIN tool. Create + score work ANONYMOUSLY, gated by a secret
 * `creatorToken` (N2) the browser persists locally; claiming later links the
 * event to a signed-in user. Every event is a single partition `RR#<eventId>`
 * so the full read (event + entrants + rounds + matches + standings) is ONE
 * Query (pattern 16).
 *
 * ── Persistence model ────────────────────────────────────────────────────────
 * The engine (`@/lib/roundrobin`) is PURE + SEEDED: the static schedule is
 * f(config incl. rngSeed) and dynamic rounds are f(seed + confirmed scores). We
 * therefore snapshot the whole `RrConfig` on the META item so recordScore /
 * advanceRound can re-run the engine deterministically.
 *
 * ── Non-atomic create (best-effort) ──────────────────────────────────────────
 * A large event (many entrants × rounds × matches) blows past the DynamoDB
 * 25-item BatchWrite chunk and the 100-item TransactWriteItems limit, and an RR
 * create is NON-FINANCIAL, so we persist with a chunked, best-effort `batchWrite`
 * rather than one atomic transaction. A partial create simply fails the request
 * and the creator retries with a fresh event id (nothing is charged, nothing is
 * shared yet).
 *
 * ── Synchronous standings materialization ────────────────────────────────────
 * In production a MATCH score write flows through DynamoDB Streams →
 * `materializeStandings` (§9.4). Here recordScore RECOMPUTES standings inline
 * (also what STREAMS_INLINE would do): rebuild the rounds from the DB, run
 * `computeStandings` + `champion`, and overwrite the STANDING# rows. Recompute
 * (not incremental mutation) keeps a replayed score idempotent.
 */

import { ulid } from "ulid";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import {
  getItem,
  query,
  putItem,
  updateItem,
  deleteItem,
  batchWrite,
} from "@/lib/db/client";
import { GSI } from "@/lib/db/table";
import { rrKeys, userKeys } from "@/lib/db/keys";
import { trackServerEvent } from "@/lib/analytics/server";
import {
  validateConfig,
  generateSchedule,
  nextRound,
  computeStandings,
  champion,
} from "@/lib/roundrobin";
import type {
  CreateRrInput,
  CreateRrResult,
  RrEventFull,
  RrEventMeta,
  RrEventStatus,
  RrRound,
  Match,
  Standing,
  Entrant,
  ScoreInput,
} from "@/lib/roundrobin/types";
import type {
  BaseItem,
  RrEventItem,
  RrEntrantItem,
  RrRoundItem,
  RrMatchItem,
  RrStandingItem,
} from "@/lib/db/types";

// ── errors (route handlers map `.status` → the HTTP response) ─────────────────

/** A domain error carrying the HTTP status the API layer should surface. */
export class RrError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "RrError";
  }
}
const badRequest = (m: string): never => {
  throw new RrError(m, 400);
};
const forbidden = (m: string): never => {
  throw new RrError(m, 403);
};
const notFound = (m: string): never => {
  throw new RrError(m, 404);
};

/** Who is attempting a mutation: the anon creator (token) or a claimed owner (uid). */
export interface RrActor {
  token?: string;
  uid?: string;
}

/** Test/DI hooks so create is deterministic (mirrors createOuting's id/now hooks). */
export interface CreateRrOptions {
  eventId?: string;
  creatorToken?: string;
  now?: number;
}

// ── item builders ─────────────────────────────────────────────────────────────

const asItem = (o: object): Record<string, unknown> => o as unknown as Record<string, unknown>;

function buildMatchItem(eventId: string, m: Match, iso: string): RrMatchItem {
  return {
    ...rrKeys.match(eventId, m.round, m.index),
    entity: "RRMATCH",
    eventId,
    matchId: m.id,
    round: m.round,
    index: m.index,
    ...(m.court !== undefined ? { court: m.court } : {}),
    sideA: m.sideA,
    sideB: m.sideB,
    ...(m.scoreA !== undefined ? { scoreA: m.scoreA } : {}),
    ...(m.scoreB !== undefined ? { scoreB: m.scoreB } : {}),
    ...(m.winnerTo !== undefined ? { winnerTo: m.winnerTo } : {}),
    ...(m.loserTo !== undefined ? { loserTo: m.loserTo } : {}),
    ...(m.label !== undefined ? { label: m.label } : {}),
    status: m.status ?? "pending",
    createdAt: iso,
    updatedAt: iso,
  };
}

function buildRoundItem(eventId: string, r: RrRound, iso: string): RrRoundItem {
  return {
    ...rrKeys.round(eventId, r.round),
    entity: "RRROUND",
    eventId,
    round: r.round,
    byes: r.byes ?? [],
    ...(r.label !== undefined ? { label: r.label } : {}),
    createdAt: iso,
  };
}

function buildStandingItem(eventId: string, s: Standing, iso: string): RrStandingItem {
  return {
    ...rrKeys.standing(eventId, s.rank),
    entity: "RRSTANDING",
    eventId,
    entrantId: s.entrantId,
    rank: s.rank,
    wins: s.wins,
    losses: s.losses,
    ties: s.ties,
    pointsFor: s.pointsFor,
    pointsAgainst: s.pointsAgainst,
    pointDiff: s.pointDiff,
    byes: s.byes,
    played: s.played,
    updatedAt: iso,
  };
}

// ── reconstruction (pattern-16 read helpers) ─────────────────────────────────

function matchFromItem(m: RrMatchItem): Match {
  return {
    id: m.matchId,
    round: m.round,
    index: m.index,
    ...(m.court !== undefined ? { court: m.court } : {}),
    sideA: m.sideA,
    sideB: m.sideB,
    ...(m.scoreA !== undefined ? { scoreA: m.scoreA } : {}),
    ...(m.scoreB !== undefined ? { scoreB: m.scoreB } : {}),
    ...(m.winnerTo !== undefined ? { winnerTo: m.winnerTo } : {}),
    ...(m.loserTo !== undefined ? { loserTo: m.loserTo } : {}),
    ...(m.label !== undefined ? { label: m.label } : {}),
    ...(m.status !== undefined ? { status: m.status } : {}),
  };
}

/** Rebuild the ordered rounds[] (each with its matches[] + byes) from a partition's items. */
function buildRounds(items: BaseItem[]): RrRound[] {
  const byRound = new Map<number, RrRound>();
  for (const i of items) {
    if (i.entity === "RRROUND") {
      const r = i as RrRoundItem;
      const existing = byRound.get(r.round);
      const round: RrRound = existing ?? { round: r.round, matches: [], byes: [] };
      round.byes = r.byes ?? [];
      if (r.label !== undefined) round.label = r.label;
      byRound.set(r.round, round);
    }
  }
  for (const i of items) {
    if (i.entity === "RRMATCH") {
      const m = i as RrMatchItem;
      let round = byRound.get(m.round);
      if (!round) {
        round = { round: m.round, matches: [], byes: [] };
        byRound.set(m.round, round);
      }
      round.matches.push(matchFromItem(m));
    }
  }
  const rounds = [...byRound.values()].sort((a, b) => a.round - b.round);
  for (const r of rounds) r.matches.sort((a, b) => a.index - b.index);
  return rounds;
}

/** Project the fat META item down to the UI-facing RrEventMeta (drops token/config). */
function toMeta(m: RrEventItem): RrEventMeta {
  return {
    eventId: m.eventId,
    title: m.title,
    format: m.format,
    mode: m.mode,
    status: m.status,
    dynamic: m.dynamic,
    rngSeed: m.rngSeed,
    courts: m.courts,
    scoring: m.scoring,
    organizerId: m.organizerId ?? null,
    championId: m.championId ?? null,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

/** Assemble a full pattern-16 read from one partition's items. */
function assembleFull(metaItem: RrEventItem, items: BaseItem[]): RrEventFull {
  const entrants: Entrant[] = items
    .filter((i): i is RrEntrantItem => i.entity === "RRENTRANT")
    .sort((a, b) => a.index - b.index)
    .map((e) => ({
      id: e.entrantId,
      name: e.name,
      ...(e.seed !== undefined ? { seed: e.seed } : {}),
      ...(e.rating !== undefined ? { rating: e.rating } : {}),
    }));

  const standings: Standing[] = items
    .filter((i): i is RrStandingItem => i.entity === "RRSTANDING")
    .sort((a, b) => a.rank - b.rank)
    .map((s) => ({
      entrantId: s.entrantId,
      rank: s.rank,
      wins: s.wins,
      losses: s.losses,
      ties: s.ties,
      pointsFor: s.pointsFor,
      pointsAgainst: s.pointsAgainst,
      pointDiff: s.pointDiff,
      byes: s.byes,
      played: s.played,
    }));

  return { event: toMeta(metaItem), entrants, rounds: buildRounds(items), standings };
}

// ── authorization ─────────────────────────────────────────────────────────────

/** Authorize a mutation: the creator token matches OR the actor is the claimed owner. */
function authorize(meta: RrEventItem, actor: RrActor): void {
  const tokenOk = !!actor.token && actor.token === meta.creatorToken;
  const uidOk = !!actor.uid && !!meta.organizerId && actor.uid === meta.organizerId;
  if (!tokenOk && !uidOk) forbidden("Not authorized to modify this round-robin event");
}

// ── create ──────────────────────────────────────────────────────────────────

/**
 * Create a round-robin event (anonymous). Validates the config via the engine,
 * generates the static schedule + initial (empty) standings, mints a fresh
 * `eventId` + `creatorToken`, and persists META + ENTRANT# + ROUND#/MATCH# +
 * STANDING# with a best-effort chunked write (see module header). Returns the id
 * and token; the caller stores the token locally to score/advance/claim later.
 */
export async function createRrEvent(
  input: CreateRrInput,
  opts: CreateRrOptions = {},
): Promise<CreateRrResult> {
  const validation = validateConfig(input.config);
  if (!validation.ok) {
    badRequest(`Invalid round-robin config: ${validation.errors.join("; ") || "unknown error"}`);
  }

  const schedule = generateSchedule(input.config);
  const now = opts.now ?? Date.now();
  const iso = new Date(now).toISOString();
  const eventId = opts.eventId ?? ulid();
  const creatorToken = opts.creatorToken ?? ulid().toLowerCase();

  const entrants = input.config.entrants;
  const initialStandings = computeStandings(input.config, schedule.rounds);

  const meta: RrEventItem = {
    ...rrKeys.meta(eventId),
    entity: "RREVENT",
    eventId,
    title: input.title,
    format: input.config.format,
    mode: input.config.mode,
    status: "notStarted",
    dynamic: schedule.dynamic,
    rngSeed: input.config.rngSeed,
    courts: input.config.courts,
    scoring: input.config.scoring,
    config: input.config,
    entrantCount: entrants.length,
    creatorToken,
    championId: null,
    createdAt: iso,
    updatedAt: iso,
  };

  const items: Record<string, unknown>[] = [asItem(meta)];

  entrants.forEach((e, i) => {
    const item: RrEntrantItem = {
      ...rrKeys.entrant(eventId, i),
      entity: "RRENTRANT",
      eventId,
      entrantId: e.id,
      index: i,
      name: e.name,
      ...(e.seed !== undefined ? { seed: e.seed } : {}),
      ...(e.rating !== undefined ? { rating: e.rating } : {}),
      createdAt: iso,
    };
    items.push(asItem(item));
  });

  for (const round of schedule.rounds) {
    items.push(asItem(buildRoundItem(eventId, round, iso)));
    for (const m of round.matches) items.push(asItem(buildMatchItem(eventId, m, iso)));
  }

  for (const s of initialStandings) items.push(asItem(buildStandingItem(eventId, s, iso)));

  await batchWrite(items);

  return { eventId, creatorToken };
}

// ── reads ──────────────────────────────────────────────────────────────────

/** META by id (GetItem) — includes the secret token/config (server-only use). */
export async function getRrEventItem(eventId: string): Promise<RrEventItem | undefined> {
  return getItem<RrEventItem>(rrKeys.meta(eventId));
}

/**
 * Pattern 16 — the FULL event (meta + entrants + rounds + matches + standings)
 * in ONE Query on `PK=RR#<eventId>`, reconstructed client-shape. Returns
 * `undefined` if the event doesn't exist.
 */
export async function getRrEvent(eventId: string): Promise<RrEventFull | undefined> {
  const { items } = await query<BaseItem>({ pk: rrKeys.meta(eventId).pk });
  const metaItem = items.find((i) => i.sk === "META") as RrEventItem | undefined;
  if (!metaItem) return undefined;
  return assembleFull(metaItem, items);
}

/** GSI1 — a signed-in user's claimed RR events (for /account). Newest first. */
export async function getMyRrEvents(uid: string): Promise<RrEventMeta[]> {
  const { items } = await query<RrEventItem>({
    index: GSI.byOwner,
    pk: userKeys.profile(uid).pk,
    skBeginsWith: "RR#",
    ascending: false,
  });
  return items.map(toMeta);
}

// ── standings materialization (shared by score + advance) ────────────────────

/**
 * Recompute standings + champion from the current partition items and persist:
 * overwrite the STANDING# rows by rank and stamp META.championId. Recompute (not
 * incremental) so a replayed score write converges to the same rows (§9.4).
 */
async function materialize(
  eventId: string,
  meta: RrEventItem,
  items: BaseItem[],
  iso: string,
): Promise<Standing[]> {
  const rounds = buildRounds(items);
  const standings = computeStandings(meta.config, rounds);
  const championId = champion(meta.config, rounds);

  await Promise.all(standings.map((s) => putItem(asItem(buildStandingItem(eventId, s, iso)))));

  // Drop any stale STANDING# rows whose rank is no longer present (defensive:
  // entrant count is fixed, so ranks 1..n are stable, but never leave orphans).
  const liveRanks = new Set(standings.map((s) => s.rank));
  const stale = items
    .filter((i): i is RrStandingItem => i.entity === "RRSTANDING")
    .filter((s) => !liveRanks.has(s.rank));
  await Promise.all(stale.map((s) => deleteItem(rrKeys.standing(eventId, s.rank))));

  await updateItem({
    key: rrKeys.meta(eventId),
    update: "SET championId = :champ, updatedAt = :u",
    values: { ":champ": championId ?? null, ":u": iso },
  });

  return standings;
}

// ── record a score ────────────────────────────────────────────────────────────

/**
 * Record one match's confirmed score (anonymous, token-gated). Authorizes the
 * actor, writes `scoreA`/`scoreB` + `status="scored"` on the match, flips META
 * status to `running` (or `complete` for a fully-scored STATIC event), then
 * re-materializes standings synchronously (Streams path in prod). Returns the
 * fresh full event.
 */
export async function recordScore(
  eventId: string,
  score: ScoreInput,
  actor: RrActor,
): Promise<RrEventFull> {
  const { items } = await query<BaseItem>({ pk: rrKeys.meta(eventId).pk });
  const metaItem = items.find((i) => i.sk === "META") as RrEventItem | undefined;
  if (!metaItem) notFound(`Round-robin event not found: ${eventId}`);
  const meta = metaItem as RrEventItem;
  authorize(meta, actor);

  if (
    typeof score.scoreA !== "number" ||
    typeof score.scoreB !== "number" ||
    !Number.isFinite(score.scoreA) ||
    !Number.isFinite(score.scoreB) ||
    score.scoreA < 0 ||
    score.scoreB < 0
  ) {
    badRequest("scoreA and scoreB must be non-negative numbers");
  }

  const target = items.find(
    (i): i is RrMatchItem => i.entity === "RRMATCH" && (i as RrMatchItem).matchId === score.matchId,
  );
  if (!target) notFound(`Match not found: ${score.matchId}`);
  const match = target as RrMatchItem;
  // Capture BEFORE the write: a match already "scored" is being CORRECTED, not played
  // for the first time — so match_played must not fire again (§2.1, one per match).
  const wasScored = match.status === "scored";

  const iso = new Date().toISOString();

  // 1. Persist the score on the match (status "scored"). `status` is a reserved word.
  await updateItem({
    key: rrKeys.match(eventId, match.round, match.index),
    update: "SET scoreA = :a, scoreB = :b, #s = :scored, updatedAt = :u",
    names: { "#s": "status" },
    values: { ":a": score.scoreA, ":b": score.scoreB, ":scored": "scored", ":u": iso },
  });
  // Reflect the write in our in-memory items so the recompute sees the new score.
  match.scoreA = score.scoreA;
  match.scoreB = score.scoreB;
  match.status = "scored";

  // 2. Advance META status. A static event that is now fully scored is complete;
  //    otherwise it's running. Dynamic events complete via advanceRound.
  const matchItems = items.filter((i): i is RrMatchItem => i.entity === "RRMATCH");
  const allScored = matchItems.every(
    (m) => m.status === "scored" || (m.scoreA !== undefined && m.scoreB !== undefined),
  );
  const nextStatus: RrEventStatus = !meta.dynamic && allScored ? "complete" : "running";
  await updateItem({
    key: rrKeys.meta(eventId),
    update: "SET #st = :s, updatedAt = :u",
    names: { "#st": "status" },
    values: { ":s": nextStatus, ":u": iso },
  });
  meta.status = nextStatus;

  // 3. Re-materialize standings synchronously (championId is stamped here too).
  await materialize(eventId, meta, items, iso);

  // ⚙ match_played (§2.1) — a confirmed round-robin score, ONCE per match (skip a
  // re-score correction). Anonymous events attribute via the creator token (§2.1 N2);
  // a claimed event also carries its owner's uid as the distinctId.
  if (!wasScored) {
    trackServerEvent(actor.uid ?? "anonymous", "match_played", {
      kind: "roundRobin",
      eventId,
      matchId: score.matchId,
      format: meta.format,
      ...(meta.creatorToken ? { rrCreatorToken: meta.creatorToken } : {}),
    });
  }

  const full = await getRrEvent(eventId);
  if (!full) notFound(`Round-robin event not found: ${eventId}`);
  return full as RrEventFull;
}

// ── advance a dynamic round ──────────────────────────────────────────────────

/**
 * Advance a DYNAMIC event to its next round (token-gated). Rebuilds the rounds
 * played so far, calls the pure `nextRound(config, completed)`, and either
 * persists the returned ROUND#/MATCH# rows (→ status `running`) or, when the
 * engine returns `null`, marks the event `complete`. Returns the new round or
 * `null`. Rejects on static events (nothing to advance).
 */
export async function advanceRound(eventId: string, actor: RrActor): Promise<RrRound | null> {
  const { items } = await query<BaseItem>({ pk: rrKeys.meta(eventId).pk });
  const metaItem = items.find((i) => i.sk === "META") as RrEventItem | undefined;
  if (!metaItem) notFound(`Round-robin event not found: ${eventId}`);
  const meta = metaItem as RrEventItem;
  authorize(meta, actor);
  if (!meta.dynamic) badRequest("This event's schedule is static — there is nothing to advance");

  const completed = buildRounds(items);
  const next = nextRound(meta.config, completed);
  const iso = new Date().toISOString();

  if (!next) {
    await updateItem({
      key: rrKeys.meta(eventId),
      update: "SET #st = :complete, championId = :champ, updatedAt = :u",
      names: { "#st": "status" },
      values: {
        ":complete": "complete",
        ":champ": champion(meta.config, completed) ?? null,
        ":u": iso,
      },
    });
    return null;
  }

  const toWrite: Record<string, unknown>[] = [asItem(buildRoundItem(eventId, next, iso))];
  for (const m of next.matches) toWrite.push(asItem(buildMatchItem(eventId, m, iso)));
  await batchWrite(toWrite);

  await updateItem({
    key: rrKeys.meta(eventId),
    update: "SET #st = :running, updatedAt = :u",
    names: { "#st": "status" },
    values: { ":running": "running", ":u": iso },
  });

  return next;
}

// ── claim (link an anonymous event to a signed-in user) ──────────────────────

/**
 * Claim an anonymous event for a signed-in user. Requires the holder to present
 * the matching `creatorToken`; sets `organizerId` + the GSI1 (byOrganizer) keys
 * so it appears in the user's /account list. Idempotent when re-claimed by the
 * same uid; rejects a mismatched token (403) or an event already owned by
 * someone else (403). A conditional write guards the claim race.
 */
export async function claimRrEvent(
  eventId: string,
  uid: string,
  token: string,
): Promise<RrEventMeta | undefined> {
  const metaItem = await getRrEventItem(eventId);
  if (!metaItem) return undefined;
  if (metaItem.creatorToken !== token) forbidden("Invalid creator token");
  if (metaItem.organizerId) {
    if (metaItem.organizerId === uid) return toMeta(metaItem); // idempotent re-claim
    forbidden("This event has already been claimed");
  }

  const iso = new Date().toISOString();
  const g1 = rrKeys.byOrganizer(uid, metaItem.createdAt);
  try {
    const attrs = await updateItem({
      key: rrKeys.meta(eventId),
      update: "SET organizerId = :uid, gsi1pk = :g1pk, gsi1sk = :g1sk, updatedAt = :u",
      condition: "attribute_exists(pk) AND attribute_not_exists(organizerId)",
      values: { ":uid": uid, ":g1pk": g1.gsi1pk, ":g1sk": g1.gsi1sk, ":u": iso },
    });
    return attrs ? toMeta(attrs as unknown as RrEventItem) : undefined;
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      // Lost the claim race — return the current owner's view if it's us, else 403.
      const fresh = await getRrEventItem(eventId);
      if (fresh?.organizerId === uid) return toMeta(fresh);
      forbidden("This event has already been claimed");
    }
    throw err;
  }
}
