/**
 * leagues.ts — the Leagues data layer (PRD §7.2–7.3, §10, §9.5 patterns 20/21).
 *
 * Leagues are recurring PAID play: members buy a season, get a weekly round-robin
 * schedule, and settle each fixture with a TWO-PARTY score confirmation. This
 * layer MIRRORS the Stage-6 tournament spine ({@link lib/data/tournaments}) —
 * exact money via {@link computeFees}, a CONNECT-gated publish, a conditional
 * atomic-counter capacity claim (never oversell), destination-charge Checkout, and
 * a webhook-driven ledger reconciliation (REG.paid ↔ one Payment) — and adds the
 * league-specific bits: weekly schedule generation, materialized standings, and
 * the §7.3 report → confirm handshake.
 *
 * ── One partition per league (pattern 21) ────────────────────────────────────
 * Everything lives under `LEAGUE#<lid>` (META, DIVISION#, TEAM#, REG#, WEEK#…,
 * STANDING#…, AVAIL#…), so {@link getLeague} resolves the whole detail in ONE
 * Query. The city finder (pattern 20, GSI2) + slug resolver (GSI3) keys are
 * projected on publish, so a draft never leaks into public reads.
 */

import { ulid } from "ulid";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { getItem, query, queryAll, putItem, putConditional, updateItem, deleteItem, batchGet } from "@/lib/db/client";
import { GSI } from "@/lib/db/table";
import { leagueKeys, userKeys } from "@/lib/db/keys";
import { slugify } from "@/lib/util/slug";
import { publicEnv } from "@/lib/env";
import { computeFees, money, type Money, type FeeConfig, type FeeMode } from "@/lib/money";
import { getGateway } from "@/lib/stripe";
import { getConnectAccount } from "@/lib/data/connect";
import { writePayment, refundPayment, getMyPayments } from "@/lib/data/payments";
import { earnLeagueRegistration, earnLeagueMatch } from "@/lib/data/gamify-earn";
import { trackServerEvent } from "@/lib/analytics/server";
import { createNotification } from "@/lib/data/notifications";
import { buildWeeklySchedule, computeLeagueStandings } from "@/lib/leagues/schedule";
import type {
  LeagueItem,
  LeagueDivisionItem,
  LeagueTeamItem,
  LeagueRegistrationItem,
  ScheduleMatchItem,
  LeagueStandingItem,
  AvailabilityItem,
  PaymentItem,
  StoredMoney,
  LeagueStatus,
  MatchConfirmStatus,
  PartnerStatus,
  AvailabilityStatus,
} from "@/lib/db/types";

// ── domain error (route handlers map `.status` → HTTP) ────────────────────────

/** A domain error carrying the HTTP status the API layer should surface. */
export class LeagueError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "LeagueError";
  }
}
const badRequest = (m: string): never => {
  throw new LeagueError(m, 400);
};
const forbidden = (m: string): never => {
  throw new LeagueError(m, 403);
};
const notFound = (m: string): never => {
  throw new LeagueError(m, 404);
};
const conflict = (m: string): never => {
  throw new LeagueError(m, 409);
};

// ── money helpers ──────────────────────────────────────────────────────────────

const asItem = (o: object): Record<string, unknown> => o as unknown as Record<string, unknown>;

function toStored(m: Money): StoredMoney {
  return { amount: m.amount, currency: m.currency };
}
function fromStored(s: StoredMoney): Money {
  return money(s.amount, s.currency);
}
/** The platform {@link FeeConfig} applied to every division of a league (§10). */
function feeConfigOf(l: Pick<LeagueItem, "feeMode" | "feePercentBps" | "feeFixed">): FeeConfig {
  return { mode: l.feeMode, percentBps: l.feePercentBps, fixed: l.feeFixed };
}

const PAID_STATES = new Set(["paid", "partiallyRefunded"]);
const ACTIVE_REG = new Set(["pending", "paid", "partnerPending"]);
type PlayMode = "singles" | "doubles" | "team";

// ── create / divisions ──────────────────────────────────────────────────────────

export interface CreateLeagueInput {
  organizerId: string;
  title: string;
  cityKey: string;
  startDate: string; // yyyy-mm-dd
  endDate?: string;
  seasonWeeks?: number; // number of weekly rounds (default 6)
  courtId?: string;
  venueName?: string;
  description?: string;
  currency?: string; // default "usd"
  feeMode?: FeeMode;
  feePercentBps?: number;
  feeFixed?: number;
  playMode?: PlayMode; // default "singles"
  // DI hooks for deterministic tests.
  lid?: string;
  slug?: string;
  now?: number;
}

/**
 * Create a DRAFT league (§7.2). Only the organizer GSI1 is projected up-front —
 * the city finder (GSI2) + slug resolver (GSI3) are projected on `publish`, so a
 * draft never leaks into public reads. Fee config defaults to absorb/0/0.
 */
export async function createLeague(input: CreateLeagueInput): Promise<LeagueItem> {
  const now = input.now ?? Date.now();
  const iso = new Date(now).toISOString();
  const lid = input.lid ?? ulid();
  const currency = (input.currency ?? "usd").toLowerCase();
  const slug = input.slug ?? `${slugify(input.title)}-${lid.slice(-6).toLowerCase()}`;

  const league: LeagueItem = {
    ...leagueKeys.meta(lid),
    ...leagueKeys.byOrganizer(input.organizerId, input.startDate),
    entity: "LEAGUE",
    lid,
    title: input.title,
    slug,
    cityKey: input.cityKey,
    ...(input.courtId !== undefined ? { courtId: input.courtId } : {}),
    ...(input.venueName !== undefined ? { venueName: input.venueName } : {}),
    organizerId: input.organizerId,
    status: "draft",
    startDate: input.startDate,
    ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
    seasonWeeks: input.seasonWeeks ?? 6,
    ...(input.description !== undefined ? { description: input.description } : {}),
    currency,
    feeMode: input.feeMode ?? "absorb",
    feePercentBps: input.feePercentBps ?? 0,
    feeFixed: input.feeFixed ?? 0,
    connectedAccountId: null,
    playMode: input.playMode ?? "singles",
    createdAt: iso,
    updatedAt: iso,
  };

  await putItem(asItem(league));
  return league;
}

export interface AddLeagueDivisionInput {
  name: string;
  price: Money | StoredMoney;
  capacity?: number;
  skillMin?: number;
  skillMax?: number;
  duprMin?: number;
  duprMax?: number;
  playMode: PlayMode;
  did?: string;
  now?: number;
}

/** Add a division / flight to a league (price stored as {@link StoredMoney}, count 0). */
export async function addLeagueDivision(
  lid: string,
  division: AddLeagueDivisionInput,
): Promise<LeagueDivisionItem> {
  const league = await getLeagueMeta(lid);
  if (!league) notFound(`League not found: ${lid}`);
  const now = division.now ?? Date.now();
  const iso = new Date(now).toISOString();
  const did = division.did ?? ulid();
  const price = toStored(
    "amount" in division.price
      ? money(division.price.amount, division.price.currency)
      : division.price,
  );

  const item: LeagueDivisionItem = {
    ...leagueKeys.division(lid, did),
    entity: "LEAGUEDIVISION",
    lid,
    did,
    name: division.name,
    price,
    ...(division.capacity !== undefined ? { capacity: division.capacity } : {}),
    ...(division.skillMin !== undefined ? { skillMin: division.skillMin } : {}),
    ...(division.skillMax !== undefined ? { skillMax: division.skillMax } : {}),
    ...(division.duprMin !== undefined ? { duprMin: division.duprMin } : {}),
    ...(division.duprMax !== undefined ? { duprMax: division.duprMax } : {}),
    playMode: division.playMode,
    registeredCount: 0,
    createdAt: iso,
    updatedAt: iso,
  };
  await putItem(asItem(item));
  return item;
}

// ── publish (CONNECT-GATED, §10) ────────────────────────────────────────────────

/**
 * Publish a league. **Connect-gated**: throws unless the organizer's Stripe
 * Connect account is `complete` AND the league has ≥1 division. Stamps
 * `connectedAccountId` (the funds destination) and projects the city-finder (GSI2)
 * + slug (GSI3) keys so it becomes publicly discoverable (pattern 20).
 */
export async function publishLeague(lid: string): Promise<LeagueItem> {
  const league = await getLeagueMeta(lid);
  if (!league) notFound(`League not found: ${lid}`);

  const divisions = await query<LeagueDivisionItem>({
    pk: leagueKeys.meta(lid).pk,
    skBeginsWith: "DIVISION#",
  });
  if (divisions.items.length === 0) {
    badRequest("A league needs at least one division before it can be published");
  }

  const account = await getConnectAccount(league!.organizerId);
  if (!account || account.status !== "complete") {
    forbidden("Connect onboarding must be complete before you can publish (and be paid)");
  }

  const iso = new Date().toISOString();
  const g2 = leagueKeys.inCity(lid, league!.cityKey, league!.startDate);
  const g3 = leagueKeys.bySlug(league!.slug);
  const attrs = await updateItem({
    key: leagueKeys.meta(lid),
    update:
      "SET #st = :pub, connectedAccountId = :acct, gsi2pk = :g2pk, gsi2sk = :g2sk, gsi3pk = :g3pk, gsi3sk = :g3sk, updatedAt = :u",
    names: { "#st": "status" },
    values: {
      ":pub": "published" satisfies LeagueStatus,
      ":acct": account!.accountId,
      ":g2pk": g2.gsi2pk,
      ":g2sk": g2.gsi2sk,
      ":g3pk": g3.gsi3pk,
      ":g3sk": g3.gsi3sk,
      ":u": iso,
    },
  });
  return attrs as unknown as LeagueItem;
}

// ── reads (patterns 20 / 21) ─────────────────────────────────────────────────────

/** META by id (GetItem). */
export async function getLeagueMeta(lid: string): Promise<LeagueItem | undefined> {
  return getItem<LeagueItem>(leagueKeys.meta(lid));
}

/** A single division (GetItem). */
export async function getLeagueDivision(
  lid: string,
  did: string,
): Promise<LeagueDivisionItem | undefined> {
  return getItem<LeagueDivisionItem>(leagueKeys.division(lid, did));
}

/** Pattern 21 result — the whole league from ONE partition Query. */
export interface LeagueDetail {
  league: LeagueItem;
  divisions: LeagueDivisionItem[];
  teams: LeagueTeamItem[];
  registrations: LeagueRegistrationItem[];
  /** Weekly fixtures (SK-ordered: WEEK#<w>#MATCH#…). */
  schedule: ScheduleMatchItem[];
  standings: LeagueStandingItem[];
  availability: AvailabilityItem[];
}

type LeagueRow =
  | LeagueItem
  | LeagueDivisionItem
  | LeagueTeamItem
  | LeagueRegistrationItem
  | ScheduleMatchItem
  | LeagueStandingItem
  | AvailabilityItem;

/**
 * Pattern 21 — a league + divisions + teams + registrations + schedule + standings
 * (+ availability) in ONE Query on `PK=LEAGUE#<lid>`. Returns `undefined` if the
 * league doesn't exist.
 */
export async function getLeague(lid: string): Promise<LeagueDetail | undefined> {
  // queryAll: this partition (META + divisions + teams + ALL registrations + schedule +
  // standings) feeds the cancel/mass-refund loop and schedule/standings materialization
  // — a page dropped at 1 MB would strand refunds and seed fixtures from a partial roster.
  const items = await queryAll<LeagueRow>({ pk: leagueKeys.meta(lid).pk });
  const league = items.find((i) => i.sk === "META") as LeagueItem | undefined;
  if (!league) return undefined;
  const divisions = items.filter((i): i is LeagueDivisionItem => i.entity === "LEAGUEDIVISION");
  const teams = items.filter((i): i is LeagueTeamItem => i.entity === "LEAGUETEAM");
  const registrations = items.filter((i): i is LeagueRegistrationItem => i.entity === "LEAGUEREG");
  const schedule = items.filter((i): i is ScheduleMatchItem => i.entity === "SCHEDULEMATCH");
  const standings = items.filter((i): i is LeagueStandingItem => i.entity === "LEAGUESTANDING");
  const availability = items.filter((i): i is AvailabilityItem => i.entity === "AVAILABILITY");
  divisions.sort((a, b) => a.did.localeCompare(b.did));
  schedule.sort((a, b) => a.sk.localeCompare(b.sk));
  standings.sort((a, b) => a.sk.localeCompare(b.sk));
  return { league, divisions, teams, registrations, schedule, standings, availability };
}

/** Resolve a published league's META by URL slug (GSI3). */
export async function getLeagueBySlug(slug: string): Promise<LeagueItem | undefined> {
  const { gsi3pk } = leagueKeys.bySlug(slug);
  const { items } = await query<LeagueItem>({
    index: GSI.bySlug,
    pk: gsi3pk,
    skEquals: "META",
    limit: 1,
  });
  return items[0];
}

/**
 * Pattern 20 — published leagues in a city (GSI2), soonest first. Only published
 * leagues carry the GSI2 keys, so drafts never appear (a status filter is
 * belt-and-braces).
 */
export async function getLeaguesInCity(cityKey: string): Promise<LeagueItem[]> {
  const { items } = await query<LeagueItem>({
    index: GSI.byLocation,
    pk: leagueKeys.cityPk(cityKey),
    ascending: true, // gsi2sk = `<startDate>#<lid>` → chronological
  });
  return items.filter((l) => l.status === "published");
}

/** The organizer's leagues (GSI1), newest first — includes drafts. */
export async function getLeaguesByOrganizer(organizerId: string): Promise<LeagueItem[]> {
  const { items } = await query<LeagueItem>({
    index: GSI.byOwner,
    pk: userKeys.profile(organizerId).pk,
    skBeginsWith: "LEAGUE#",
    ascending: false,
  });
  return items;
}

/** Pattern 20-adjacent result — a registration hydrated with its league. */
export interface MyLeagueRegistration {
  registration: LeagueRegistrationItem;
  league?: LeagueItem;
}

/**
 * The caller's league registrations (GSI1 `REG#LEAGUE#`), newest first, hydrated
 * with their league META via a single BatchGet (a BatchGet is not a scan).
 */
export async function getMyLeagueRegistrations(uid: string): Promise<MyLeagueRegistration[]> {
  const { items } = await query<LeagueRegistrationItem>({
    index: GSI.byOwner,
    pk: userKeys.profile(uid).pk,
    skBeginsWith: "REG#LEAGUE#",
    ascending: false,
  });
  if (items.length === 0) return [];
  const metas = await batchGet<LeagueItem>(
    [...new Set(items.map((r) => r.lid))].map((lid) => leagueKeys.meta(lid)),
  );
  const byId = new Map(metas.map((m) => [m.lid, m]));
  return items.map((registration) => ({ registration, league: byId.get(registration.lid) }));
}

// ── teams ──────────────────────────────────────────────────────────────────────

/** A registered team / partnership (SK `TEAM#<teamId>`). */
export async function addLeagueTeam(
  lid: string,
  did: string,
  input: { name: string; memberUids: string[]; teamId?: string; now?: number },
): Promise<LeagueTeamItem> {
  const iso = new Date(input.now ?? Date.now()).toISOString();
  const teamId = input.teamId ?? ulid();
  const item: LeagueTeamItem = {
    ...leagueKeys.team(lid, teamId),
    entity: "LEAGUETEAM",
    lid,
    teamId,
    did,
    name: input.name,
    memberUids: input.memberUids,
    createdAt: iso,
    updatedAt: iso,
  };
  await putItem(asItem(item));
  return item;
}

async function getLeagueTeams(lid: string): Promise<LeagueTeamItem[]> {
  const { items } = await query<LeagueTeamItem>({
    pk: leagueKeys.meta(lid).pk,
    skBeginsWith: "TEAM#",
  });
  return items;
}

// ── capacity concurrency (claim / release a division spot) ──────────────────────

/**
 * Try to atomically claim one of `capacity` spots. Returns `true` on success. The
 * CONDITIONAL update is the oversell gate: only one racing writer can move
 * `registeredCount` from `capacity-1` to `capacity`; the rest fail the condition.
 * Unlimited capacity (undefined) always succeeds.
 */
async function claimDivisionSpot(lid: string, did: string, capacity?: number): Promise<boolean> {
  if (capacity === undefined || capacity === null) {
    await updateItem({
      key: leagueKeys.division(lid, did),
      update: "ADD registeredCount :one SET updatedAt = :u",
      values: { ":one": 1, ":u": new Date().toISOString() },
    });
    return true;
  }
  try {
    await updateItem({
      key: leagueKeys.division(lid, did),
      update: "ADD registeredCount :one SET updatedAt = :u",
      condition: "registeredCount < :cap",
      values: { ":one": 1, ":cap": capacity, ":u": new Date().toISOString() },
    });
    return true;
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) return false;
    throw err;
  }
}

/** Release a previously-claimed spot (rollback / cancel / refund). */
async function releaseDivisionSpot(lid: string, did: string): Promise<void> {
  await updateItem({
    key: leagueKeys.division(lid, did),
    update: "ADD registeredCount :neg SET updatedAt = :u",
    condition: "registeredCount > :zero",
    values: { ":neg": -1, ":zero": 0, ":u": new Date().toISOString() },
  }).catch((err) => {
    if (err instanceof ConditionalCheckFailedException) return;
    throw err;
  });
}

/**
 * Atomically flip a registration's `paymentStatus` from `from` → `to`, reporting
 * whether THIS caller performed the transition. The `paymentStatus = :from` condition
 * is the concurrency gate for freeing a division spot (M8): the pending-cancel branch,
 * the organizer API refund, and the `charge.refunded` webhook all read the reg's status
 * non-atomically before releasing — under a concurrent refund/cancel (or an API refund
 * racing the webhook) they'd each read the same non-terminal status and each release,
 * dropping `registeredCount` by 2 for a single claim (→ later oversell). Releasing ONLY
 * when this transition wins guarantees exactly one release. Returns false (never throws)
 * when another writer already moved the reg off `from`.
 */
async function transitionRegStatus(
  key: { pk: string; sk: string },
  from: string,
  to: string,
  extra?: { refundedAmount?: StoredMoney },
): Promise<boolean> {
  const values: Record<string, unknown> = {
    ":to": to,
    ":from": from,
    ":u": new Date().toISOString(),
  };
  let update = "SET paymentStatus = :to, updatedAt = :u";
  if (extra?.refundedAmount) {
    update = "SET paymentStatus = :to, refundedAmount = :r, updatedAt = :u";
    values[":r"] = extra.refundedAmount;
  }
  try {
    await updateItem({ key, update, condition: "paymentStatus = :from", values });
    return true;
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) return false;
    throw err;
  }
}

// ── register (capacity race + Checkout + free-agent / partner-pending) ───────────

/** Enforce a division's DUPR/skill gate (§7.2 rated flights). */
function assertRatingGate(division: LeagueDivisionItem, dupr?: number, skill?: number): void {
  if (division.duprMin !== undefined || division.duprMax !== undefined) {
    if (dupr === undefined) forbidden("This division requires a DUPR rating to register");
    if (division.duprMin !== undefined && dupr! < division.duprMin) {
      forbidden(`This division requires a DUPR rating of at least ${division.duprMin}`);
    }
    if (division.duprMax !== undefined && dupr! > division.duprMax) {
      forbidden(`This division requires a DUPR rating of at most ${division.duprMax}`);
    }
  }
  if (division.skillMin !== undefined || division.skillMax !== undefined) {
    if (skill === undefined) forbidden("This division requires a skill rating to register");
    if (division.skillMin !== undefined && skill! < division.skillMin) {
      forbidden(`This division requires a skill rating of at least ${division.skillMin}`);
    }
    if (division.skillMax !== undefined && skill! > division.skillMax) {
      forbidden(`This division requires a skill rating of at most ${division.skillMax}`);
    }
  }
}

/**
 * Server-authoritative DUPR for the division gate. Reads the registrant's STORED
 * DUPR — NEVER a client-supplied value — so the eligibility gate can't be bypassed by
 * POSTing a forged `dupr` in the register body. Requires `verified:true`: a self-
 * entered (verified:false) DUPR from the generic ratings route does NOT satisfy a
 * DUPR flight. (The DUPR-connect route that mints verified ratings is a separately
 * tracked stub; once it's a real OAuth pull this gate becomes fully authoritative.)
 */
async function resolveDupr(uid: string): Promise<number | undefined> {
  const rating = await getItem<{ value?: number; verified?: boolean }>(
    userKeys.rating(uid, "DUPR"),
  );
  return rating?.verified ? rating.value : undefined;
}

/** Server-authoritative skill for the division gate: the self-reported SELF rating. */
async function resolveSkill(uid: string): Promise<number | undefined> {
  const rating = await getItem<{ value?: number }>(userKeys.rating(uid, "SELF"));
  return rating?.value;
}

export interface LeagueRegisterOptions {
  /** Team play: the pre-created team the member joins. */
  teamId?: string;
  /** Doubles: the partner (partner-pending until they accept, §7.2). */
  partnerUid?: string;
  /** Solo entrant awaiting a partner from the free-agent pool (§7.2). */
  freeAgent?: boolean;
  customerEmail?: string;
}

export interface LeagueRegisterResult {
  regKey: string;
  registration: LeagueRegistrationItem;
  checkoutUrl: string;
  status: "pending" | "partnerPending";
}

/**
 * Register a member for a league division (§7.2, §10). Validates the DUPR/skill
 * gate, CLAIMS a capacity spot (conditional atomic counter — never oversell),
 * creates a destination-charge Checkout (funds → the organizer's connected
 * account, the platform keeps the `applicationFee`) with correlation metadata
 * `{kind:"league", lid, did, uid}`, and writes a `pending` REG. A doubles reg with
 * a `partnerUid` starts `partnerPending`; a solo entrant may join as a `freeAgent`
 * awaiting a partner. Returns `{ checkoutUrl, regKey }`.
 */
export async function registerForLeague(
  lid: string,
  did: string,
  uid: string,
  opts: LeagueRegisterOptions = {},
): Promise<LeagueRegisterResult> {
  const league = await getLeagueMeta(lid);
  if (!league) notFound(`League not found: ${lid}`);
  if (league!.status !== "published") {
    badRequest("Registration is only open for published leagues");
  }
  if (!league!.connectedAccountId) {
    badRequest("This league is not connected to a payout account");
  }
  const division = await getLeagueDivision(lid, did);
  if (!division) notFound(`Division not found: ${did}`);

  // Idempotency + duplicate guard: an active registration blocks a second one. A
  // member registers once per league (SK `REG#<uid>`).
  const key = leagueKeys.registration(lid, uid, league!.startDate);
  const existing = await getItem<LeagueRegistrationItem>(key);
  if (existing && ACTIVE_REG.has(existing.paymentStatus)) {
    conflict("You are already registered for this league");
  }

  // Rating gate — resolved SERVER-SIDE from stored ratings, never from the request.
  const dupr = await resolveDupr(uid);
  const skill = await resolveSkill(uid);
  assertRatingGate(division!, dupr, skill);

  // Team entries: a supplied `teamId` must be a REAL team IN THIS DIVISION that the caller
  // belongs to. Otherwise an arbitrary/forged teamId would collapse this registration with
  // another into ONE scheduling entrant (entrantId = `teamId ?? uid`, §schedule) — hijacking
  // fixtures / standings (L4).
  if (opts.teamId) {
    const team = await getItem<LeagueTeamItem>(leagueKeys.team(lid, opts.teamId));
    if (!team || team.did !== did) badRequest("Unknown team for this division");
    if (!team!.memberUids.includes(uid)) forbidden("You are not a member of that team");
  }

  // Claim a spot (no oversell). A full division is rejected (409) — leagues have
  // no deferred-capture waitlist; use the free-agent / sub pool instead.
  const claimed = await claimDivisionSpot(lid, did, division!.capacity);
  if (!claimed) conflict("This division is full");

  // Exact fee split on the division price (§10).
  const breakdown = computeFees(fromStored(division!.price), feeConfigOf(league!));
  const regKey = `${did}#${uid}`;

  // FREE league (total $0): a $0 Stripe Checkout session is REJECTED by real Stripe (its
  // ~$0.50 minimum), so a free league would 500 on every join in prod (M24). Skip Checkout
  // when free and fulfill the (non-partner) join immediately below.
  const isFree = breakdown.total.amount <= 0;
  let session;
  if (!isFree) {
    try {
      session = await getGateway().createCheckoutSession({
        connectedAccountId: league!.connectedAccountId!,
        lineItems: [
          { name: `${league!.title} — ${division!.name}`, unitAmount: breakdown.total, quantity: 1 },
        ],
        applicationFee: breakdown.applicationFee,
        currency: league!.currency,
        metadata: { lid, did, uid, regKey, kind: "league" },
        successUrl: `${publicEnv.siteUrl}/leagues/${lid}?reg=${encodeURIComponent(regKey)}&checkout=success`,
        cancelUrl: `${publicEnv.siteUrl}/leagues/${lid}?reg=${encodeURIComponent(regKey)}&checkout=cancel`,
        ...(opts.customerEmail ? { customerEmail: opts.customerEmail } : {}),
        clientReferenceId: regKey,
      });
    } catch (err) {
      if (claimed) await releaseDivisionSpot(lid, did);
      throw err;
    }
  }

  const iso = new Date().toISOString();
  const isDoublesPartner = division!.playMode === "doubles" && !!opts.partnerUid;
  const paymentStatus = isDoublesPartner ? "partnerPending" : "pending";
  const registration: LeagueRegistrationItem = {
    ...key,
    entity: "LEAGUEREG",
    lid,
    uid,
    did,
    startDate: league!.startDate,
    ...(opts.teamId ? { teamId: opts.teamId } : {}),
    ...(opts.freeAgent ? { freeAgent: true } : {}),
    ...(opts.partnerUid
      ? { partnerUid: opts.partnerUid, partnerStatus: "pending" as PartnerStatus }
      : {}),
    paymentStatus,
    ...(session ? { checkoutSessionId: session.id, paymentIntentId: session.paymentIntentId } : {}),
    amount: toStored(breakdown.total),
    applicationFee: toStored(breakdown.applicationFee),
    registeredAt: iso,
    createdAt: existing?.createdAt ?? iso,
    updatedAt: iso,
  };
  // Create-or-overwrite-terminal: a concurrent first-time registration that already
  // wrote an ACTIVE row makes this fail, so we never clobber an in-flight sibling or
  // double-claim the spot (the read-guard above is not atomic on its own).
  try {
    await putConditional(
      asItem(registration),
      "attribute_not_exists(pk) OR NOT (paymentStatus IN (:pending, :paid, :partnerPending))",
      { values: { ":pending": "pending", ":paid": "paid", ":partnerPending": "partnerPending" } },
    );
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      await releaseDivisionSpot(lid, did);
      conflict("You are already registered for this league");
    }
    throw err;
  }

  // FREE, non-partner: fulfill now (confirmLeaguePayment flips pending→paid + writes a $0
  // receipt). Partner-pending free regs stay partnerPending (payment isn't due until the
  // partner accepts). Roll back on failure so the join is retryable.
  if (isFree && !isDoublesPartner) {
    try {
      await confirmLeaguePayment({ lid, did, uid, amountTotal: 0, currency: league!.currency });
    } catch (err) {
      await releaseDivisionSpot(lid, did).catch(() => {});
      await deleteItem(key).catch(() => {});
      throw err;
    }
    return {
      regKey,
      registration: { ...registration, paymentStatus: "paid" },
      checkoutUrl: `${publicEnv.siteUrl}/leagues/${lid}?reg=${encodeURIComponent(regKey)}&checkout=success`,
      status: "pending", // redirect hint only; the reg itself is `paid` above
    };
  }

  const checkoutUrl =
    session?.url ?? `${publicEnv.siteUrl}/leagues/${lid}?reg=${encodeURIComponent(regKey)}&checkout=success`;
  return { regKey, registration, checkoutUrl, status: paymentStatus };
}

// ── webhook fulfilment (idempotent) — the integrator wires these into the route ──

export interface ConfirmLeaguePaymentInput {
  lid: string;
  did: string;
  uid: string;
  paymentIntentId?: string;
  amountTotal?: number; // minor units (cross-check only)
  currency?: string;
  receiptUrl?: string;
}

export interface ConfirmLeaguePaymentResult {
  ok: boolean;
  alreadyPaid?: boolean;
  registration?: LeagueRegistrationItem;
  payment?: PaymentItem;
}

/**
 * Refund a payment that landed on an already-CANCELLED league — a registrant who
 * completed Checkout after `cancelLeague` ran its mass-refund pass (which only refunds
 * PAID_STATES, so an in-flight `pending` reg was skipped). Organizer-initiated ⇒ the
 * platform fee is refunded too (§10). Best-effort: a gateway/DB failure is logged (not
 * thrown) so the webhook still ACKs and Stripe does not retry forever — the paid reg +
 * receipt stand, and an organizer refund can recover it. `refundLeagueRegistration` is
 * a no-op on an already-refunded reg, so this is safe to re-run on a retry.
 */
async function autoRefundCancelledLeagueReg(lid: string, did: string, uid: string): Promise<void> {
  try {
    await refundLeagueRegistration(lid, did, uid, { refundApplicationFee: true });
  } catch (err) {
    console.error(
      `[confirmLeaguePayment] auto-refund into cancelled league ${lid}/${did}/${uid} failed:`,
      err,
    );
  }
}

/**
 * Mark a league registration `paid` and write its durable Payment receipt
 * (`kind: "league"`). Called by the Stripe webhook after signature verify + event
 * de-dupe. Idempotent per REG: the `paymentStatus === paid` guard means sibling
 * events (checkout.session.completed AND payment_intent.succeeded) fulfil at most
 * once → REG.paid ↔ one Payment. The spot was already reserved at registration.
 */
export async function confirmLeaguePayment(
  input: ConfirmLeaguePaymentInput,
): Promise<ConfirmLeaguePaymentResult> {
  const { lid, did, uid } = input;
  const key = leagueKeys.registration(lid, uid, "");
  const reg = await getItem<LeagueRegistrationItem>(key);
  if (!reg) return { ok: false };
  // The league REG is keyed per (lid, uid) — a user has ONE active registration, so
  // a division switch OVERWRITES it. If this completing Checkout session is for a
  // division the user is no longer registered in (they cancelled div-A, re-joined
  // div-B, then a stale div-A tab completed), do NOT confirm it against the current
  // reg — that would flip div-B's pending reg to paid at div-A's captured price.
  if (reg.did !== did) return { ok: false };

  // Was the league cancelled while this registrant was mid-checkout? If so their money
  // is captured into a dead event — confirm the capture below, then AUTO-REFUND it.
  // Re-checked on the `paid` retry branch so a transient refund failure re-attempts.
  const eventCancelled = (await getLeagueMeta(lid))?.status === "cancelled";

  if (reg.paymentStatus === "paid") {
    if (eventCancelled) await autoRefundCancelledLeagueReg(lid, did, uid);
    return { ok: true, alreadyPaid: true, registration: reg };
  }

  const iso = new Date().toISOString();
  // Resolve the real PaymentIntent id and BACKFILL it onto the REG below. With
  // deferred-PI Checkout (Stripe basil+, our pinned api version), the PaymentIntent
  // does not exist at session creation, so registration stored `paymentIntentId: ""`;
  // the webhook is the first place the real PI is known. Use `||` (not `??`) so the
  // stored empty string falls through to the webhook's PI — otherwise every refund
  // path (organizer refund, receipt reconciliation) has no PI to target and 400s.
  const paymentIntentId = reg.paymentIntentId || input.paymentIntentId || "";

  // Flip to paid ATOMICALLY so exactly one delivery fulfils — Stripe's two sibling
  // events (checkout.session.completed + payment_intent.succeeded) can arrive
  // concurrently and a read-then-write guard lets both pass. First writer wins.
  let updated: LeagueRegistrationItem;
  try {
    const attrs = await updateItem({
      key,
      update: "SET paymentStatus = :paid, updatedAt = :u, paymentIntentId = :pi",
      // Flip to paid ONLY from a non-terminal awaiting-payment state. Guarding
      // `<> :paid` would also match the terminal states (cancelled/refunded/
      // partiallyRefunded), so a delayed sibling event (payment_intent.succeeded
      // after an organizer refund) would RESURRECT a refunded reg back to paid,
      // write a duplicate receipt, and re-fire analytics — while holding no spot.
      condition: "paymentStatus IN (:pending, :partnerPending)",
      values: {
        ":paid": "paid",
        ":u": iso,
        ":pi": paymentIntentId,
        ":pending": "pending",
        ":partnerPending": "partnerPending",
      },
    });
    updated =
      (attrs as unknown as LeagueRegistrationItem) ??
      { ...reg, paymentStatus: "paid", paymentIntentId };
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      return { ok: true, alreadyPaid: true, registration: reg };
    }
    throw err;
  }

  const currency = reg.amount?.currency ?? input.currency ?? "usd";
  const amount: StoredMoney = reg.amount ?? { amount: input.amountTotal ?? 0, currency };
  const payment = await writePayment({
    uid,
    kind: "league",
    refId: lid,
    divisionId: did,
    amount,
    ...(reg.applicationFee ? { applicationFee: reg.applicationFee } : {}),
    paymentIntentId,
    status: "paid",
    ...(input.receiptUrl ? { receiptUrl: input.receiptUrl } : {}),
  });

  // Payment landed on a cancelled league: refund it immediately and DON'T fire the
  // confirmation analytics — the entry is not really confirmed (§10). The receipt
  // above records the (now-refunded) capture for the ledger/audit trail.
  if (eventCancelled) {
    await autoRefundCancelledLeagueReg(lid, did, uid);
    return { ok: true, registration: { ...updated, paymentStatus: "refunded" }, payment };
  }

  // ⚙ payment_succeeded + registration_confirmed (§2.1) — emitted once, at the
  // first fulfilment (the `paid` guard above short-circuits replays).
  const analyticsProps = {
    kind: "league" as const,
    refId: lid,
    divisionId: did,
    amount: amount.amount,
    currency: amount.currency,
    paymentIntentId,
  };
  trackServerEvent(uid, "payment_succeeded", analyticsProps);
  trackServerEvent(uid, "registration_confirmed", analyticsProps);

  // E13 — a confirmed league registration earns Rally Points (§G4.2). Failure-isolated;
  // the E13#lid sourceKey dedupes concurrent Stripe sibling events. (E18 consecutive-season
  // bonus is deferred — it needs a prior-season lookup.)
  await earnLeagueRegistration(uid, lid);

  return { ok: true, registration: updated, payment };
}

export interface LeagueRefundWebhookInput {
  lid: string;
  did: string;
  uid: string;
  amountRefunded?: number; // minor units
  currency?: string;
}

/**
 * Reconcile a `charge.refunded` webhook: mark the REG refunded/partially-refunded,
 * update its Payment receipt, and free the division spot on a FULL refund. Amounts
 * are exact minor units.
 */
export async function markLeagueRegRefunded(
  input: LeagueRefundWebhookInput,
): Promise<LeagueRegistrationItem | undefined> {
  const { lid, did, uid } = input;
  const key = leagueKeys.registration(lid, uid, "");
  const reg = await getItem<LeagueRegistrationItem>(key);
  if (!reg) return undefined;

  const charged = reg.amount?.amount ?? 0;
  const currency = reg.amount?.currency ?? input.currency ?? "usd";
  const refunded = input.amountRefunded ?? charged;
  const full = refunded >= charged;
  const refundedMoney: StoredMoney = { amount: refunded, currency };
  const iso = new Date().toISOString();

  // On a FULL refund, flip the reg CONDITIONALLY (M8): the transition wins for exactly
  // one caller, and only that caller frees the spot below — so a concurrent organizer
  // API refund racing this webhook can't both release. Skip a reg that is ALREADY
  // refunded (an idempotent duplicate webhook): a `refunded → refunded` self-transition
  // would pass its own condition and release the spot a second time.
  const flipped = full && reg.paymentStatus !== "refunded"
    ? await transitionRegStatus(key, reg.paymentStatus, "refunded", { refundedAmount: refundedMoney })
    : false;
  if (!full) {
    await updateItem({
      key,
      update: "SET paymentStatus = :s, refundedAmount = :r, updatedAt = :u",
      values: { ":s": "partiallyRefunded", ":r": refundedMoney, ":u": iso },
    });
  }

  if (reg.paymentIntentId) {
    const pay = (await getMyPayments(uid)).find((p) => p.paymentIntentId === reg.paymentIntentId);
    if (pay) {
      await updateItem({
        key: { pk: pay.pk, sk: pay.sk },
        update: "SET #st = :s, refundedAmount = :r",
        names: { "#st": "status" },
        values: {
          ":s": full ? "refunded" : "partiallyRefunded",
          ":r": refundedMoney,
        },
      });
    }
  }

  // Free the spot exactly once — only the caller whose full-refund transition won.
  if (full && flipped) await releaseDivisionSpot(lid, did);
  return { ...reg, paymentStatus: full ? "refunded" : "partiallyRefunded", refundedAmount: refundedMoney, updatedAt: iso };
}

// ── weekly schedule (generate the fixtures from the paid roster) ─────────────────

/** The entrant id used for scheduling a registration: its team id, else its uid. */
function entrantIdOf(reg: LeagueRegistrationItem): string {
  return reg.teamId ?? reg.uid;
}

/**
 * Build the weekly `ScheduleMatchItem` fixtures for every division from its PAID
 * roster (reuses the pure {@link buildWeeklySchedule}). One round-robin round per
 * season week; regenerating overwrites (deterministic per roster). Returns all
 * persisted matches.
 */
export async function generateSchedule(lid: string): Promise<ScheduleMatchItem[]> {
  const detail = await getLeague(lid);
  if (!detail) notFound(`League not found: ${lid}`);
  const { league, divisions, registrations, schedule: existing } = detail!;
  const iso = new Date().toISOString();

  const out: ScheduleMatchItem[] = [];
  for (const division of divisions) {
    const entrants = [
      ...new Set(
        registrations
          .filter((r) => r.did === division.did && PAID_STATES.has(r.paymentStatus))
          .map(entrantIdOf),
      ),
    ];
    if (entrants.length < 2) continue;

    const weeks = buildWeeklySchedule(entrants, league.seasonWeeks, { midPrefix: division.did });
    for (const wk of weeks) {
      for (const fx of wk.fixtures) {
        const item: ScheduleMatchItem = {
          ...leagueKeys.scheduleMatch(lid, wk.week, fx.mid),
          entity: "SCHEDULEMATCH",
          lid,
          did: division.did,
          week: wk.week,
          mid: fx.mid,
          sideA: fx.sideA,
          sideB: fx.sideB,
          confirmStatus: "scheduled",
          createdAt: iso,
          updatedAt: iso,
        };
        out.push(item);
      }
    }
  }
  await Promise.all(out.map((it) => putItem(asItem(it))));

  // Regeneration is a FULL replacement (deterministic per roster). The mid is a
  // POSITIONAL index within a week, not matchup-stable — a roster change re-points every
  // mid at a different pairing (and a shrinking roster drops fixtures entirely, e.g. a
  // week's 3rd match once a 6th entrant leaves). Delete any prior WEEK# rows the new
  // schedule didn't overwrite, else those orphans survive with a stale `confirmed` result
  // and materializeStandings double-counts them (M10). Delete AFTER the writes so a
  // mid-op failure never leaves the schedule missing its real fixtures.
  const planned = new Set(out.map((it) => `${it.week}#${it.mid}`));
  const stale = existing.filter((m) => !planned.has(`${m.week}#${m.mid}`));
  await Promise.all(stale.map((m) => deleteItem(leagueKeys.scheduleMatch(lid, m.week, m.mid))));

  return out;
}

// ── standings (materialize from confirmed fixtures) ──────────────────────────────

/**
 * Recompute + persist the `LeagueStandingItem` rows for every division from its
 * CONFIRMED weekly results (reuses the pure {@link computeLeagueStandings}). Stale
 * rows are cleared first so a shrinking roster leaves no orphan ranks. Returns all
 * persisted standings.
 */
export async function materializeStandings(lid: string): Promise<LeagueStandingItem[]> {
  const detail = await getLeague(lid);
  if (!detail) notFound(`League not found: ${lid}`);
  const { divisions, registrations, schedule, standings: stale } = detail!;

  // Clear existing standing rows (rank set can shrink; overwrite-by-rank would leak).
  await Promise.all(stale.map((s) => deleteItem({ pk: s.pk, sk: s.sk })));

  const out: LeagueStandingItem[] = [];
  for (const division of divisions) {
    const entrants = [
      ...new Set(
        registrations
          .filter((r) => r.did === division.did && PAID_STATES.has(r.paymentStatus))
          .map(entrantIdOf),
      ),
    ];
    if (entrants.length === 0) continue;

    const confirmed = schedule.filter(
      (m) => m.did === division.did && m.confirmStatus === "confirmed",
    );
    const rows = computeLeagueStandings(
      entrants,
      confirmed.map((m) => ({
        sideA: m.sideA ?? [],
        sideB: m.sideB ?? [],
        scoreA: m.scoreA,
        scoreB: m.scoreB,
      })),
    );
    for (const row of rows) {
      const item: LeagueStandingItem = {
        ...leagueKeys.standing(lid, division.did, row.rank),
        entity: "LEAGUESTANDING",
        lid,
        did: division.did,
        entrantId: row.entrantId,
        rank: row.rank,
        wins: row.wins,
        losses: row.losses,
        ties: row.ties,
        pointsFor: row.pointsFor,
        pointsAgainst: row.pointsAgainst,
        pointDiff: row.pointDiff,
        played: row.played,
      };
      out.push(item);
    }
  }
  await Promise.all(out.map((it) => putItem(asItem(it))));
  return out;
}

// ── two-party score handshake (§7.3) ─────────────────────────────────────────────

/** Which side (A/B) an actor is on, resolving team membership → the actor's uid. */
function sideOf(
  match: ScheduleMatchItem,
  entrantIds: Set<string>,
): "A" | "B" | null {
  const onSide = (side?: string[]) => !!side && side.some((id) => entrantIds.has(id));
  if (onSide(match.sideA)) return "A";
  if (onSide(match.sideB)) return "B";
  return null;
}

/** The set of entrant ids an actor represents: their uid + any team they're on. */
function entrantIdsForUid(uid: string, teams: LeagueTeamItem[]): Set<string> {
  const ids = new Set<string>([uid]);
  for (const t of teams) if (t.memberUids.includes(uid)) ids.add(t.teamId);
  return ids;
}

/** Expand a side's entrant ids to the underlying member uids (for notifications). */
function memberUidsOf(side: string[] | undefined, teams: LeagueTeamItem[]): string[] {
  const out = new Set<string>();
  for (const id of side ?? []) {
    const team = teams.find((t) => t.teamId === id);
    if (team) team.memberUids.forEach((u) => out.add(u));
    else out.add(id); // a bare uid entrant (singles)
  }
  return [...out];
}

/**
 * Report a fixture's score (§7.3, party one). The reporter (a participant on
 * either side) sets the score, flips `confirmStatus` → `reported`, and stamps
 * `reportedBy`; a notification is then fanned out to every opponent uid asking
 * them to confirm. Re-reporting resets any prior confirmation.
 */
export async function reportScore(
  lid: string,
  week: number,
  mid: string,
  uid: string,
  scoreA: number,
  scoreB: number,
): Promise<ScheduleMatchItem> {
  const match = await getItem<ScheduleMatchItem>(leagueKeys.scheduleMatch(lid, week, mid));
  if (!match) notFound(`Fixture not found: week ${week} / ${mid}`);
  const teams = await getLeagueTeams(lid);
  const side = sideOf(match!, entrantIdsForUid(uid, teams));
  if (!side) forbidden("Only a participant can report this fixture's score");

  const iso = new Date().toISOString();
  const attrs = await updateItem({
    key: leagueKeys.scheduleMatch(lid, week, mid),
    update:
      "SET scoreA = :a, scoreB = :b, confirmStatus = :s, reportedBy = :by, playedAt = :at, updatedAt = :u REMOVE confirmedBy",
    values: {
      ":a": scoreA,
      ":b": scoreB,
      ":s": "reported" satisfies MatchConfirmStatus,
      ":by": uid,
      ":at": iso,
      ":u": iso,
    },
  });
  const updated = (attrs as unknown as ScheduleMatchItem) ?? match!;

  // Notify the opponent side to confirm (two-party handshake fan-out).
  const opponents = memberUidsOf(side === "A" ? updated.sideB : updated.sideA, teams);
  await Promise.all(
    opponents.map((opp) =>
      createNotification(opp, {
        type: "system",
        title: "Confirm your league match score",
        body: `A score of ${scoreA}-${scoreB} was reported for your week ${week} match. Confirm or dispute it.`,
        entityRef: `/leagues/${lid}`,
      }),
    ),
  );
  return updated;
}

/**
 * Confirm (or dispute) a reported fixture (§7.3, party two). The OTHER party
 * confirms the reported score → `confirmStatus` `confirmed`, then standings are
 * re-materialized. Disputing (`agree: false`) flags a `conflict` instead (a
 * mismatch), leaving standings untouched. The reporter cannot confirm their own
 * report.
 */
export async function confirmScore(
  lid: string,
  week: number,
  mid: string,
  uid: string,
  opts: { agree?: boolean } = {},
): Promise<ScheduleMatchItem> {
  const match = await getItem<ScheduleMatchItem>(leagueKeys.scheduleMatch(lid, week, mid));
  if (!match) notFound(`Fixture not found: week ${week} / ${mid}`);
  if (match!.confirmStatus !== "reported") {
    badRequest("Only a reported fixture can be confirmed");
  }
  const teams = await getLeagueTeams(lid);
  const side = sideOf(match!, entrantIdsForUid(uid, teams));
  if (!side) forbidden("Only a participant can confirm this fixture's score");

  const reporterSide = match!.reportedBy
    ? sideOf(match!, entrantIdsForUid(match!.reportedBy, teams))
    : null;
  if (reporterSide === side) {
    forbidden("The other party must confirm the reported score");
  }

  const iso = new Date().toISOString();
  const disputes = opts.agree === false;
  const next: MatchConfirmStatus = disputes ? "conflict" : "confirmed";

  const attrs = await updateItem({
    key: leagueKeys.scheduleMatch(lid, week, mid),
    update: disputes
      ? "SET confirmStatus = :s, updatedAt = :u"
      : "SET confirmStatus = :s, confirmedBy = :by, updatedAt = :u",
    values: disputes ? { ":s": next, ":u": iso } : { ":s": next, ":by": uid, ":u": iso },
  });
  const updated = (attrs as unknown as ScheduleMatchItem) ?? match!;
  if (!disputes) {
    await materializeStandings(lid);
    // ⚙ match_played (§2.1) — a league fixture is a confirmed match only once the
    // OTHER party confirms the reported score (disputes never count).
    trackServerEvent(uid, "match_played", { kind: "league", lid, week, mid });
    // E14 — both parties of the two-party handshake earn (§G4.2). Failure-isolated;
    // each keys its own ledger row (E14#lid#mid in its partition).
    await Promise.all([
      earnLeagueMatch(uid, lid, mid),
      match!.reportedBy && match!.reportedBy !== uid ? earnLeagueMatch(match!.reportedBy, lid, mid) : undefined,
    ]);
  }
  return updated;
}

// ── availability (sub-pool) ──────────────────────────────────────────────────────

/**
 * Set a member's weekly availability / sub-pool flag (§7.2). Upserts the
 * `AVAIL#<uid>#WEEK#<w>` row.
 */
export async function setAvailability(
  lid: string,
  uid: string,
  week: number,
  status: AvailabilityStatus,
  note?: string,
): Promise<AvailabilityItem> {
  // Only an ACTIVE registrant may set availability — otherwise any signed-in user
  // could spam AVAILABILITY rows into a league they never joined (§7.2).
  const reg = await getItem<LeagueRegistrationItem>(leagueKeys.registration(lid, uid, ""));
  if (!reg || !ACTIVE_REG.has(reg.paymentStatus)) {
    forbidden("Only a registered player can set availability for this league");
  }
  const now = new Date().toISOString();
  const existing = await getItem<AvailabilityItem>(leagueKeys.availability(lid, uid, week));
  const item: AvailabilityItem = {
    ...leagueKeys.availability(lid, uid, week),
    entity: "AVAILABILITY",
    lid,
    uid,
    week,
    status,
    ...(note !== undefined ? { note } : {}),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await putItem(asItem(item));
  return item;
}

// ── refunds / cancel (mass refund) ───────────────────────────────────────────────

/** Locate a registrant's durable Payment receipt (for the refund ledger `ts`). */
async function findRegPayment(
  uid: string,
  lid: string,
  did: string,
  paymentIntentId: string,
): Promise<PaymentItem | undefined> {
  const payments = await getMyPayments(uid);
  return payments.find(
    (p) => p.paymentIntentId === paymentIntentId && p.refId === lid && p.divisionId === did,
  );
}

/**
 * Refund a single league registration and reconcile it. Routes the money through
 * the ledger's {@link refundPayment} (gateway + Payment receipt), then flips the
 * REG to `refunded`/`partiallyRefunded` and frees the spot on a full refund.
 * `refundApplicationFee` chooses the §10 policy: organizer-initiated ⇒ true (fee
 * refunded); registrant-initiated ⇒ false (retained).
 */
export async function refundLeagueRegistration(
  lid: string,
  did: string,
  uid: string,
  opts: { amount?: Money; refundApplicationFee?: boolean } = {},
): Promise<LeagueRegistrationItem | undefined> {
  const key = leagueKeys.registration(lid, uid, "");
  const reg = await getItem<LeagueRegistrationItem>(key);
  if (!reg) return undefined;

  // Nothing captured yet — just cancel + free the spot (no gateway refund needed).
  if (!PAID_STATES.has(reg.paymentStatus)) {
    // Flip to cancelled ONLY if the reg is still in its pre-read status. A concurrent
    // cancel/refund that already transitioned it fails this condition, so exactly one
    // caller reaches the release below (M8 — no double-release of the spot).
    const flipped = await transitionRegStatus(key, reg.paymentStatus, "cancelled");
    // Free the spot only for a reg that still HELD one (pending/partnerPending) AND that
    // THIS call actually transitioned. An already-terminal reg (cancelled/refunded)
    // released it already — releasing again would undercount the division.
    if (flipped && ACTIVE_REG.has(reg.paymentStatus)) await releaseDivisionSpot(lid, did);
    return { ...reg, paymentStatus: "cancelled" };
  }

  if (!reg.paymentIntentId) badRequest("Registration has no captured payment to refund");
  const payment = await findRegPayment(uid, lid, did, reg.paymentIntentId!);
  if (!payment) notFound("Payment receipt not found for this registration");

  const { payment: updatedPayment } = await refundPayment({
    uid,
    ts: payment!.ts,
    ...(opts.amount ? { amount: opts.amount } : {}),
    refundApplicationFee: opts.refundApplicationFee ?? false,
    reason: opts.refundApplicationFee ? "organizer_refund" : "requested_by_customer",
  });

  const full = updatedPayment.status === "refunded";
  const refundedAmount: StoredMoney =
    updatedPayment.refundedAmount ?? reg.amount ?? { amount: 0, currency: "usd" };
  const iso = new Date().toISOString();
  if (full) {
    // Conditionally flip to refunded; release the spot ONLY if this call performed the
    // transition. A concurrent API refund or the charge.refunded webhook that already
    // flipped the reg fails the condition, so the spot is freed exactly once (M8).
    const flipped = await transitionRegStatus(key, reg.paymentStatus, "refunded", { refundedAmount });
    if (flipped) await releaseDivisionSpot(lid, did);
  } else {
    await updateItem({
      key,
      update: "SET paymentStatus = :s, refundedAmount = :r, updatedAt = :u",
      values: { ":s": "partiallyRefunded", ":r": refundedAmount, ":u": iso },
    });
  }
  return { ...reg, paymentStatus: full ? "refunded" : "partiallyRefunded", refundedAmount };
}

/**
 * Registrant-initiated cancel: refund the registrant but RETAIN the platform fee
 * (`refundApplicationFee: false`, §10).
 */
export async function cancelLeagueRegistration(
  lid: string,
  did: string,
  uid: string,
  opts: { amount?: Money } = {},
): Promise<LeagueRegistrationItem | undefined> {
  return refundLeagueRegistration(lid, did, uid, {
    ...(opts.amount ? { amount: opts.amount } : {}),
    refundApplicationFee: false,
  });
}

export interface CancelLeagueResult {
  league: LeagueItem;
  refunded: number;
}

/**
 * Cancel a league + MASS-REFUND every paid registration. Organizer-initiated, so
 * the platform application fee is REFUNDED too (`refundApplicationFee: true`, §10).
 * Each refunded REG is reconciled to `refunded` and its spot freed.
 */
export async function cancelLeague(lid: string): Promise<CancelLeagueResult> {
  const detail = await getLeague(lid);
  if (!detail) notFound(`League not found: ${lid}`);
  const { registrations } = detail!;

  const iso = new Date().toISOString();
  await updateItem({
    key: leagueKeys.meta(lid),
    update: "SET #st = :cancelled, updatedAt = :u",
    names: { "#st": "status" },
    values: { ":cancelled": "cancelled" satisfies LeagueStatus, ":u": iso },
  });

  let refunded = 0;
  for (const reg of registrations) {
    if (!PAID_STATES.has(reg.paymentStatus)) continue;
    await refundLeagueRegistration(lid, reg.did, reg.uid, { refundApplicationFee: true });
    refunded++;
  }

  const updated = (await getLeagueMeta(lid))!;
  return { league: updated, refunded };
}
