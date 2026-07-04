/**
 * ladders.ts — the Ladders data layer (PRD §7.4, §9.5 pattern 22). Reuses the
 * Stage-6 Stripe spine (Connect + Checkout + the payment ledger) and the PURE
 * ladder rules in `lib/ladders/rerank` as the single source of truth for
 * eligibility (`canChallenge`), movement (`applyResult`), and the response window
 * (`dueDateFrom`/`isExpired`).
 *
 * ── One partition per ladder (pattern 22) ─────────────────────────────────────
 * A ladder lives entirely under `LADDER#<lid>`:
 *   META            → LadderItem     (meta + fee config + Connect + challenge rules)
 *   RUNG#<pos>      → RungItem       (a paid player's ranked seat; pos 1 = top)
 *   CHALLENGE#<cid> → ChallengeItem  (+ GSI1 by the CHALLENGED uid = my inbox)
 * so `getLadder` (detail + rungs + challenges) is ONE Query.
 *
 * ── The challenge lifecycle (§7.4) ────────────────────────────────────────────
 *   issue → respond(accept|decline) → report(scores) → confirm → RE-RANK
 * A player may only challenge someone ABOVE them within `challengeRange` rungs
 * (`canChallenge`). A confirmed upset moves the challenger up into the challenged's
 * rung and slides everyone in between down one (`applyResult`); a challenged win is
 * a no-op on order. A challenge unanswered within `responseWindowDays` expires to a
 * challenger forfeit-win. Every state transition is a DynamoDB CONDITIONAL write so
 * a two-party handshake (and concurrent accepts) can only resolve ONCE.
 *
 * ── Money is exact + never bypasses the ledger (§10, §14.5) ───────────────────
 * Joining a ladder is a destination-charge Checkout (funds → the organizer's
 * connected account, platform keeps the `applicationFee`). `confirmLadderPayment`
 * (called by the Stripe webhook the integrator wires) PLACES the paying player on a
 * new rung and writes ONE durable Payment; it is idempotent per rung.
 */

import { ulid } from "ulid";
import {
  ConditionalCheckFailedException,
  TransactionCanceledException,
} from "@aws-sdk/client-dynamodb";
import {
  getItem,
  query,
  queryAll,
  putItem,
  putNew,
  updateItem,
  deleteItem,
  transactWrite,
  txPut,
  txUpdate,
  type TransactItem,
} from "@/lib/db/client";
import { GSI } from "@/lib/db/table";
import { ladderKeys, userKeys, SEP } from "@/lib/db/keys";
import { slugify } from "@/lib/util/slug";
import { publicEnv } from "@/lib/env";
import { computeFees, money, type Money, type FeeConfig, type FeeMode } from "@/lib/money";
import { getGateway } from "@/lib/stripe";
import { getConnectAccount } from "@/lib/data/connect";
import { writePayment, getMyPayments, type WritePaymentInput } from "@/lib/data/payments";
import { trackServerEvent } from "@/lib/analytics/server";
import { createNotification } from "@/lib/data/notifications";
import { getUserProfile } from "@/lib/data/users";
import { canChallenge, applyResult, dueDateFrom, isExpired } from "@/lib/ladders/rerank";
import type {
  LadderItem,
  RungItem,
  ChallengeItem,
  ChallengeStatus,
  LeagueStatus,
  PaymentItem,
  StoredMoney,
} from "@/lib/db/types";

// ── domain error (route handlers map `.status` → HTTP) ────────────────────────

/** A domain error carrying the HTTP status the API layer should surface. */
export class LadderError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "LadderError";
  }
}
const badRequest = (m: string): never => {
  throw new LadderError(m, 400);
};
const forbidden = (m: string): never => {
  throw new LadderError(m, 403);
};
const notFound = (m: string): never => {
  throw new LadderError(m, 404);
};
const conflict = (m: string): never => {
  throw new LadderError(m, 409);
};

const asItem = (o: object): Record<string, unknown> => o as unknown as Record<string, unknown>;
const META = "META";

// ── money helpers (mirror tournaments) ────────────────────────────────────────

function toStored(m: Money): StoredMoney {
  return { amount: m.amount, currency: m.currency };
}
function feeConfigOf(l: Pick<LadderItem, "feeMode" | "feePercentBps" | "feeFixed">): FeeConfig {
  return { mode: l.feeMode, percentBps: l.feePercentBps, fixed: l.feeFixed };
}

// ── ladder-scoped GSI key builders ────────────────────────────────────────────
// `ladderKeys` (do-not-edit) only covers the base partition; ladders reuse the
// shared overloaded GSIs with LADDER-specific prefixes (like TOURNEYLOC/LEAGUELOC)
// so a ladder finder / slug / organizer read never collides with another product.

const ladderGsi = {
  /** GSI1 — an organizer's ladders (drafts included), newest first. */
  byOrganizer: (organizerId: string, startDate: string) => ({
    gsi1pk: `${userKeys.profile(organizerId).pk}`,
    gsi1sk: `LADDER${SEP}${startDate}`,
  }),
  /** GSI2 — published ladders in a city, chronological. */
  inCity: (lid: string, cityKey: string, startDate: string) => ({
    gsi2pk: `LADDERLOC${SEP}${cityKey}`,
    gsi2sk: `${startDate}${SEP}${lid}`,
  }),
  cityPk: (cityKey: string) => `LADDERLOC${SEP}${cityKey}`,
  /** GSI3 — a published ladder resolved by URL slug. */
  bySlug: (slug: string) => ({ gsi3pk: `LADDERSLUG${SEP}${slug}`, gsi3sk: META }),
} as const;

// ── create ────────────────────────────────────────────────────────────────────

export interface CreateLadderInput {
  organizerId: string;
  title: string;
  cityKey: string;
  startDate: string; // yyyy-mm-dd
  courtId?: string;
  venueName?: string;
  description?: string;
  currency?: string; // default "usd"
  feeMode?: FeeMode;
  feePercentBps?: number;
  feeFixed?: number;
  /** Ladder entry price (integer minor units). Default free (0). */
  price?: Money | StoredMoney;
  /** How many rungs up a player may challenge (§7.4). Default 3. */
  challengeRange?: number;
  /** Days a challenged player has to respond before forfeit (§7.4). Default 7. */
  responseWindowDays?: number;
  playMode?: "singles" | "doubles";
  // DI hooks for deterministic tests.
  lid?: string;
  slug?: string;
  now?: number;
}

/**
 * Create a DRAFT ladder (§7.4). Only the organizer GSI1 is projected up-front —
 * the city finder (GSI2) + slug resolver (GSI3) are projected on `publish`, so a
 * draft never leaks into public reads.
 */
export async function createLadder(input: CreateLadderInput): Promise<LadderItem> {
  const now = input.now ?? Date.now();
  const iso = new Date(now).toISOString();
  const lid = input.lid ?? ulid();
  const currency = (input.currency ?? "usd").toLowerCase();
  const slug = input.slug ?? `${slugify(input.title)}-${lid.slice(-6).toLowerCase()}`;
  const price = toStored(
    input.price
      ? "amount" in input.price
        ? money(input.price.amount, input.price.currency ?? currency)
        : input.price
      : money(0, currency),
  );

  const ladder: LadderItem = {
    ...ladderKeys.meta(lid),
    ...ladderGsi.byOrganizer(input.organizerId, input.startDate),
    entity: "LADDER",
    lid,
    title: input.title,
    slug,
    cityKey: input.cityKey,
    ...(input.courtId !== undefined ? { courtId: input.courtId } : {}),
    ...(input.venueName !== undefined ? { venueName: input.venueName } : {}),
    organizerId: input.organizerId,
    status: "draft",
    startDate: input.startDate,
    ...(input.description !== undefined ? { description: input.description } : {}),
    currency,
    feeMode: input.feeMode ?? "absorb",
    feePercentBps: input.feePercentBps ?? 0,
    feeFixed: input.feeFixed ?? 0,
    connectedAccountId: null,
    price,
    challengeRange: input.challengeRange ?? 3,
    responseWindowDays: input.responseWindowDays ?? 7,
    playMode: input.playMode ?? "singles",
    createdAt: iso,
    updatedAt: iso,
  };

  await putItem(asItem(ladder));
  return ladder;
}

// ── publish (CONNECT-GATED, §10) ──────────────────────────────────────────────

/**
 * Publish a ladder. **Connect-gated**: throws unless the organizer's Stripe Connect
 * account is `complete` (they can actually be paid). A ladder has no divisions, so
 * the only structural precondition is that the ladder itself exists. Stamps
 * `connectedAccountId` and projects the city-finder (GSI2) + slug (GSI3) keys so it
 * becomes publicly discoverable.
 */
export async function publishLadder(lid: string): Promise<LadderItem> {
  const ladder = await getLadderMeta(lid);
  if (!ladder) notFound(`Ladder not found: ${lid}`);

  const account = await getConnectAccount(ladder!.organizerId);
  if (!account || account.status !== "complete") {
    forbidden("Connect onboarding must be complete before you can publish (and be paid)");
  }

  const iso = new Date().toISOString();
  const g2 = ladderGsi.inCity(lid, ladder!.cityKey, ladder!.startDate);
  const g3 = ladderGsi.bySlug(ladder!.slug);
  const attrs = await updateItem({
    key: ladderKeys.meta(lid),
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
  return attrs as unknown as LadderItem;
}

// ── reads (pattern 22) ────────────────────────────────────────────────────────

/** META by id (GetItem). */
export async function getLadderMeta(lid: string): Promise<LadderItem | undefined> {
  return getItem<LadderItem>(ladderKeys.meta(lid));
}

/** Pattern 22 result — the whole ladder from ONE partition Query. */
export interface LadderDetail {
  ladder: LadderItem;
  rungs: RungItem[]; // rank-ordered (position asc, 1 = top)
  challenges: ChallengeItem[];
}

/**
 * Pattern 22 — a ladder + its rungs (rank-ordered) + challenges in ONE Query on
 * `PK=LADDER#<lid>` (META, RUNG#, CHALLENGE# all share the partition). Returns
 * `undefined` if the ladder doesn't exist.
 */
export async function getLadder(lid: string): Promise<LadderDetail | undefined> {
  const { items } = await query<LadderItem | RungItem | ChallengeItem>({
    pk: ladderKeys.meta(lid).pk,
  });
  const ladder = items.find((i) => i.sk === META) as LadderItem | undefined;
  if (!ladder) return undefined;
  const rungs = (items.filter((i): i is RungItem => i.entity === "RUNG")).sort(
    (a, b) => a.position - b.position,
  );
  const challenges = items.filter((i): i is ChallengeItem => i.entity === "CHALLENGE");
  return { ladder, rungs, challenges };
}

/** Resolve a published ladder's META by URL slug (GSI3). */
export async function getLadderBySlug(slug: string): Promise<LadderItem | undefined> {
  const { items } = await query<LadderItem>({
    index: GSI.bySlug,
    pk: ladderGsi.bySlug(slug).gsi3pk,
    skEquals: META,
    limit: 1,
  });
  return items[0];
}

/** Published ladders in a city (GSI2), soonest first. */
export async function getLaddersInCity(cityKey: string): Promise<LadderItem[]> {
  const { items } = await query<LadderItem>({
    index: GSI.byLocation,
    pk: ladderGsi.cityPk(cityKey),
    ascending: true,
  });
  return items.filter((l) => l.status === "published");
}

/**
 * My incoming challenges — ONE keyed GSI1 Query (`USER#<uid>` / `CHALLENGE#`). The
 * challenge row projects GSI1 keyed by the CHALLENGED uid, so this returns exactly
 * the challenges I need to respond to, ordered by due date.
 */
export async function getMyChallenges(uid: string): Promise<ChallengeItem[]> {
  const { items } = await query<ChallengeItem>({
    index: GSI.byOwner,
    pk: userKeys.profile(uid).pk,
    skBeginsWith: ladderKeys.challengePrefix(),
    ascending: true,
  });
  return items;
}

// ── rung helpers ──────────────────────────────────────────────────────────────

/** All rung rows for a ladder, rank-ordered (position asc). */
async function getRungs(lid: string): Promise<RungItem[]> {
  // queryAll: the FULL board seeds placement + whole-board reorders + payment lookups.
  // A page dropped at 1 MB would seed from a partial board and corrupt positions.
  const items = await queryAll<RungItem>({
    pk: ladderKeys.meta(lid).pk,
    skBeginsWith: ladderKeys.rungPrefix(),
  });
  return items.sort((a, b) => a.position - b.position);
}

/** A single challenge (GetItem; base key narrows to {pk, sk}). */
async function getChallenge(lid: string, cid: string): Promise<ChallengeItem | undefined> {
  return getItem<ChallengeItem>(ladderKeys.challenge(lid, cid, "", ""));
}

/**
 * Rewrite the whole rung board ATOMICALLY under an optimistic version guard. The read
 * of the current board, the `compute` of the new top→bottom uid order, and the write
 * of every RUNG#<pos> row + the META `rungsVersion` bump all commit in ONE transaction.
 * So two concurrent reorders (a DUPR seed racing a challenge re-rank, say) can't lose
 * an update: whoever bumps the version first wins; the loser's condition fails and it
 * retries off the winner's freshly-read board. `compute` returns the new order (with a
 * `byUid` payload map carrying each player's wins/losses/payment/rating), or `null` to
 * abort with no write. Positions are a dense 1..N permutation, so overwriting every
 * seat is idempotent — no stale rows.
 */
async function reorderBoard(
  lid: string,
  compute: (rungs: RungItem[]) => { order: string[]; byUid: Map<string, RungItem> } | null,
): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const meta = await getLadderMeta(lid);
    const version = meta?.rungsVersion ?? 0;
    const rungs = await getRungs(lid);
    const computed = compute(rungs);
    if (!computed) return; // nothing to do (e.g. an unrated seed stays where it was)
    const { order, byUid } = computed;
    const iso = new Date().toISOString();
    const rowFor = (uid: string, i: number): RungItem => ({
      ...byUid.get(uid)!,
      ...ladderKeys.rung(lid, i + 1),
      position: i + 1,
      updatedAt: iso,
    });

    // 1 META bump + N rung rows must fit the 100-item transaction limit. A board that
    // large is not realistic for a pickleball ladder; fall back to a best-effort
    // parallel rewrite rather than fail a legitimate operation on it.
    if (order.length + 1 > 100) {
      await Promise.all(order.map((uid, i) => putItem(asItem(rowFor(uid, i)))));
      return;
    }
    const tx: TransactItem[] = [
      txUpdate({
        key: ladderKeys.meta(lid),
        update: "SET rungsVersion = :next",
        condition: "attribute_not_exists(rungsVersion) OR rungsVersion = :cur",
        values: { ":next": version + 1, ":cur": version },
      }),
      ...order.map((uid, i) => txPut(asItem(rowFor(uid, i)))),
    ];
    try {
      await transactWrite(tx);
      return;
    } catch (err) {
      // Lost the version race — real DynamoDB cancels the whole transaction; the local
      // emulator surfaces the underlying condition failure. Either way, retry.
      if (
        err instanceof TransactionCanceledException ||
        err instanceof ConditionalCheckFailedException
      ) {
        continue;
      }
      throw err;
    }
  }
  throw new LadderError("Ladder standings are busy — please retry", 409);
}

/**
 * Race-safe append of a new rung at (or below) the bottom. Concurrent joins never
 * collide: the conditional `putNew` (attribute_not_exists on the position key)
 * makes each writer claim a distinct seat, retrying the next position on a clash —
 * the same "conditional write serializes the last-spot race" idea as tournaments.
 */
async function appendRung(lid: string, rung: Omit<RungItem, "pk" | "sk" | "position">): Promise<RungItem> {
  const existing = await getRungs(lid);
  let position = existing.length + 1;
  for (let attempt = 0; attempt < existing.length + 50; attempt++) {
    const item: RungItem = { ...rung, ...ladderKeys.rung(lid, position), position };
    try {
      await putNew(asItem(item));
      return item;
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) {
        position++;
        continue;
      }
      throw err;
    }
  }
  throw new LadderError("Could not place player on the ladder (position contention)", 409);
}

/**
 * DUPR-seed a freshly-paid player: insert them into the ESTABLISHED order at the
 * slot implied by their rating (higher rating ranks higher) WITHOUT reordering the
 * existing ladder — the ladder's order otherwise reflects match results, not
 * ratings. No-op when the player carries no rating (they simply stay at the bottom
 * where they were appended).
 */
async function seedByRating(lid: string, uid: string): Promise<void> {
  await reorderBoard(lid, (rungs) => {
    const self = rungs.find((r) => r.uid === uid);
    if (!self || self.rating === undefined) return null; // unrated ⇒ stays at the bottom
    const others = rungs.filter((r) => r.uid !== uid); // established order (position asc)
    let insertIndex = 0;
    while (insertIndex < others.length && (others[insertIndex].rating ?? -Infinity) >= self.rating) {
      insertIndex++;
    }
    const ordered = [...others.slice(0, insertIndex), self, ...others.slice(insertIndex)];
    return { order: ordered.map((r) => r.uid), byUid: new Map(rungs.map((r) => [r.uid, r])) };
  });
}

// ── register (join a ladder → Stripe Checkout) ────────────────────────────────

const ACTIVE_RUNG = new Set(["pending", "paid", "partiallyRefunded"]);

export interface RegisterLadderOptions {
  /** The player's rating, used to DUPR-seed their placement on payment. */
  rating?: number;
  customerEmail?: string;
}

export interface RegisterLadderResult {
  checkoutUrl: string;
  checkoutSessionId: string;
  paymentIntentId: string;
  amount: StoredMoney;
  applicationFee: StoredMoney;
}

/**
 * Join a ladder (§7.4, §10). Validates the ladder is published + payable, guards a
 * duplicate join, computes the exact fee split, appends a PENDING rung at the
 * bottom (carrying the rating so the webhook can DUPR-seed on payment), and starts
 * a destination-charge Checkout with `{kind:"ladder", lid, uid}` correlation
 * metadata. Returns `{ checkoutUrl }` — the caller redirects the browser to Stripe.
 */
export async function registerForLadder(
  lid: string,
  uid: string,
  opts: RegisterLadderOptions = {},
): Promise<RegisterLadderResult> {
  const ladder = await getLadderMeta(lid);
  if (!ladder) notFound(`Ladder not found: ${lid}`);
  if (ladder!.status !== "published") badRequest("This ladder is not open for registration");
  if (!ladder!.connectedAccountId) badRequest("This ladder is not connected to a payout account");

  // Duplicate guard: an active rung blocks a second join.
  const existing = (await getRungs(lid)).find((r) => r.uid === uid);
  if (existing && ACTIVE_RUNG.has(existing.paymentStatus)) {
    conflict("You are already on this ladder");
  }

  const breakdown = computeFees(money(ladder!.price.amount, ladder!.price.currency), feeConfigOf(ladder!));

  // Create the pending rung FIRST so the rating survives to the webhook; roll it back
  // if Checkout can't be started. On a REJOIN after a refund/cancel the player already
  // has a TERMINAL rung (refunded/cancelled passes the ACTIVE_RUNG guard above) —
  // REUSE that slot with a clean pending entry instead of appending a SECOND rung for
  // the same uid. A duplicate rung would make the webhook confirm against the OLD
  // terminal rung (its pending-flip fails, so the payment is silently dropped, money
  // captured with no receipt) and collapse in reorderBoard's by-uid Map, corrupting the
  // board (one uid written to two positions).
  const iso = new Date().toISOString();
  const profile = await getUserProfile(uid);
  const rungFields: Omit<RungItem, "pk" | "sk" | "position"> = {
    entity: "RUNG",
    lid,
    uid,
    ...(profile?.displayName ? { displayName: profile.displayName } : {}),
    ...(opts.rating !== undefined ? { rating: opts.rating } : {}),
    paymentStatus: "pending",
    wins: 0,
    losses: 0,
    createdAt: iso,
    updatedAt: iso,
  };
  let rung: RungItem;
  let claimedMember = false;
  if (existing) {
    // REJOIN: reuse the uid's existing (terminal) slot — keyed by its FIXED position, so
    // two concurrent rejoins converge on ONE row (last-write-wins, no duplication). A clean
    // pending entry that drops any stale refundedAmount / paymentIntentId from the old rung.
    rung = { ...ladderKeys.rung(lid, existing.position), position: existing.position, ...rungFields };
    await putItem(asItem(rung));
  } else {
    // FIRST-EVER JOIN. Claim a per-uid MEMBER marker atomically BEFORE appending. The
    // duplicate read above is non-atomic and RUNG rows are keyed by POSITION, so two
    // concurrent first-joins would each pass the read and appendRung would hand them two
    // DISTINCT positions → two rungs, two payable Checkout sessions, a double charge (M11).
    // The conditional putNew serializes them: exactly one claims the uid, the loser 409s.
    try {
      await putNew(asItem({ ...ladderKeys.member(lid, uid), entity: "LADDERMEMBER", lid, uid, createdAt: iso }));
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) conflict("You are already on this ladder");
      throw err;
    }
    claimedMember = true;
    try {
      rung = await appendRung(lid, rungFields);
    } catch (err) {
      await deleteItem(ladderKeys.member(lid, uid)).catch(() => {});
      throw err;
    }
  }

  // FREE ladder (total $0): a $0 Stripe Checkout session is REJECTED by real Stripe (its
  // ~$0.50 minimum), so a free ladder would 500 on every join in prod (M24). Skip Checkout
  // and fulfill the join immediately (mark the rung paid + DUPR-seed via confirmLadderPayment),
  // then return the success URL so the client's redirect lands on confirmation as usual.
  if (breakdown.total.amount <= 0) {
    try {
      await confirmLadderPayment({ lid, uid, amountTotal: 0, currency: ladder!.currency });
    } catch (err) {
      await deleteItem(ladderKeys.rung(lid, rung.position)).catch(() => {});
      if (claimedMember) await deleteItem(ladderKeys.member(lid, uid)).catch(() => {});
      throw err;
    }
    return {
      checkoutUrl: `${publicEnv.siteUrl}/ladders/${lid}?checkout=success`,
      checkoutSessionId: "",
      paymentIntentId: "",
      amount: toStored(breakdown.total),
      applicationFee: toStored(breakdown.applicationFee),
    };
  }

  let session;
  try {
    session = await getGateway().createCheckoutSession({
      connectedAccountId: ladder!.connectedAccountId!,
      lineItems: [{ name: `${ladder!.title} — Ladder entry`, unitAmount: breakdown.total, quantity: 1 }],
      applicationFee: breakdown.applicationFee,
      currency: ladder!.currency,
      metadata: { kind: "ladder", lid, uid },
      successUrl: `${publicEnv.siteUrl}/ladders/${lid}?checkout=success`,
      cancelUrl: `${publicEnv.siteUrl}/ladders/${lid}?checkout=cancel`,
      ...(opts.customerEmail ? { customerEmail: opts.customerEmail } : {}),
      clientReferenceId: `${lid}#${uid}`,
    });
  } catch (err) {
    // Roll the pending rung back so a failed Checkout leaves no orphan seat (and release the
    // uid marker for a first-join so a retry isn't permanently blocked).
    await deleteItem(ladderKeys.rung(lid, rung.position)).catch(() => {});
    if (claimedMember) await deleteItem(ladderKeys.member(lid, uid)).catch(() => {});
    throw err;
  }

  return {
    checkoutUrl: session.url,
    checkoutSessionId: session.id,
    paymentIntentId: session.paymentIntentId,
    amount: toStored(breakdown.total),
    applicationFee: toStored(breakdown.applicationFee),
  };
}

// ── webhook fulfilment (idempotent) ───────────────────────────────────────────

export interface ConfirmLadderPaymentInput {
  lid: string;
  uid: string;
  paymentIntentId?: string;
  amountTotal?: number; // minor units (from the Stripe object, cross-check only)
  currency?: string;
  receiptUrl?: string;
}

export interface ConfirmLadderPaymentResult {
  ok: boolean;
  alreadyPaid?: boolean;
  rung?: RungItem;
  payment?: PaymentItem;
}

/**
 * Mark a player's rung `paid`, DUPR-seed their placement, and write ONE durable
 * Payment. Called by the Stripe webhook after signature verify + event de-dupe.
 * Idempotent per rung: the CONDITIONAL flip (`paymentStatus = pending`) means
 * sibling events (checkout.session.completed AND payment_intent.succeeded) fulfil
 * at most once — the loser sees the rung already `paid` and skips the payment.
 */
export async function confirmLadderPayment(
  input: ConfirmLadderPaymentInput,
): Promise<ConfirmLadderPaymentResult> {
  const { lid, uid } = input;
  // Prefer the PAYABLE (pending) rung. Rejoins now reuse a single rung per uid, but if
  // a legacy duplicate exists, a refunded rung sorts lower by position and would
  // otherwise shadow the real pending one — dropping this payment.
  const rungs = await getRungs(lid);
  const rung =
    rungs.find((r) => r.uid === uid && r.paymentStatus === "pending") ??
    rungs.find((r) => r.uid === uid);
  if (!rung) return { ok: false };
  if (rung.paymentStatus === "paid") return { ok: true, alreadyPaid: true, rung };

  const iso = new Date().toISOString();
  let updated: RungItem;
  try {
    const attrs = await updateItem({
      key: ladderKeys.rung(lid, rung.position),
      update: "SET paymentStatus = :paid, updatedAt = :u",
      condition: "paymentStatus = :pending",
      values: { ":paid": "paid", ":pending": "pending", ":u": iso },
    });
    updated = (attrs as unknown as RungItem) ?? { ...rung, paymentStatus: "paid" };
  } catch (err) {
    // Lost the concurrent flip — another delivery already fulfilled this rung.
    if (err instanceof ConditionalCheckFailedException) {
      return { ok: true, alreadyPaid: true, rung };
    }
    throw err;
  }

  const ladder = await getLadderMeta(lid);
  const breakdown = ladder
    ? computeFees(money(ladder.price.amount, ladder.price.currency), feeConfigOf(ladder))
    : undefined;
  const currency = ladder?.currency ?? input.currency ?? "usd";
  const amount: StoredMoney = breakdown
    ? toStored(breakdown.total)
    : { amount: input.amountTotal ?? 0, currency };

  const payment = await writePayment({
    uid,
    // The ledger's WritePaymentInput union predates ladders; PaymentItem.kind
    // already supports "ladder" so the persisted receipt is correct.
    kind: "ladder" as unknown as WritePaymentInput["kind"],
    refId: lid,
    amount,
    ...(breakdown ? { applicationFee: toStored(breakdown.applicationFee) } : {}),
    paymentIntentId: input.paymentIntentId ?? "",
    status: "paid",
    ...(input.receiptUrl ? { receiptUrl: input.receiptUrl } : {}),
  });

  // Place the player: DUPR-seed by rating (no-op when unrated → stays at bottom).
  await seedByRating(lid, uid);
  const placed = (await getRungs(lid)).find((r) => r.uid === uid) ?? updated;

  // ⚙ payment_succeeded + registration_confirmed (§2.1) — emitted once, on the
  // winning conditional flip (a replayed sibling event returns `alreadyPaid`).
  const analyticsProps = {
    kind: "ladder" as const,
    refId: lid,
    amount: amount.amount,
    currency: amount.currency,
    paymentIntentId: input.paymentIntentId ?? "",
  };
  trackServerEvent(uid, "payment_succeeded", analyticsProps);
  trackServerEvent(uid, "registration_confirmed", analyticsProps);

  return { ok: true, rung: placed, payment };
}

export interface RefundLadderInput {
  lid: string;
  uid: string;
  amountRefunded?: number; // minor units
  currency?: string;
  paymentIntentId?: string; // matches the exact receipt (a ladder can be paid twice over rejoins)
}

/**
 * Reconcile a `charge.refunded` webhook for a ladder join: flip the rung to
 * refunded/partially-refunded and reconcile its Payment receipt. (The rung is kept
 * in place; a refunded player simply drops out of the active board in the UI.)
 */
export async function markLadderRefunded(input: RefundLadderInput): Promise<RungItem | undefined> {
  const { lid, uid } = input;
  const rung = (await getRungs(lid)).find((r) => r.uid === uid);
  if (!rung) return undefined;

  // Source the charged amount from the DURABLE Payment receipt — what was actually
  // captured — located by paymentIntentId. The live ladder price may have changed
  // since the player paid (so recomputing it misclassifies full vs partial), and
  // matching on refId alone can hit a stale receipt from an earlier join/refund cycle.
  const payments = await getMyPayments(uid);
  const pay =
    (input.paymentIntentId
      ? payments.find((p) => p.paymentIntentId === input.paymentIntentId)
      : undefined) ?? payments.find((p) => p.refId === lid);
  const charged = pay?.amount.amount ?? 0;
  const currency = pay?.amount.currency ?? input.currency ?? "usd";
  const refunded = input.amountRefunded ?? charged;
  const full = charged > 0 ? refunded >= charged : true;
  const iso = new Date().toISOString();

  const attrs = await updateItem({
    key: ladderKeys.rung(lid, rung.position),
    update: "SET paymentStatus = :s, updatedAt = :u",
    values: { ":s": full ? "refunded" : "partiallyRefunded", ":u": iso },
  });

  // Reconcile the durable Payment receipt located above.
  if (pay) {
    await updateItem({
      key: { pk: pay.pk, sk: pay.sk },
      update: "SET #st = :s, refundedAmount = :r",
      names: { "#st": "status" },
      values: {
        ":s": full ? "refunded" : "partiallyRefunded",
        ":r": { amount: refunded, currency } satisfies StoredMoney,
      },
    });
  }

  return (attrs as unknown as RungItem) ?? rung;
}

// ── challenge lifecycle: issue → respond → report → confirm → re-rank ──────────

/** Challenges that block a new one between the same pair (still in flight). */
const OPEN_CHALLENGE = new Set<ChallengeStatus>(["open", "accepted", "reported"]);

/** True iff the two challenges involve the same pair of players (either direction). */
function samePair(c: ChallengeItem, a: string, b: string): boolean {
  return (
    (c.challengerUid === a && c.challengedUid === b) ||
    (c.challengerUid === b && c.challengedUid === a)
  );
}

/**
 * Issue a challenge (§7.4). Validates eligibility with the PURE `canChallenge`
 * (target must be strictly ABOVE within `challengeRange`, never self), rejects a
 * duplicate active challenge between the pair, sets the response-window `dueDate`
 * (`dueDateFrom`), writes an `open` ChallengeItem (+ GSI1 so it lands in the
 * challenged player's inbox), and notifies the challenged player.
 */
export async function issueChallenge(
  lid: string,
  challengerUid: string,
  challengedUid: string,
  opts: { now?: number; cid?: string } = {},
): Promise<ChallengeItem> {
  if (challengerUid === challengedUid) badRequest("You cannot challenge yourself");
  const ladder = await getLadderMeta(lid);
  if (!ladder) notFound(`Ladder not found: ${lid}`);
  if (ladder!.status !== "published") badRequest("This ladder is not active");

  const rungs = await getRungs(lid);
  const challenger = rungs.find((r) => r.uid === challengerUid);
  const challenged = rungs.find((r) => r.uid === challengedUid);
  if (!challenger || challenger.paymentStatus !== "paid") {
    badRequest("You must be an active player on this ladder to challenge");
  }
  if (!challenged || challenged.paymentStatus !== "paid") {
    badRequest("That player is not an active player on this ladder");
  }

  if (
    !canChallenge({
      challengerPos: challenger!.position,
      challengedPos: challenged!.position,
      range: ladder!.challengeRange,
    })
  ) {
    badRequest(
      `You may only challenge a player above you within ${ladder!.challengeRange} rung(s)`,
    );
  }

  const active = (await getChallengesRaw(lid)).find(
    (c) => OPEN_CHALLENGE.has(c.status) && samePair(c, challengerUid, challengedUid),
  );
  if (active) conflict("An active challenge already exists between you two");

  const now = opts.now ?? Date.now();
  const iso = new Date(now).toISOString();
  const cid = opts.cid ?? ulid();
  const dueDate = dueDateFrom(iso, ladder!.responseWindowDays);

  const challenge: ChallengeItem = {
    ...ladderKeys.challenge(lid, cid, challengedUid, dueDate),
    entity: "CHALLENGE",
    lid,
    cid,
    challengerUid,
    challengedUid,
    challengerPos: challenger!.position,
    challengedPos: challenged!.position,
    status: "open",
    dueDate,
    createdAt: iso,
    updatedAt: iso,
  };
  await putItem(asItem(challenge));

  await createNotification(challengedUid, {
    type: "system",
    title: "You've been challenged",
    body: `${challenger!.displayName ?? "A player"} challenged you on ${ladder!.title}. Respond by ${dueDate.slice(0, 10)}.`,
    entityRef: `/ladders/${ladder!.slug}`,
  });

  return challenge;
}

/** Raw challenge rows for a ladder (single-partition Query). */
async function getChallengesRaw(lid: string): Promise<ChallengeItem[]> {
  const { items } = await query<ChallengeItem>({
    pk: ladderKeys.meta(lid).pk,
    skBeginsWith: ladderKeys.challengePrefix(),
  });
  return items;
}

/**
 * Respond to a challenge (§7.4). Only the challenged player may respond. THE ACCEPT
 * RACE: the transition is a CONDITIONAL update guarded on `status = "open"`, so when
 * two responses race (e.g. a double-tap or two devices) DynamoDB serializes them
 * and EXACTLY ONE wins — the loser's condition fails and is rejected (409). Notifies
 * the challenger of the outcome.
 */
export async function respondChallenge(
  lid: string,
  cid: string,
  uid: string,
  accept: boolean,
): Promise<ChallengeItem> {
  const challenge = await getChallenge(lid, cid);
  if (!challenge) notFound(`Challenge not found: ${cid}`);
  if (challenge!.challengedUid !== uid) {
    forbidden("Only the challenged player can respond to this challenge");
  }

  const next: ChallengeStatus = accept ? "accepted" : "declined";
  const iso = new Date().toISOString();
  let updated: ChallengeItem;
  try {
    const attrs = await updateItem({
      key: ladderKeys.challenge(lid, cid, "", ""),
      update: "SET #st = :next, updatedAt = :u",
      names: { "#st": "status" },
      condition: "#st = :open",
      values: { ":next": next, ":open": "open" satisfies ChallengeStatus, ":u": iso },
    });
    updated = (attrs as unknown as ChallengeItem) ?? { ...challenge!, status: next };
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      conflict("This challenge has already been responded to");
    }
    throw err;
  }

  const ladder = await getLadderMeta(lid);
  await createNotification(challenge!.challengerUid, {
    type: "system",
    title: accept ? "Challenge accepted" : "Challenge declined",
    body: accept
      ? "Your challenge was accepted — go play your match and report the result."
      : "Your challenge was declined.",
    ...(ladder ? { entityRef: `/ladders/${ladder.slug}` } : {}),
  });

  return updated!;
}

/**
 * Report a match result (§7.4). Either participant may report; the higher score
 * wins (ties are rejected). Records the scores, `reportedBy`, and `winnerUid`, and
 * moves the challenge to `reported` (a CONDITIONAL transition from `accepted` or a
 * prior `reported` — a re-report is how a disagreeing party CORRECTS the score, so
 * confirmation always ratifies the LATEST report). Notifies the OTHER party that a
 * confirmation is required.
 */
export async function reportChallengeResult(
  lid: string,
  cid: string,
  uid: string,
  scoreChallenger: number,
  scoreChallenged: number,
): Promise<ChallengeItem> {
  const challenge = await getChallenge(lid, cid);
  if (!challenge) notFound(`Challenge not found: ${cid}`);
  if (challenge!.challengerUid !== uid && challenge!.challengedUid !== uid) {
    forbidden("Only a participant can report this match");
  }
  if (scoreChallenger === scoreChallenged) badRequest("A ladder match cannot end in a tie");
  if (!Number.isFinite(scoreChallenger) || !Number.isFinite(scoreChallenged)) {
    badRequest("Scores must be numbers");
  }

  const winnerUid =
    scoreChallenger > scoreChallenged ? challenge!.challengerUid : challenge!.challengedUid;
  const iso = new Date().toISOString();

  let updated: ChallengeItem;
  try {
    const attrs = await updateItem({
      key: ladderKeys.challenge(lid, cid, "", ""),
      update:
        "SET #st = :reported, scoreChallenger = :sc, scoreChallenged = :sd, reportedBy = :by, winnerUid = :w, updatedAt = :u",
      names: { "#st": "status" },
      condition: "#st = :accepted OR #st = :reported",
      values: {
        ":reported": "reported" satisfies ChallengeStatus,
        ":accepted": "accepted" satisfies ChallengeStatus,
        ":sc": scoreChallenger,
        ":sd": scoreChallenged,
        ":by": uid,
        ":w": winnerUid,
        ":u": iso,
      },
    });
    updated = (attrs as unknown as ChallengeItem) ?? {
      ...challenge!,
      status: "reported",
      scoreChallenger,
      scoreChallenged,
      reportedBy: uid,
      winnerUid,
    };
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      badRequest("This challenge is not in a state that can be reported (accept it first)");
    }
    throw err;
  }

  const other = uid === challenge!.challengerUid ? challenge!.challengedUid : challenge!.challengerUid;
  const ladder = await getLadderMeta(lid);
  await createNotification(other, {
    type: "system",
    title: "Confirm your match result",
    body: "Your opponent reported a match result. Confirm it to finalize the ladder standings.",
    ...(ladder ? { entityRef: `/ladders/${ladder.slug}` } : {}),
  });

  return updated!;
}

/**
 * Confirm a reported result (§7.4) → BOTH-confirm handshake. The confirming player
 * must be the participant who did NOT report (the reporter cannot self-confirm; a
 * disagreeing player re-reports instead, see {@link reportChallengeResult}). A
 * CONDITIONAL transition `reported → confirmed` runs the re-rank exactly once:
 * `applyResult` moves the winner (challenger on an upset) up into the challenged's
 * rung and slides everyone between down one, wins/losses are tallied, and the RUNG#
 * rows are rewritten. Both players are notified.
 */
export async function confirmChallengeResult(
  lid: string,
  cid: string,
  uid: string,
): Promise<ChallengeItem> {
  const challenge = await getChallenge(lid, cid);
  if (!challenge) notFound(`Challenge not found: ${cid}`);
  if (challenge!.status !== "reported") {
    badRequest("There is no reported result to confirm");
  }
  if (challenge!.challengerUid !== uid && challenge!.challengedUid !== uid) {
    forbidden("Only a participant can confirm this match");
  }
  if (challenge!.reportedBy === uid) {
    badRequest("Waiting for the other player to confirm the result you reported");
  }

  const iso = new Date().toISOString();
  let updated: ChallengeItem;
  try {
    const attrs = await updateItem({
      key: ladderKeys.challenge(lid, cid, "", ""),
      update: "SET #st = :confirmed, confirmedBy = :by, updatedAt = :u",
      names: { "#st": "status" },
      condition: "#st = :reported",
      values: {
        ":confirmed": "confirmed" satisfies ChallengeStatus,
        ":reported": "reported" satisfies ChallengeStatus,
        ":by": uid,
        ":u": iso,
      },
    });
    updated = (attrs as unknown as ChallengeItem) ?? { ...challenge!, status: "confirmed", confirmedBy: uid };
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      conflict("This challenge has already been confirmed");
    }
    throw err;
  }

  // Apply the confirmed outcome to the board (re-rank + win/loss tally), once. If the
  // re-rank exhausts its retries it throws WITHOUT committing (each attempt's transaction
  // is all-or-nothing), so the board is unchanged — roll the status back to `reported` so
  // the confirm stays RETRYABLE. Without this, the challenge is stuck `confirmed` with the
  // upset never applied and every re-confirm 409s on the `#st = :reported` gate (M12).
  try {
    await applyOutcome(lid, challenge!, challenge!.winnerUid!);
  } catch (err) {
    await updateItem({
      key: ladderKeys.challenge(lid, cid, "", ""),
      update: "SET #st = :reported REMOVE confirmedBy",
      names: { "#st": "status" },
      condition: "#st = :confirmed",
      values: { ":reported": "reported" satisfies ChallengeStatus, ":confirmed": "confirmed" satisfies ChallengeStatus },
    }).catch(() => {});
    throw err;
  }

  // ⚙ match_played (§2.1) — a ladder challenge is a confirmed match once the
  // non-reporting participant confirms it (the conditional transition runs once).
  trackServerEvent(uid, "match_played", {
    kind: "ladder",
    lid,
    cid,
    winnerUid: challenge!.winnerUid,
  });

  const ladder = await getLadderMeta(lid);
  for (const p of [challenge!.challengerUid, challenge!.challengedUid]) {
    await createNotification(p, {
      type: "system",
      title: "Match confirmed",
      body: "The match result is confirmed and the ladder standings are updated.",
      ...(ladder ? { entityRef: `/ladders/${ladder.slug}` } : {}),
    });
  }

  return updated!;
}

/**
 * Apply a confirmed (or forfeited) outcome to the board: tally the winner's win +
 * loser's loss, run the PURE `applyResult` to compute the new rung order, and
 * rewrite the RUNG# rows. Idempotency is owned by the caller's conditional status
 * transition — this only ever runs on the single write that wins that transition.
 */
async function applyOutcome(lid: string, challenge: ChallengeItem, winnerUid: string): Promise<void> {
  await reorderBoard(lid, (rungs) => {
    const order = rungs.map((r) => r.uid);
    const byUid = new Map(rungs.map((r) => [r.uid, { ...r }]));

    const loserUid =
      winnerUid === challenge.challengerUid ? challenge.challengedUid : challenge.challengerUid;
    const winner = byUid.get(winnerUid);
    const loser = byUid.get(loserUid);
    if (winner) winner.wins += 1;
    if (loser) loser.losses += 1;

    const newOrder = applyResult(order, challenge.challengerUid, challenge.challengedUid, winnerUid);
    return { order: newOrder, byUid };
  });
}

/**
 * Sweep expired challenges (§7.4). Any `open` challenge whose response window has
 * elapsed (`isExpired`) becomes `expired` — a challenger forfeit-win — and the
 * board re-ranks accordingly (challenger moves up). Returns how many expired. Safe
 * to run repeatedly: the CONDITIONAL `open → expired` transition applies each
 * forfeit's re-rank exactly once.
 */
export async function expireChallenges(lid: string, nowIso: string): Promise<number> {
  const open = (await getChallengesRaw(lid)).filter(
    (c) => c.status === "open" && isExpired(c.dueDate, nowIso),
  );
  let expired = 0;
  for (const challenge of open) {
    try {
      await updateItem({
        key: ladderKeys.challenge(lid, challenge.cid, "", ""),
        update: "SET #st = :expired, winnerUid = :w, updatedAt = :u",
        names: { "#st": "status" },
        condition: "#st = :open",
        values: {
          ":expired": "expired" satisfies ChallengeStatus,
          ":open": "open" satisfies ChallengeStatus,
          ":w": challenge.challengerUid,
          ":u": nowIso,
        },
      });
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) continue; // already resolved
      throw err;
    }
    // Forfeit: the challenger wins by default → re-rank. If the re-rank exhausts retries it
    // throws WITHOUT committing, so roll the status back to `open` (retryable on the next
    // sweep) and skip rather than leave it stuck `expired` with the forfeit never applied (M12).
    try {
      await applyOutcome(lid, challenge, challenge.challengerUid);
    } catch {
      await updateItem({
        key: ladderKeys.challenge(lid, challenge.cid, "", ""),
        update: "SET #st = :open REMOVE winnerUid",
        names: { "#st": "status" },
        condition: "#st = :expired",
        values: { ":open": "open" satisfies ChallengeStatus, ":expired": "expired" satisfies ChallengeStatus },
      }).catch(() => {});
      continue;
    }
    await createNotification(challenge.challengedUid, {
      type: "system",
      title: "Challenge forfeited",
      body: "You didn't respond in time, so the challenge was forfeited.",
    });
    expired++;
  }
  return expired;
}
