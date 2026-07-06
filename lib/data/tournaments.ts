/**
 * tournaments.ts — the Tournaments data layer + the money spine's first paid
 * product (PRD §7.1, §10, §9.5 patterns 17/18/19).
 *
 * ── Money is exact (§10, §14.5) ──────────────────────────────────────────────
 * Every amount is integer minor units + ISO-4217 currency ({@link Money}); fees
 * are computed once via {@link computeFees} on the division price + the tourney's
 * fee config (absorb vs pass-through) and stored flat as {@link StoredMoney}.
 *
 * ── Never oversell (capacity concurrency) ────────────────────────────────────
 * A registration CLAIMS a division spot with a CONDITIONAL atomic counter on the
 * DivisionItem — `ADD registeredCount :1 IF registeredCount < capacity` — exactly
 * like outings' `claimGoingSpot`. DynamoDB serializes conditional updates on one
 * item, so when N writers race for the last spot EXACTLY ONE passes; the losers
 * catch `ConditionalCheckFailedException` and are rejected (409) or waitlisted
 * (deferred-capture). `registeredCount` is the authoritative capacity counter and
 * is reserved up-front (before payment) — the checkout window can never oversell.
 *
 * ── Connect-gated publish (§10) ──────────────────────────────────────────────
 * `publishTournament` refuses unless the organizer's Stripe Connect account is
 * `complete` AND the tournament has ≥1 division — you cannot sell before you can
 * be paid.
 *
 * ── Ledger reconciliation (§9.4) ─────────────────────────────────────────────
 * A REG's `paymentStatus` is flipped to `paid` by the Stripe webhook
 * (idempotent) which also writes a durable Payment receipt. Normal registrations
 * already reserved their spot at registration; only DEFERRED-CAPTURE (waitlist)
 * registrations increment `registeredCount` on capture. The `paymentStatus === paid`
 * guard makes sibling events (checkout.session.completed + payment_intent.succeeded)
 * fulfil a registration at most once → REG.paid ↔ one Payment ↔ registeredCount.
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
} from "@/lib/db/client";
import { GSI } from "@/lib/db/table";
import { tourneyKeys, userKeys } from "@/lib/db/keys";
import { slugify } from "@/lib/util/slug";
import { publicEnv } from "@/lib/env";
import { computeFees, money, type Money, type FeeConfig, type FeeMode } from "@/lib/money";
import { getGateway } from "@/lib/stripe";
import { getConnectAccount } from "@/lib/data/connect";
import { writePayment, refundPayment, getMyPayments } from "@/lib/data/payments";
import { earnTournamentRegistration } from "@/lib/data/gamify-earn";
import { trackServerEvent } from "@/lib/analytics/server";
import type {
  TourneyItem,
  DivisionItem,
  RegistrationItem,
  BracketMatchItem,
  PaymentItem,
  StoredMoney,
  TourneyStatus,
  ElimFormat,
  PartnerStatus,
} from "@/lib/db/types";

// ── domain error (route handlers map `.status` → HTTP) ────────────────────────

/** A domain error carrying the HTTP status the API layer should surface. */
export class TourneyError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "TourneyError";
  }
}
const badRequest = (m: string): never => {
  throw new TourneyError(m, 400);
};
const forbidden = (m: string): never => {
  throw new TourneyError(m, 403);
};
const notFound = (m: string): never => {
  throw new TourneyError(m, 404);
};
const conflict = (m: string): never => {
  throw new TourneyError(m, 409);
};

// ── money helpers ─────────────────────────────────────────────────────────────

const asItem = (o: object): Record<string, unknown> => o as unknown as Record<string, unknown>;

/** Flatten a {@link Money} to the {@link StoredMoney} we persist on items. */
function toStored(m: Money): StoredMoney {
  return { amount: m.amount, currency: m.currency };
}
/** Rehydrate a stored money value to a {@link Money}. */
function fromStored(s: StoredMoney): Money {
  return money(s.amount, s.currency);
}
/** The platform {@link FeeConfig} applied to every division of a tournament (§10). */
function feeConfigOf(t: Pick<TourneyItem, "feeMode" | "feePercentBps" | "feeFixed">): FeeConfig {
  return { mode: t.feeMode, percentBps: t.feePercentBps, fixed: t.feeFixed };
}

// ── create / divisions ────────────────────────────────────────────────────────

export interface CreateTournamentInput {
  organizerId: string;
  title: string;
  cityKey: string;
  startDate: string; // yyyy-mm-dd
  endDate?: string;
  courtId?: string;
  venueName?: string;
  description?: string;
  currency?: string; // default "usd"
  /** Platform fee model applied to every division (default absorb / 0 / 0). */
  feeMode?: FeeMode;
  feePercentBps?: number;
  feeFixed?: number;
  elim?: ElimFormat; // default "single"
  // DI hooks for deterministic tests (mirror createOuting).
  tid?: string;
  slug?: string;
  now?: number;
}

/**
 * Create a DRAFT tournament (§7.1). Only the organizer GSI1 is projected up-front
 * — the city finder (GSI2) + slug resolver (GSI3) are projected on `publish`, so a
 * draft never leaks into public reads. Fee config defaults to absorb/0/0.
 */
export async function createTournament(input: CreateTournamentInput): Promise<TourneyItem> {
  const now = input.now ?? Date.now();
  const iso = new Date(now).toISOString();
  const tid = input.tid ?? ulid();
  const currency = (input.currency ?? "usd").toLowerCase();
  const slug = input.slug ?? `${slugify(input.title)}-${tid.slice(-6).toLowerCase()}`;

  const tourney: TourneyItem = {
    ...tourneyKeys.meta(tid),
    ...tourneyKeys.byOrganizer(input.organizerId, input.startDate),
    entity: "TOURNEY",
    tid,
    title: input.title,
    slug,
    cityKey: input.cityKey,
    ...(input.courtId !== undefined ? { courtId: input.courtId } : {}),
    ...(input.venueName !== undefined ? { venueName: input.venueName } : {}),
    organizerId: input.organizerId,
    status: "draft",
    startDate: input.startDate,
    ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    currency,
    feeMode: input.feeMode ?? "absorb",
    feePercentBps: input.feePercentBps ?? 0,
    feeFixed: input.feeFixed ?? 0,
    connectedAccountId: null,
    elim: input.elim ?? "single",
    createdAt: iso,
    updatedAt: iso,
  };

  await putItem(asItem(tourney));
  return tourney;
}

export interface AddDivisionInput {
  name: string;
  price: Money | StoredMoney;
  capacity?: number;
  skillMin?: number;
  skillMax?: number;
  duprMin?: number;
  duprMax?: number;
  playMode: "singles" | "doubles";
  gender?: "mens" | "womens" | "mixed" | "open";
  stripePriceId?: string;
  did?: string;
  now?: number;
}

/** Add a division to a tournament (price stored as {@link StoredMoney}, count 0). */
export async function addDivision(tid: string, division: AddDivisionInput): Promise<DivisionItem> {
  const tourney = await getTournamentMeta(tid);
  if (!tourney) notFound(`Tournament not found: ${tid}`);
  const now = division.now ?? Date.now();
  const iso = new Date(now).toISOString();
  const did = division.did ?? ulid();
  const price = toStored(
    "amount" in division.price
      ? money(division.price.amount, division.price.currency)
      : division.price,
  );

  const item: DivisionItem = {
    ...tourneyKeys.division(tid, did),
    entity: "DIVISION",
    tid,
    did,
    name: division.name,
    price,
    ...(division.capacity !== undefined ? { capacity: division.capacity } : {}),
    ...(division.skillMin !== undefined ? { skillMin: division.skillMin } : {}),
    ...(division.skillMax !== undefined ? { skillMax: division.skillMax } : {}),
    ...(division.duprMin !== undefined ? { duprMin: division.duprMin } : {}),
    ...(division.duprMax !== undefined ? { duprMax: division.duprMax } : {}),
    playMode: division.playMode,
    ...(division.gender !== undefined ? { gender: division.gender } : {}),
    ...(division.stripePriceId !== undefined ? { stripePriceId: division.stripePriceId } : {}),
    registeredCount: 0,
    createdAt: iso,
    updatedAt: iso,
  };
  await putItem(asItem(item));
  return item;
}

// ── publish (CONNECT-GATED, §10) ──────────────────────────────────────────────

/**
 * Publish a tournament. **Connect-gated**: throws unless the organizer's Stripe
 * Connect account is `complete` (they can actually be paid) AND the tournament has
 * ≥1 division. Stamps `connectedAccountId` (the funds destination) and projects
 * the city-finder (GSI2) + slug (GSI3) keys so it becomes publicly discoverable.
 */
export async function publishTournament(tid: string): Promise<TourneyItem> {
  const tourney = await getTournamentMeta(tid);
  if (!tourney) notFound(`Tournament not found: ${tid}`);

  const divisions = await query<DivisionItem>({
    pk: tourneyKeys.meta(tid).pk,
    skBeginsWith: "DIVISION#",
  });
  if (divisions.items.length === 0) {
    badRequest("A tournament needs at least one division before it can be published");
  }

  const account = await getConnectAccount(tourney!.organizerId);
  if (!account || account.status !== "complete") {
    forbidden("Connect onboarding must be complete before you can publish (and be paid)");
  }

  const iso = new Date().toISOString();
  const g2 = tourneyKeys.inCity(tid, tourney!.cityKey, tourney!.startDate);
  const g3 = tourneyKeys.bySlug(tourney!.slug);
  const attrs = await updateItem({
    key: tourneyKeys.meta(tid),
    update:
      "SET #st = :pub, connectedAccountId = :acct, gsi2pk = :g2pk, gsi2sk = :g2sk, gsi3pk = :g3pk, gsi3sk = :g3sk, updatedAt = :u",
    names: { "#st": "status" },
    values: {
      ":pub": "published" satisfies TourneyStatus,
      ":acct": account!.accountId,
      ":g2pk": g2.gsi2pk,
      ":g2sk": g2.gsi2sk,
      ":g3pk": g3.gsi3pk,
      ":g3sk": g3.gsi3sk,
      ":u": iso,
    },
  });
  return attrs as unknown as TourneyItem;
}

// ── reads (patterns 17 / 18 / 19) ─────────────────────────────────────────────

/** META by id (GetItem). */
export async function getTournamentMeta(tid: string): Promise<TourneyItem | undefined> {
  return getItem<TourneyItem>(tourneyKeys.meta(tid));
}

/** A single division (GetItem). */
export async function getDivision(tid: string, did: string): Promise<DivisionItem | undefined> {
  return getItem<DivisionItem>(tourneyKeys.division(tid, did));
}

/** Pattern 18 result — the whole tournament from ONE partition Query. */
export interface TournamentDetail {
  tourney: TourneyItem;
  divisions: DivisionItem[];
  registrations: RegistrationItem[];
  bracket: BracketMatchItem[];
}

/**
 * Pattern 18 — a tournament + its divisions + registrations (+ bracket) in ONE
 * Query on `PK=TOURNEY#<tid>` (META, DIVISION#, REG#, BRACKET# all share the
 * partition). Returns `undefined` if the tournament doesn't exist.
 */
export async function getTournament(tid: string): Promise<TournamentDetail | undefined> {
  // queryAll: this partition (META + divisions + ALL registrations + bracket) feeds the
  // cancel/mass-refund loop and bracket seeding — a page dropped at 1 MB would leave
  // registrations unrefunded and seed the bracket from a partial roster.
  const items = await queryAll<
    TourneyItem | DivisionItem | RegistrationItem | BracketMatchItem
  >({ pk: tourneyKeys.meta(tid).pk });
  const tourney = items.find((i) => i.sk === "META") as TourneyItem | undefined;
  if (!tourney) return undefined;
  const divisions = items.filter((i): i is DivisionItem => i.entity === "DIVISION");
  const registrations = items.filter((i): i is RegistrationItem => i.entity === "REGISTRATION");
  const bracket = items.filter((i): i is BracketMatchItem => i.entity === "BRACKETMATCH");
  divisions.sort((a, b) => a.did.localeCompare(b.did));
  return { tourney, divisions, registrations, bracket };
}

/** Resolve a published tournament's META by URL slug (GSI3). */
export async function getTournamentBySlug(slug: string): Promise<TourneyItem | undefined> {
  const { gsi3pk } = tourneyKeys.bySlug(slug);
  const { items } = await query<TourneyItem>({
    index: GSI.bySlug,
    pk: gsi3pk,
    skEquals: "META",
    limit: 1,
  });
  return items[0];
}

/**
 * Pattern 17 — published tournaments in a city (GSI2), soonest first. Only
 * published tournaments carry the GSI2 keys, so drafts never appear (a status
 * filter is belt-and-braces).
 */
export async function getTournamentsInCity(cityKey: string): Promise<TourneyItem[]> {
  const { items } = await query<TourneyItem>({
    index: GSI.byLocation,
    pk: tourneyKeys.cityPk(cityKey),
    ascending: true, // gsi2sk = `<startDate>#<tid>` → chronological
  });
  return items.filter((t) => t.status === "published");
}

/** The organizer's tournaments (GSI1), newest first — includes drafts. */
export async function getTournamentsByOrganizer(organizerId: string): Promise<TourneyItem[]> {
  const { items } = await query<TourneyItem>({
    index: GSI.byOwner,
    pk: userKeys.profile(organizerId).pk,
    skBeginsWith: "TOURNEY#",
    ascending: false,
  });
  return items;
}

/** Pattern 19 result — a registration hydrated with its tournament. */
export interface MyRegistration {
  registration: RegistrationItem;
  tourney?: TourneyItem;
}

/**
 * Pattern 19 — the caller's tournament registrations (GSI1 `REG#TOURNEY#`),
 * newest first, hydrated with their tournament META via a single BatchGet
 * (a BatchGet is not a scan).
 */
export async function getMyRegistrations(uid: string): Promise<MyRegistration[]> {
  const { items } = await query<RegistrationItem>({
    index: GSI.byOwner,
    pk: userKeys.profile(uid).pk,
    skBeginsWith: "REG#TOURNEY#",
    ascending: false,
  });
  if (items.length === 0) return [];
  const metas = await batchGet<TourneyItem>(
    [...new Set(items.map((r) => r.tid))].map((tid) => tourneyKeys.meta(tid)),
  );
  const byId = new Map(metas.map((m) => [m.tid, m]));
  return items.map((registration) => ({ registration, tourney: byId.get(registration.tid) }));
}

// ── organizer dashboard (regs grouped by division + revenue/payout tallies) ────

export interface DivisionTally {
  division: DivisionItem;
  registrations: RegistrationItem[];
  paidCount: number;
  /** Gross charged to paid registrants (§10). */
  gross: Money;
  /** Platform fees collected on those registrations. */
  applicationFees: Money;
  /** What the organizer nets after platform fees (delayed payout). */
  organizerNet: Money;
}

export interface OrganizerDashboard {
  tourney: TourneyItem;
  divisions: DivisionTally[];
  totals: { gross: Money; applicationFees: Money; organizerNet: Money; paidCount: number };
}

const PAID_STATES = new Set(["paid", "partiallyRefunded"]);

/**
 * Organizer dashboard read: regs grouped by division with revenue/payout tallies.
 * ONE partition Query (pattern 18); money is summed exactly from the stored REG
 * amounts, falling back to {@link computeFees} on the division price when a REG
 * predates a charge. `organizerNet = gross − applicationFees` in BOTH fee modes.
 */
export async function getOrganizerDashboard(tid: string): Promise<OrganizerDashboard | undefined> {
  const detail = await getTournament(tid);
  if (!detail) return undefined;
  const { tourney, divisions, registrations } = detail;
  const currency = tourney.currency;
  const cfg = feeConfigOf(tourney);

  const totals = { gross: money(0, currency), applicationFees: money(0, currency), paidCount: 0 };
  const divisionTallies: DivisionTally[] = divisions.map((division) => {
    const regs = registrations.filter((r) => r.did === division.did);
    let gross = money(0, currency);
    let fees = money(0, currency);
    let paidCount = 0;
    for (const r of regs) {
      if (!PAID_STATES.has(r.paymentStatus)) continue;
      paidCount++;
      const breakdown = computeFees(fromStored(division.price), cfg);
      const amount = r.amount ? fromStored(r.amount) : breakdown.total;
      const fee = r.applicationFee ? fromStored(r.applicationFee) : breakdown.applicationFee;
      // Net out any refunded portion (partiallyRefunded regs carry the original gross
      // in `amount` and the returned amount in `refundedAmount`) so revenue isn't
      // overstated by money that was handed back.
      const refunded = r.refundedAmount ? fromStored(r.refundedAmount).amount : 0;
      gross = money(gross.amount + amount.amount - refunded, currency);
      fees = money(fees.amount + fee.amount, currency);
    }
    totals.gross = money(totals.gross.amount + gross.amount, currency);
    totals.applicationFees = money(totals.applicationFees.amount + fees.amount, currency);
    totals.paidCount += paidCount;
    return {
      division,
      registrations: regs,
      paidCount,
      gross,
      applicationFees: fees,
      organizerNet: money(gross.amount - fees.amount, currency),
    };
  });

  return {
    tourney,
    divisions: divisionTallies,
    totals: {
      gross: totals.gross,
      applicationFees: totals.applicationFees,
      organizerNet: money(totals.gross.amount - totals.applicationFees.amount, currency),
      paidCount: totals.paidCount,
    },
  };
}

// ── capacity concurrency (claim / release a division spot) ────────────────────

/**
 * Try to atomically claim one of `capacity` spots on a division. Returns `true`
 * on success. The CONDITIONAL update is the oversell gate: only one racing writer
 * can move `registeredCount` from `capacity-1` to `capacity`; the rest fail the
 * condition. Unlimited capacity (undefined) always succeeds.
 */
async function claimDivisionSpot(tid: string, did: string, capacity?: number): Promise<boolean> {
  if (capacity === undefined || capacity === null) {
    await updateItem({
      key: tourneyKeys.division(tid, did),
      update: "ADD registeredCount :one SET updatedAt = :u",
      values: { ":one": 1, ":u": new Date().toISOString() },
    });
    return true;
  }
  try {
    await updateItem({
      key: tourneyKeys.division(tid, did),
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

/** Release a previously-claimed spot (rollback / registrant cancel / refund). */
async function releaseDivisionSpot(tid: string, did: string): Promise<void> {
  await updateItem({
    key: tourneyKeys.division(tid, did),
    // Never let the counter go negative.
    update: "ADD registeredCount :neg SET updatedAt = :u",
    condition: "registeredCount > :zero",
    values: { ":neg": -1, ":zero": 0, ":u": new Date().toISOString() },
  }).catch((err) => {
    if (err instanceof ConditionalCheckFailedException) return;
    throw err;
  });
}

/**
 * Atomically flip a registration's `paymentStatus` from `from` → `to`, and report
 * whether THIS caller performed the transition. The `paymentStatus = :from` condition
 * is the concurrency gate for freeing a division spot (M8): the pending-cancel branch,
 * the organizer API refund, and the `charge.refunded` webhook all read the reg's status
 * non-atomically and then release the spot — under a concurrent refund/cancel (or an API
 * refund racing the webhook) they'd each read the same non-terminal status and each
 * release, dropping `registeredCount` by 2 for a single claim (→ later oversell). By
 * releasing ONLY when this conditional transition wins, exactly one caller frees the spot.
 * Returns false (never throws) when another writer already moved the reg off `from`.
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

// ── register (capacity race + Checkout + partner-pending + deferred-capture) ───

export interface RegisterOptions {
  /** Doubles: the partner (registration is partner-pending until they accept, §10). */
  partnerUid?: string;
  /** Deferred-capture: when the division is full, hold an authorization on a waitlist. */
  waitlist?: boolean;
  customerEmail?: string;
}

export interface RegisterResult {
  regKey: string;
  registration: RegistrationItem;
  checkoutUrl: string;
  status: "pending" | "waitlisted";
}

const ACTIVE_REG = new Set(["pending", "paid", "partnerPending"]);

/** Enforce a division's DUPR/skill gate (§7.1 DUPR-gated divisions). */
function assertRatingGate(division: DivisionItem, dupr?: number, skill?: number): void {
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

/**
 * Register a player for a division (§7.1, §10). Validates the DUPR/skill gate,
 * CLAIMS a capacity spot (conditional atomic counter — never oversell), creates a
 * destination-charge Checkout (funds → the organizer's connected account, the
 * platform keeps the `applicationFee`) with correlation metadata, and writes a
 * `pending` REG. Doubles with a partner start `partnerPending`. When the division
 * is full: `waitlist` ⇒ a deferred-capture (authorize-not-capture) hold; else 409.
 * Returns `{ checkoutUrl, regKey }`.
 */
export async function registerForDivision(
  tid: string,
  did: string,
  uid: string,
  opts: RegisterOptions = {},
): Promise<RegisterResult> {
  const tourney = await getTournamentMeta(tid);
  if (!tourney) notFound(`Tournament not found: ${tid}`);
  if (tourney!.status !== "published") {
    badRequest("Registration is only open for published tournaments");
  }
  if (!tourney!.connectedAccountId) {
    badRequest("This tournament is not connected to a payout account");
  }
  const division = await getDivision(tid, did);
  if (!division) notFound(`Division not found: ${did}`);

  // Idempotency + duplicate guard: an active registration blocks a second one.
  const key = tourneyKeys.registration(tid, did, uid, tourney!.startDate);
  const existing = await getItem<RegistrationItem>(key);
  if (existing && ACTIVE_REG.has(existing.paymentStatus)) {
    conflict("You are already registered for this division");
  }

  // Rating gate — resolved SERVER-SIDE from stored ratings, never from the request.
  const dupr = await resolveDupr(uid);
  const skill = await resolveSkill(uid);
  assertRatingGate(division!, dupr, skill);

  // Claim a spot (or fall through to a deferred-capture waitlist hold).
  const claimed = await claimDivisionSpot(tid, did, division!.capacity);
  const waitlisted = !claimed;
  if (waitlisted && !opts.waitlist) {
    conflict("This division is full");
  }

  // Exact fee split on the division price (§10).
  const breakdown = computeFees(fromStored(division!.price), feeConfigOf(tourney!));
  const regKey = `${did}#${uid}`;

  // FREE division (total $0): a $0 Stripe Checkout session is REJECTED by real Stripe (its
  // ~$0.50 minimum), so a free division would 500 on every registration in prod (M24). Skip
  // Checkout when free and fulfill the (spot-claimed, non-partner) registration immediately below.
  const isFree = breakdown.total.amount <= 0;
  // Destination-charge Checkout. `captureLater` for a waitlist hold (deferred-capture).
  let session;
  if (!isFree) {
    try {
      session = await getGateway().createCheckoutSession({
        connectedAccountId: tourney!.connectedAccountId!,
        lineItems: [
          {
            name: `${tourney!.title} — ${division!.name}`,
            unitAmount: breakdown.total,
            quantity: 1,
          },
        ],
        applicationFee: breakdown.applicationFee,
        currency: tourney!.currency,
        metadata: { tid, did, uid, regKey, kind: "tournament" },
        successUrl: `${publicEnv.siteUrl}/tournaments/${tid}?reg=${encodeURIComponent(regKey)}&checkout=success`,
        cancelUrl: `${publicEnv.siteUrl}/tournaments/${tid}?reg=${encodeURIComponent(regKey)}&checkout=cancel`,
        ...(opts.customerEmail ? { customerEmail: opts.customerEmail } : {}),
        captureLater: waitlisted,
        clientReferenceId: regKey,
      });
    } catch (err) {
      // Roll the claimed spot back if we can't start Checkout.
      if (claimed) await releaseDivisionSpot(tid, did);
      throw err;
    }
  }

  const iso = new Date().toISOString();
  const isDoubles = division!.playMode === "doubles" && !!opts.partnerUid;
  const paymentStatus = isDoubles ? "partnerPending" : "pending";
  const registration: RegistrationItem = {
    ...key,
    entity: "REGISTRATION",
    tid,
    did,
    uid,
    startDate: tourney!.startDate,
    paymentStatus,
    ...(session ? { checkoutSessionId: session.id, paymentIntentId: session.paymentIntentId } : {}),
    amount: toStored(breakdown.total),
    applicationFee: toStored(breakdown.applicationFee),
    ...(opts.partnerUid
      ? { partnerUid: opts.partnerUid, partnerStatus: "pending" as PartnerStatus }
      : {}),
    // authorizedNotCaptured ⇒ the spot was NOT reserved up-front; the webhook
    // claims it on capture. A normal reg is already counted at registration.
    ...(waitlisted ? { authorizedNotCaptured: true } : {}),
    registeredAt: iso,
    createdAt: existing?.createdAt ?? iso,
    updatedAt: iso,
  };
  // Write create-or-overwrite-terminal: allowed when no row exists OR the stored one
  // is terminal (cancelled/refunded/…). A concurrent first-time registration that
  // already wrote an ACTIVE row makes this fail — so we never clobber an in-flight
  // sibling or double-count the spot (the read-guard above is not atomic on its own).
  try {
    await putConditional(
      asItem(registration),
      "attribute_not_exists(pk) OR NOT (paymentStatus IN (:pending, :paid, :partnerPending))",
      { values: { ":pending": "pending", ":paid": "paid", ":partnerPending": "partnerPending" } },
    );
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      if (claimed) await releaseDivisionSpot(tid, did);
      conflict("You are already registered for this division");
    }
    throw err;
  }

  // FREE, spot-claimed, non-partner: fulfill now (confirmRegistrationPayment flips
  // pending→paid + writes a $0 receipt). Partner-pending / waitlist-hold free regs keep
  // their status (no payment is due yet). Roll back on failure so registration is retryable.
  if (isFree && !waitlisted && paymentStatus === "pending") {
    try {
      await confirmRegistrationPayment({ tid, did, uid, amountTotal: 0, currency: tourney!.currency });
    } catch (err) {
      if (claimed) await releaseDivisionSpot(tid, did);
      await deleteItem(key).catch(() => {});
      throw err;
    }
    return {
      regKey,
      registration: { ...registration, paymentStatus: "paid" },
      checkoutUrl: `${publicEnv.siteUrl}/tournaments/${tid}?reg=${encodeURIComponent(regKey)}&checkout=success`,
      status: "pending",
    };
  }

  const checkoutUrl =
    session?.url ?? `${publicEnv.siteUrl}/tournaments/${tid}?reg=${encodeURIComponent(regKey)}&checkout=success`;
  return {
    regKey,
    registration,
    checkoutUrl,
    status: waitlisted ? "waitlisted" : "pending",
  };
}

// ── webhook fulfilment (idempotent) ───────────────────────────────────────────

export interface ConfirmPaymentInput {
  tid: string;
  did: string;
  uid: string;
  paymentIntentId?: string;
  amountTotal?: number; // minor units (from the Stripe object, cross-check only)
  currency?: string;
  receiptUrl?: string;
}

export interface ConfirmPaymentResult {
  ok: boolean;
  alreadyPaid?: boolean;
  registration?: RegistrationItem;
  payment?: PaymentItem;
}

/**
 * Refund a payment that landed on an already-CANCELLED tournament — a registrant who
 * completed Checkout after `cancelTournament` ran its mass-refund pass (which only
 * refunds PAID_STATES, so an in-flight `pending` reg was skipped). Organizer-initiated
 * ⇒ the platform fee is refunded too (§10). Best-effort: a gateway/DB failure is logged
 * (not thrown) so the webhook still ACKs and Stripe does not retry forever — the paid
 * reg + receipt stand, and an organizer refund can recover it. `refundRegistration`
 * itself is a no-op on an already-refunded reg, so this is safe to re-run on a retry.
 */
async function autoRefundCancelledReg(tid: string, did: string, uid: string): Promise<void> {
  try {
    await refundRegistration(tid, did, uid, { refundApplicationFee: true });
  } catch (err) {
    console.error(
      `[confirmRegistrationPayment] auto-refund into cancelled tournament ${tid}/${did}/${uid} failed:`,
      err,
    );
  }
}

/**
 * Mark a registration `paid` and write its durable Payment receipt. Called by the
 * Stripe webhook after signature verify + event de-dupe. Idempotent per REG: the
 * `paymentStatus === paid` guard means sibling events (checkout.session.completed
 * AND payment_intent.succeeded) fulfil at most once (one Payment, one count). Only
 * a DEFERRED-CAPTURE reg (authorizedNotCaptured) increments `registeredCount` here
 * — a normal reg already reserved its spot at registration.
 */
export async function confirmRegistrationPayment(
  input: ConfirmPaymentInput,
): Promise<ConfirmPaymentResult> {
  const { tid, did, uid } = input;
  const key = tourneyKeys.registration(tid, did, uid, "");
  const reg = await getItem<RegistrationItem>(key);
  if (!reg) return { ok: false };

  // Was the event cancelled while this registrant was mid-checkout? If so their money
  // is captured into a dead event — confirm the capture below, then AUTO-REFUND it.
  // Checked here (and re-checked on the `paid` retry branch) so a webhook retry after
  // a transient refund failure re-attempts rather than stranding the money.
  const eventCancelled = (await getTournamentMeta(tid))?.status === "cancelled";

  if (reg.paymentStatus === "paid") {
    if (eventCancelled) await autoRefundCancelledReg(tid, did, uid);
    return { ok: true, alreadyPaid: true, registration: reg };
  }

  const iso = new Date().toISOString();
  const wasDeferred = reg.authorizedNotCaptured === true;

  // Resolve the real PaymentIntent id and BACKFILL it onto the REG below. With
  // deferred-PI Checkout (Stripe basil+, our pinned api version), the PaymentIntent
  // does not exist at session creation, so registration stored `paymentIntentId: ""`;
  // the webhook is the first place the real PI is known. Use `||` (not `??`) so the
  // stored empty string falls through to the webhook's PI — otherwise every refund
  // path (organizer refund, receipt reconciliation) has no PI to target and 400s.
  const paymentIntentId = reg.paymentIntentId || input.paymentIntentId || "";

  // Flip to paid ATOMICALLY so exactly one delivery fulfils. Stripe emits two sibling
  // events for one checkout (checkout.session.completed + payment_intent.succeeded);
  // delivered concurrently, a read-then-write guard lets both pass. The conditional
  // write makes the first writer win — one receipt, one count, one claim, one emit.
  let updated: RegistrationItem;
  try {
    const attrs = await updateItem({
      key,
      update:
        "SET paymentStatus = :paid, updatedAt = :u, paymentIntentId = :pi REMOVE authorizedNotCaptured",
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
      (attrs as unknown as RegistrationItem) ?? { ...reg, paymentStatus: "paid", paymentIntentId };
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      return { ok: true, alreadyPaid: true, registration: reg };
    }
    throw err;
  }

  // Deferred-capture holds were not counted at registration — claim the spot now, on
  // the winning delivery only. A false result means the division filled between
  // authorize and capture; the charge is already captured, so we keep the paid state
  // (the seat is honored) and surface the over-capacity via the reconcile sweep.
  if (wasDeferred) {
    const division = await getDivision(tid, did);
    await claimDivisionSpot(tid, did, division?.capacity);
  }

  const currency = reg.amount?.currency ?? input.currency ?? "usd";
  const amount: StoredMoney = reg.amount ?? { amount: input.amountTotal ?? 0, currency };
  const payment = await writePayment({
    uid,
    kind: "tournament",
    refId: tid,
    divisionId: did,
    amount,
    ...(reg.applicationFee ? { applicationFee: reg.applicationFee } : {}),
    paymentIntentId,
    status: "paid",
    ...(input.receiptUrl ? { receiptUrl: input.receiptUrl } : {}),
  });

  // Payment landed on a cancelled event: refund it immediately and DON'T fire the
  // confirmation analytics — the entry is not really confirmed (§10). The receipt
  // above records the (now-refunded) capture for the ledger/audit trail.
  if (eventCancelled) {
    await autoRefundCancelledReg(tid, did, uid);
    return { ok: true, registration: { ...updated, paymentStatus: "refunded" }, payment };
  }

  // ⚙ payment_succeeded + registration_confirmed (§2.1) — emitted once, at the
  // first fulfilment (the `paid` guard above short-circuits replays). Money was
  // captured AND the entry is confirmed at the same moment for a tournament reg.
  const analyticsProps = {
    kind: "tournament" as const,
    refId: tid,
    divisionId: did,
    amount: amount.amount,
    currency: amount.currency,
    paymentIntentId,
  };
  trackServerEvent(uid, "payment_succeeded", analyticsProps);
  trackServerEvent(uid, "registration_confirmed", analyticsProps);

  // E10 — a confirmed tournament division registration earns Rally Points (§G4.2).
  // Failure-isolated; the E10#tid#did sourceKey dedupes concurrent Stripe events.
  await earnTournamentRegistration(uid, tid, did);

  return { ok: true, registration: updated, payment };
}

export interface RefundWebhookInput {
  tid: string;
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
export async function markRegistrationRefunded(
  input: RefundWebhookInput,
): Promise<RegistrationItem | undefined> {
  const { tid, did, uid } = input;
  const key = tourneyKeys.registration(tid, did, uid, "");
  const reg = await getItem<RegistrationItem>(key);
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

  // Reconcile the durable Payment receipt (located under the payer by paymentIntentId).
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

  // Free the spot exactly once — only the caller whose full-refund transition won (and
  // whose reg held a spot; a deferred hold never did) releases it.
  if (full && flipped && reg.authorizedNotCaptured !== true) {
    await releaseDivisionSpot(tid, did);
  }

  return { ...reg, paymentStatus: full ? "refunded" : "partiallyRefunded", refundedAmount: refundedMoney, updatedAt: iso };
}

// ── cancel / refund (registrant fee-retained · organizer fee-refunded) ────────

/** Locate a registrant's durable Payment receipt (for the refund ledger `ts`). */
async function findRegPayment(
  uid: string,
  tid: string,
  did: string,
  paymentIntentId: string,
): Promise<PaymentItem | undefined> {
  const payments = await getMyPayments(uid);
  return payments.find(
    (p) => p.paymentIntentId === paymentIntentId && p.refId === tid && p.divisionId === did,
  );
}

/**
 * Refund a single registration and reconcile it. Routes the money through the
 * ledger's {@link refundPayment} (which calls the gateway + updates the Payment
 * receipt), then flips the REG to `refunded`/`partiallyRefunded` and frees the
 * spot on a full refund. `refundApplicationFee` chooses the §10 policy:
 * organizer-initiated ⇒ true (fee refunded); registrant-initiated ⇒ false (retained).
 */
export async function refundRegistration(
  tid: string,
  did: string,
  uid: string,
  opts: { amount?: Money; refundApplicationFee?: boolean } = {},
): Promise<RegistrationItem | undefined> {
  const key = tourneyKeys.registration(tid, did, uid, "");
  const reg = await getItem<RegistrationItem>(key);
  if (!reg) return undefined;

  // Nothing captured yet — just cancel + free the spot (no gateway refund needed).
  if (!PAID_STATES.has(reg.paymentStatus)) {
    // Flip to cancelled ONLY if the reg is still in its pre-read status. A concurrent
    // cancel/refund that already transitioned it fails this condition, so exactly one
    // caller reaches the release below (M8 — no double-release of the spot).
    const flipped = await transitionRegStatus(key, reg.paymentStatus, "cancelled");
    // Free the spot only for a reg that still HELD one (pending/partnerPending, never
    // deferred) AND that THIS call actually transitioned. An already-terminal reg
    // (cancelled/refunded — e.g. the charge.refunded webhook ran first) released its
    // spot already; releasing again would undercount.
    if (flipped && ACTIVE_REG.has(reg.paymentStatus) && reg.authorizedNotCaptured !== true) {
      await releaseDivisionSpot(tid, did);
    }
    return { ...reg, paymentStatus: "cancelled" };
  }

  if (!reg.paymentIntentId) badRequest("Registration has no captured payment to refund");
  const payment = await findRegPayment(uid, tid, did, reg.paymentIntentId!);
  if (!payment) notFound("Payment receipt not found for this registration");

  const { payment: updatedPayment } = await refundPayment({
    uid,
    ts: payment!.ts,
    ...(opts.amount ? { amount: opts.amount } : {}),
    refundApplicationFee: opts.refundApplicationFee ?? false,
    reason: opts.refundApplicationFee ? "organizer_refund" : "requested_by_customer",
  });

  const full = updatedPayment.status === "refunded";
  const refundedAmount: StoredMoney = updatedPayment.refundedAmount ??
    reg.amount ?? { amount: 0, currency: "usd" };
  const iso = new Date().toISOString();
  if (full) {
    // Conditionally flip to refunded; release the spot ONLY if this call performed the
    // transition. A concurrent API refund or the charge.refunded webhook that already
    // flipped the reg fails the condition, so the spot is freed exactly once (M8).
    const flipped = await transitionRegStatus(key, reg.paymentStatus, "refunded", { refundedAmount });
    if (flipped) await releaseDivisionSpot(tid, did);
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
export async function cancelRegistration(
  tid: string,
  did: string,
  uid: string,
  opts: { amount?: Money } = {},
): Promise<RegistrationItem | undefined> {
  return refundRegistration(tid, did, uid, {
    ...(opts.amount ? { amount: opts.amount } : {}),
    refundApplicationFee: false,
  });
}

export interface CancelTournamentResult {
  tourney: TourneyItem;
  refunded: number;
}

/**
 * Cancel a tournament + MASS-REFUND every paid registration. Organizer-initiated,
 * so the platform application fee is REFUNDED too (`refundApplicationFee: true`,
 * §10). Each refunded REG is reconciled to `refunded` and its spot freed.
 */
export async function cancelTournament(tid: string): Promise<CancelTournamentResult> {
  const detail = await getTournament(tid);
  if (!detail) notFound(`Tournament not found: ${tid}`);
  const { registrations } = detail!;

  const iso = new Date().toISOString();
  await updateItem({
    key: tourneyKeys.meta(tid),
    update: "SET #st = :cancelled, updatedAt = :u",
    names: { "#st": "status" },
    values: { ":cancelled": "cancelled" satisfies TourneyStatus, ":u": iso },
  });

  let refunded = 0;
  for (const reg of registrations) {
    if (!PAID_STATES.has(reg.paymentStatus)) continue;
    await refundRegistration(tid, reg.did, reg.uid, { refundApplicationFee: true });
    refunded++;
  }

  const updated = (await getTournamentMeta(tid))!;
  return { tourney: updated, refunded };
}

// ── bracket: pure single-elim (+ 3rd place) helper ────────────────────────────

/** A planned bracket match (pure — the persisted `BracketMatchItem` mirrors it). */
export interface PlanMatch {
  round: number;
  index: number;
  sideA?: string[];
  sideB?: string[];
  winnerTo: { matchId: string; slot: "A" | "B" } | null;
  label?: string;
  status?: "pending" | "scored";
}

/** Stable, parseable id for a bracket match at (round, index). */
export function bracketMatchId(round: number, index: number): string {
  return `R${round}M${index}`;
}
function parseBracketMatchId(id: string): { round: number; index: number } {
  const m = /^R(\d+)M(\d+)$/.exec(id);
  if (!m) throw new TourneyError(`Bad bracket match id: ${id}`, 400);
  return { round: Number(m[1]), index: Number(m[2]) };
}

/**
 * Standard single-elimination seed-slot order for a power-of-two bracket: returns
 * the 1-based seed number occupying each bracket position (1 v N, 2 v N-1, …), so
 * top seeds are maximally spread and can only meet in the final.
 */
export function seedSlots(size: number): number[] {
  let slots = [1, 2];
  while (slots.length < size) {
    const total = slots.length * 2 + 1;
    const next: number[] = [];
    for (const s of slots) {
      next.push(s);
      next.push(total - s);
    }
    slots = next;
  }
  return slots;
}

function roundLabel(round: number, rounds: number): string {
  const fromEnd = rounds - round;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semifinal";
  if (fromEnd === 2) return "Quarterfinal";
  return `Round ${round}`;
}

/**
 * Build a single-elim bracket (PURE) from seeded entrant ids (best seed first).
 * Byes (entrants < bracket size) auto-advance the present side into the next
 * round. When `thirdPlace`, a bonus match (round = finalRound, index 1) collects
 * the two semifinal losers.
 */
export function buildBracketPlan(
  entrants: string[],
  opts: { thirdPlace?: boolean } = {},
): PlanMatch[] {
  if (entrants.length < 2) return [];
  let size = 1;
  while (size < entrants.length) size *= 2;
  const rounds = Math.round(Math.log2(size));
  const seated = seedSlots(size).map((seed) => (seed <= entrants.length ? entrants[seed - 1] : undefined));

  // Match shells per round, with winnerTo linkage to the next round.
  const grid: PlanMatch[][] = [];
  for (let r = 1; r <= rounds; r++) {
    const count = size / 2 ** r;
    const row: PlanMatch[] = [];
    for (let i = 0; i < count; i++) {
      row.push({
        round: r,
        index: i,
        winnerTo:
          r < rounds
            ? { matchId: bracketMatchId(r + 1, i >> 1), slot: i % 2 === 0 ? "A" : "B" }
            : null,
        label: roundLabel(r, rounds),
        status: "pending",
      });
    }
    grid.push(row);
  }

  // Seat round 1 from the seeded slots.
  for (let i = 0; i < grid[0].length; i++) {
    const a = seated[2 * i];
    const b = seated[2 * i + 1];
    if (a) grid[0][i].sideA = [a];
    if (b) grid[0][i].sideB = [b];
  }

  // Propagate round-1 byes (exactly one side present) into round 2.
  const seat = (target: { matchId: string; slot: "A" | "B" }, side: string[]) => {
    const { round, index } = parseBracketMatchId(target.matchId);
    const m = grid[round - 1][index];
    if (target.slot === "A") m.sideA = side;
    else m.sideB = side;
  };
  for (const m of grid[0]) {
    const aP = !!m.sideA;
    const bP = !!m.sideB;
    if (aP !== bP) {
      m.status = "scored"; // a bye is auto-resolved
      const winner = (m.sideA ?? m.sideB)!;
      if (m.winnerTo) seat(m.winnerTo, winner);
    }
  }

  const plan = grid.flat();
  if (opts.thirdPlace && rounds >= 2) {
    plan.push({
      round: rounds,
      index: 1,
      winnerTo: null,
      label: "3rd Place",
      status: "pending",
    });
  }
  return plan;
}

// ── bracket: seed + advance (persisted) ───────────────────────────────────────

/**
 * Seed a division's bracket from its PAID registrations (snake/standard seed by
 * DUPR desc, then registration order) and persist the `BracketMatchItem` rows.
 * Single-elim; `thirdPlace` adds a 3rd-place match. Re-seeding overwrites.
 */
export async function seedBracket(
  tid: string,
  did: string,
  opts: { thirdPlace?: boolean } = {},
): Promise<BracketMatchItem[]> {
  const detail = await getTournament(tid);
  if (!detail) notFound(`Tournament not found: ${tid}`);
  const division = detail!.divisions.find((d) => d.did === did);
  if (!division) notFound(`Division not found: ${did}`);

  const paid = detail!.registrations.filter(
    (r) => r.did === did && PAID_STATES.has(r.paymentStatus),
  );
  if (paid.length < 2) badRequest("Need at least 2 paid registrations to seed a bracket");

  // Seed order: highest DUPR first (unrated players sort last), then earliest registration
  // as the tie-break. The comparator previously sorted by time ONLY, silently ignoring DUPR
  // despite this contract — so strong players who registered late met in round 1 (L6). DUPR
  // is resolved SERVER-SIDE from the verified RATING# rows (same source the entry gate uses).
  const duprByUid = new Map<string, number>();
  await Promise.all(
    paid.map(async (r) => {
      const d = await resolveDupr(r.uid);
      if (d !== undefined) duprByUid.set(r.uid, d);
    }),
  );
  const seeds = paid
    .slice()
    .sort((a, b) => {
      const da = duprByUid.get(a.uid) ?? -Infinity;
      const db = duprByUid.get(b.uid) ?? -Infinity;
      if (da !== db) return db - da; // higher DUPR seeds higher
      return (a.registeredAt ?? a.createdAt).localeCompare(b.registeredAt ?? b.createdAt);
    })
    .map((r) => r.uid);

  // Any bracket already persisted for this division (a re-seed fully replaces it).
  const existing = await getBracket(tid, did);

  const plan = buildBracketPlan(seeds, opts);
  const iso = new Date().toISOString();
  const items: BracketMatchItem[] = plan.map((m) => ({
    ...tourneyKeys.bracketMatch(tid, did, m.round, m.index),
    entity: "BRACKETMATCH",
    tid,
    did,
    round: m.round,
    index: m.index,
    ...(m.sideA ? { sideA: m.sideA } : {}),
    ...(m.sideB ? { sideB: m.sideB } : {}),
    winnerTo: m.winnerTo,
    ...(m.label ? { label: m.label } : {}),
    status: m.status ?? "pending",
    createdAt: iso,
    updatedAt: iso,
  }));
  await Promise.all(items.map((it) => putItem(asItem(it))));

  // Re-seed is a FULL replacement: delete any prior match rows the new plan didn't
  // overwrite. A smaller re-seed (fewer paid entrants crossing a power-of-two boundary)
  // otherwise leaves higher-round/higher-index rows as ghosts — `advanceBracket` then
  // computes `finalRound = max(round)` off a ghost, mis-routes the 3rd-place drop, and
  // the board renders phantom matches (M9). Delete AFTER the writes so a mid-op failure
  // never leaves the bracket missing its real matches (worst case: a leftover ghost).
  const planned = new Set(plan.map((m) => `${m.round}#${m.index}`));
  const stale = existing.filter((m) => !planned.has(`${m.round}#${m.index}`));
  await Promise.all(stale.map((m) => deleteItem(tourneyKeys.bracketMatch(tid, did, m.round, m.index))));

  return items;
}

/** Read a division's bracket (from the tournament partition), match order. */
export async function getBracket(tid: string, did: string): Promise<BracketMatchItem[]> {
  const { items } = await query<BracketMatchItem>({
    pk: tourneyKeys.meta(tid).pk,
    skBeginsWith: `BRACKET#${did}#`,
  });
  return items;
}

/**
 * Record a bracket match score and advance the winner into the linked match
 * (`winnerTo`). For a semifinal, the loser drops into the 3rd-place match (routed
 * structurally — the `BracketMatchItem` model has no `loserTo`). Ties are rejected.
 */
export async function advanceBracket(
  tid: string,
  did: string,
  round: number,
  index: number,
  scoreA: number,
  scoreB: number,
  actorUid?: string,
): Promise<BracketMatchItem> {
  if (scoreA === scoreB) badRequest("A bracket match cannot end in a tie");
  const all = await getBracket(tid, did);
  const match = all.find((m) => m.round === round && m.index === index);
  if (!match) notFound(`Bracket match not found: ${bracketMatchId(round, index)}`);
  // A match already "scored" is being CORRECTED — don't re-fire match_played.
  const wasScored = match!.status === "scored";

  const winnerSlot: "A" | "B" = scoreA > scoreB ? "A" : "B";
  const winner = winnerSlot === "A" ? match!.sideA : match!.sideB;
  const loser = winnerSlot === "A" ? match!.sideB : match!.sideA;
  const iso = new Date().toISOString();

  const attrs = await updateItem({
    key: tourneyKeys.bracketMatch(tid, did, round, index),
    update: "SET scoreA = :a, scoreB = :b, #s = :scored, updatedAt = :u",
    names: { "#s": "status" },
    values: { ":a": scoreA, ":b": scoreB, ":scored": "scored", ":u": iso },
  });

  if (match!.winnerTo && winner) {
    const { round: wr, index: wi } = parseBracketMatchId(match!.winnerTo.matchId);
    await updateItem({
      key: tourneyKeys.bracketMatch(tid, did, wr, wi),
      update: `SET ${match!.winnerTo.slot === "A" ? "sideA" : "sideB"} = :w, updatedAt = :u`,
      values: { ":w": winner, ":u": iso },
    });
  }

  // Semifinal losers drop into the 3rd-place match (round = finalRound, index 1).
  const finalRound = Math.max(...all.map((m) => m.round));
  const thirdPlace = all.find((m) => m.round === finalRound && m.index === 1);
  if (thirdPlace && loser && round === finalRound - 1) {
    await updateItem({
      key: tourneyKeys.bracketMatch(tid, did, finalRound, 1),
      update: `SET ${index === 0 ? "sideA" : "sideB"} = :l, updatedAt = :u`,
      values: { ":l": loser, ":u": iso },
    });
  }

  // ⚙ match_played (§2.1) — a confirmed bracket result, ONCE per match (skip a
  // re-score correction). Attributed to the reporting organizer when known.
  if (!wasScored) {
    trackServerEvent(actorUid ?? "anonymous", "match_played", {
      kind: "tournament",
      tid,
      did,
      round,
      index,
    });
  }

  return (attrs as unknown as BracketMatchItem) ?? match!;
}
