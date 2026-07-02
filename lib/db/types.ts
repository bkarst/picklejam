/**
 * types.ts — typed entity models (PRD §9.3).
 *
 * Stage 0 fully types the entities the early stages read/write immediately:
 * the geo directory (country/state/city), courts (Stage 1 ingestion), and
 * users/ratings (Stage 2). Later stages add their own entity interfaces beside
 * their features. Every item extends `BaseItem` (keys + discriminator + stamps).
 */

// ── shared unions (mirror the seed vocab, §9.8) ─────────────────────────────

export type CourtAccess = "free" | "membership" | "one-time" | "reservation" | null;
export type FacilityType = "public" | "club" | "school" | "private" | null;
export type CourtLines = "permanent" | "temporary" | "tape" | "chalk" | null;
export type CourtNets = "permanent" | "portable" | "byo" | "tennis" | null;
export type Visibility = "public" | "unlisted" | "private";
export type JoinPolicy = "invite" | "request" | "open";
export type RatingSystem = "DUPR" | "UTRP" | "WPR" | "CTPR" | "SELF";
export type PhotoSource = "user" | "google-places" | string;

/** Denormalized aggregate counters (§9.4), reconciled by Streams. */
export interface Counts {
  /** Distinct court VENUES (COURT items) — the city H1 "N Best ... Courts" count. */
  locations?: number;
  /** Sum of physical courts across venues — "with N courts". */
  courts?: number;
  cities?: number;
  states?: number;
  games?: number;
  players?: number;
  groups?: number;
}

// ── base ────────────────────────────────────────────────────────────────────

export interface BaseItem {
  pk: string;
  sk: string;
  gsi1pk?: string;
  gsi1sk?: string;
  gsi2pk?: string;
  gsi2sk?: string;
  gsi3pk?: string;
  gsi3sk?: string;
  gsi4pk?: string;
  gsi4sk?: string;
  /** Entity discriminator for Stream routing + debugging. */
  entity: string;
  createdAt?: string;
  updatedAt?: string;
  /** Epoch-seconds TTL (only ephemeral items: anon tokens, stripe dedupe). */
  ttl?: number;
}

// ── geo directory ─────────────────────────────────────────────────────────

export interface CountryItem extends BaseItem {
  entity: "COUNTRY";
  code: string;
  name: string;
  counts?: Counts;
}

export interface StateItem extends BaseItem {
  entity: "STATE";
  country: string;
  code: string;
  name: string;
  slug: string;
  counts?: Counts;
}

export interface CityItem extends BaseItem {
  entity: "CITY";
  cityKey: string;
  name: string;
  slug: string;
  country: string;
  state: string;
  centroidLat?: number;
  centroidLng?: number;
  geohash?: string;
  nearbyCityKeys?: string[];
  counts?: Counts;
}

/** Day-bucketed metro check-in rollup (§9.4 CITYDAY). */
export interface CityDayItem extends BaseItem {
  entity: "CITYDAY";
  cityKey: string;
  day: string;
  checkinsCount: number;
  playerCount: number;
}

// ── court ─────────────────────────────────────────────────────────────────

export interface OpenPlayBlock {
  dayOfWeek: number; // 0–6
  start: string; // "HH:mm"
  end: string;
  skillMin?: number;
  skillMax?: number;
}

export interface CourtPhoto {
  url: string;
  source: PhotoSource;
  visible: boolean;
  attribution?: { url?: string; html?: string; name?: string };
}

export interface CourtItem extends BaseItem {
  entity: "COURT";

  // identity / geo
  courtId: string;
  name: string;
  slug: string;
  cityKey: string;
  cityId?: string;
  lat: number;
  lng: number;
  geohash: string;
  address?: string;

  // courts / play
  indoorCourts: number;
  outdoorCourts: number;
  totalCourts: number;
  hasPickleball: boolean;
  surface?: string[];
  lines?: CourtLines;
  nets?: CourtNets;
  amenities?: string[];
  lighted?: boolean;

  // access
  access?: CourtAccess;
  accessDetails?: string;
  hasReservations?: boolean;
  reservationUrl?: string;
  facilityType?: FacilityType;
  scheduleDetails?: string;
  /** Structured open-play, parsed from scheduleDetails at ingest where feasible (N13). */
  openPlay?: OpenPlayBlock[];

  // contact
  phone?: string;
  email?: string;
  website?: string;

  // media / content
  photos?: CourtPhoto[];
  photoKeys?: string[];
  description?: string;

  // computed / denormalized (§9.4)
  reviewCount?: number;
  ratingAvg?: number;
  checkinsTodayCount?: number;
  playerCount?: number;
  groupCount?: number;
  /** Games/outings ever held here (denormalized; Stage 4 populates via Streams). */
  gamesCount?: number;
  popularityRank?: number;
  /** Derived: nets=permanent ∧ lines=permanent (N8). */
  dedicated?: boolean;

  // provenance / lifecycle (§9.8)
  sourceId?: string;
  source?: string;
  hidden?: boolean;
  deleted?: boolean;
  scheduleSourcesUpdatedAt?: string | null;
  importedAt?: string;
  /** Whether the court clears the §14.4 content threshold (else `noindex`). */
  indexable?: boolean;
}

// ── user & ratings ──────────────────────────────────────────────────────────

export interface UserProfileItem extends BaseItem {
  entity: "USER";
  uid: string;
  username: string;
  displayName: string;
  gender?: string;
  homeCityKey?: string;
  homeCourtId?: string;
  avatarUrl?: string;
  visibility: Visibility;
  /** Check-in visibility (§6.2): public shows identity on court check-ins. */
  checkinVisibility?: "public" | "private";
  /** Whether the profile appears in people search (§6.3 privacy). */
  searchable?: boolean;
  defaultRatingSource?: RatingSystem;
  /** Onboarding (§13.8). */
  onboarded?: boolean;
  completedSteps?: string[];
  /** Notification prefs (§6.3 / §9.3): per-type × channel + quiet hours. */
  notifPrefs?: NotifPrefs;
  /** Emails opted out of notification mail (one-click unsubscribe → suppression). */
  unsubscribed?: string[];
}

// ── community graph (Stage 3, §6.2/§6.4/§9.3) ────────────────────────────────

/** Durable check-in (§6.2) — no presence TTL; "today" filters `checkinDay`. */
export interface CheckinItem extends BaseItem {
  entity: "CHECKIN";
  courtId: string;
  /** Null for anonymous check-ins (never identity-linked). */
  uid?: string | null;
  anonymous: boolean;
  note?: string;
  skill?: number;
  lookingToPlay?: boolean;
  /** Court-local yyyymmdd of the check-in (day bucket, §9.4). */
  checkinDay: string;
}

/** A court review (§6.4) — one per user per court (editable). */
export interface ReviewItem extends BaseItem {
  entity: "REVIEW";
  courtId: string;
  uid: string;
  rating1to5: number;
  title?: string;
  body?: string;
  tags?: string[];
  photoUrl?: string;
  helpfulCount?: number;
  /** True when the reviewer has a check-in at this court (§6.4 badge). */
  checkinVerified?: boolean;
}

/** A court follow (§6.1) — GSI1 projects the court's followers for fan-out. */
export interface FollowItem extends BaseItem {
  entity: "FOLLOW";
  uid: string;
  courtId: string;
}

/** Notification types (§9.3). */
export type NotificationType =
  | "new_game_at_followed_court"
  | "outing_rsvp"
  | "review_helpful"
  | "system";

export interface NotificationItem extends BaseItem {
  entity: "NOTIF";
  uid: string;
  type: NotificationType;
  title: string;
  body?: string;
  /** Deep-link target (e.g. a court/outing URL). */
  entityRef?: string;
  readAt?: string | null;
  channelsSent?: ("inapp" | "email")[];
}

/** Per-type × channel notification preferences + quiet hours (§6.3). */
export interface NotifPrefs {
  channels?: Partial<Record<NotificationType, { inapp?: boolean; email?: boolean }>>;
  /** Quiet-hours window in the user's local time, "HH:mm". */
  quietHours?: { start: string; end: string } | null;
}

/** Ephemeral anonymous browser token (§6.2) — TTL, never identity-linked. */
export interface AnonTokenItem extends BaseItem {
  entity: "ANON";
  token: string;
  lastCourtId?: string;
}

export interface RatingItem extends BaseItem {
  entity: "RATING";
  uid: string;
  system: RatingSystem;
  value: number;
  verified: boolean;
  source?: string;
}

// ── outings & RSVPs (Stage 4, §6.7/§9.3) ─────────────────────────────────────

export type OutingType = "open" | "private";
export type OutingHostType = "USER" | "GROUP";
export type RsvpStatus = "going" | "maybe" | "declined" | "waitlist";

/** An outing/game (§6.7). One-off or part of an RRULE series. */
export interface OutingItem extends BaseItem {
  entity: "OUTING";
  outingId: string;
  title: string;
  type: OutingType;
  hostType: OutingHostType;
  groupId?: string | null;
  courtId: string;
  cityKey: string;
  organizerId: string;
  startTs: string; // ISO
  endTs?: string;
  tz?: string;
  skillMin?: number;
  skillMax?: number;
  capacity?: number;
  waitlist?: boolean;
  seriesId?: string | null;
  rrule?: string | null;
  visibility: Visibility;
  description?: string;
  guestPolicy?: "none" | "allowed";
  /** Token for private-outing invite-link access (§6.7). */
  inviteToken?: string;
  /** Denormalized RSVP counts for list cards (reconciled by Streams). */
  goingCount?: number;
  waitlistCount?: number;
}

/** Court→outing pointer (OUTINGREF) — projects visibility/hostType/groupId so
 *  private meet-ups filter out of public court/city queries in one pass (§9.5). */
export interface OutingRefItem extends BaseItem {
  entity: "OUTINGREF";
  courtId: string;
  outingId: string;
  startTs: string;
  visibility: Visibility;
  hostType: OutingHostType;
  groupId?: string | null;
}

export interface RsvpItem extends BaseItem {
  entity: "RSVP";
  outingId: string;
  uid: string;
  status: RsvpStatus;
  waitlistPos?: number;
  guestCount?: number;
  respondedAt?: string;
}

/** Recurring-series master (§6.7 RRULE). */
export interface SeriesItem extends BaseItem {
  entity: "SERIES";
  seriesId: string;
  rrule: string;
  organizerId: string;
  courtId: string;
  cityKey: string;
  template?: Record<string, unknown>;
}

// ── Round-robin free tool (Stage 5, §6.8/§9.3, access pattern 16) ─────────────
//
// A NO-LOGIN tool: create + score work anonymously via a secret `creatorToken`
// (N2), and claiming later links the event to a signed-in user (organizerId +
// GSI1). Every event lives in ONE partition `RR#<eventId>`:
//   META        → RrEventItem    (event config snapshot + token + status)
//   ENTRANT#i   → RrEntrantItem  (one per competitor, index-ordered)
//   ROUND#r#META→ RrRoundItem    (round-level byes/label)
//   ROUND#r#MATCH#m → RrMatchItem(one per match, with scores)
//   STANDING#k  → RrStandingItem (materialized leaderboard, rank-ordered)
// so pattern 16 (event + entrants + rounds + matches + standings) is ONE Query.

import type {
  RrFormat,
  PlayMode,
  RrEventStatus,
  RrConfig,
  ScoringConfig,
  Side,
  MatchStatus,
} from "@/lib/roundrobin/types";
import type { FeeMode } from "@/lib/money";
import type { PaymentStatus, ConnectStatus } from "@/lib/stripe/types";

/**
 * RR event META. A superset of the UI-facing `RrEventMeta` plus the secret
 * `creatorToken`, a full `RrConfig` snapshot (so recordScore/advanceRound can
 * re-run the PURE engine — same seed ⇒ same schedule, §14.1), and a denormalized
 * `entrantCount`. Anonymous until claimed (`organizerId` set + GSI1 projected).
 */
export interface RrEventItem extends BaseItem {
  entity: "RREVENT";
  eventId: string;
  title: string;
  format: RrFormat;
  mode: PlayMode;
  status: RrEventStatus;
  dynamic: boolean;
  rngSeed: number;
  courts: number;
  scoring: ScoringConfig;
  /** Full engine config snapshot (includes entrants + rngSeed). */
  config: RrConfig;
  entrantCount: number;
  /** Secret token the anonymous creator holds to score/advance/claim (N2). */
  creatorToken: string;
  /** Present once claimed by a signed-in user (else anonymous). */
  organizerId?: string | null;
  championId?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** One competitor (SK `ENTRANT#<index>`, index-ordered). */
export interface RrEntrantItem extends BaseItem {
  entity: "RRENTRANT";
  eventId: string;
  /** Stable engine id (e.g. "e0"). */
  entrantId: string;
  /** 0-based position (drives SK ordering + seeding). */
  index: number;
  name: string;
  seed?: number;
  rating?: number;
}

/** Round-level row (SK `ROUND#<r>#META`) — byes + optional label. */
export interface RrRoundItem extends BaseItem {
  entity: "RRROUND";
  eventId: string;
  round: number; // 1-based
  byes: string[];
  label?: string;
}

/** One match (SK `ROUND#<r>#MATCH#<index>`) — scores land here on recordScore. */
export interface RrMatchItem extends BaseItem {
  entity: "RRMATCH";
  eventId: string;
  /** Stable engine id (e.g. "r1m0" or "QF1"). */
  matchId: string;
  round: number; // 1-based
  index: number; // 0-based within the round
  court?: number;
  sideA: Side;
  sideB: Side;
  scoreA?: number;
  scoreB?: number;
  winnerTo?: { matchId: string; slot: "A" | "B" } | null;
  loserTo?: { matchId: string; slot: "A" | "B" } | null;
  label?: string;
  status?: MatchStatus;
}

/** A materialized standings row (SK `STANDING#<rank>`, rank-ordered). Rebuilt
 *  wholesale on every score (Streams path in prod) so a replay is idempotent. */
export interface RrStandingItem extends BaseItem {
  entity: "RRSTANDING";
  eventId: string;
  entrantId: string;
  rank: number; // 1-based
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  byes: number;
  played: number;
}

// ── Tournaments + payments (Stage 6, PRD §7.1 / §10) ─────────────────────────
// A tournament lives in ONE partition `TOURNEY#<tid>`:
//   META            → TourneyItem       (meta + fee config + Connect account + status)
//   DIVISION#<did>  → DivisionItem      (price + capacity + skill/DUPR gate + counts)
//   REG#<did>#<uid> → RegistrationItem  (a player's entry + payment ledger column)
//   BRACKET#<did>#R..#M.. → BracketMatchItem
// so pattern 18 (tournament detail + divisions + regs) is ONE Query. Payments live
// under the payer (USER#<uid>/PAYMENT#) + a global STRIPEEVENT#<id> idempotency row.

/** Money stored flat on an item: integer minor units + ISO-4217 currency. */
export interface StoredMoney {
  amount: number; // minor units
  currency: string;
}

export type TourneyStatus = "draft" | "published" | "complete" | "cancelled";
export type ElimFormat = "single" | "double";

/** TOURNEY META (§7.1). Publishable only when Connect is complete + ≥1 division. */
export interface TourneyItem extends BaseItem {
  entity: "TOURNEY";
  tid: string;
  title: string;
  slug: string;
  cityKey: string;
  courtId?: string;
  venueName?: string;
  organizerId: string;
  status: TourneyStatus;
  startDate: string; // ISO date (yyyy-mm-dd) — drives GSI ordering
  endDate?: string;
  description?: string;
  currency: string;
  /** Platform fee model applied to every division (absorb vs pass-through). */
  feeMode: FeeMode;
  feePercentBps: number;
  feeFixed: number;
  /** The organizer's Connect account (funds destination). Required to publish. */
  connectedAccountId?: string | null;
  elim: ElimFormat;
  createdAt: string;
  updatedAt: string;
}

/** A division within a tournament (SK `DIVISION#<did>`). */
export interface DivisionItem extends BaseItem {
  entity: "DIVISION";
  tid: string;
  did: string;
  name: string;
  price: StoredMoney;
  capacity?: number;
  /** DUPR/skill gate (registration is blocked outside the range). */
  skillMin?: number;
  skillMax?: number;
  duprMin?: number;
  duprMax?: number;
  playMode: "singles" | "doubles";
  gender?: "mens" | "womens" | "mixed" | "open";
  /** Optional pre-created Stripe Price id (else a price_data line item). */
  stripePriceId?: string;
  /** Reconciled by the webhook/Stream on payment-confirmed (§9.4). */
  registeredCount: number;
  createdAt: string;
  updatedAt: string;
}

export type PartnerStatus = "none" | "pending" | "accepted" | "declined";

/** A registration row (SK `REG#<did>#<uid>`) + GSI1 (my registrations). The
 *  `paymentStatus` is the ledger column reconciled by the Stripe webhook. */
export interface RegistrationItem extends BaseItem {
  entity: "REGISTRATION";
  tid: string;
  did: string;
  uid: string;
  startDate: string;
  paymentStatus: PaymentStatus;
  /** Set once Checkout starts; the webhook correlates back via metadata. */
  checkoutSessionId?: string;
  paymentIntentId?: string;
  amount?: StoredMoney; // what the registrant was charged (total)
  applicationFee?: StoredMoney;
  /** Doubles: the partner and whether they've accepted (partner-pending, §10). */
  partnerUid?: string | null;
  partnerStatus?: PartnerStatus;
  /** Deferred-capture (waitlist): authorized but not yet captured. */
  authorizedNotCaptured?: boolean;
  refundedAmount?: StoredMoney;
  registeredAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** A bracket match (SK `BRACKET#<did>#R..#M..`) — the reusable bracket renderer. */
export interface BracketMatchItem extends BaseItem {
  entity: "BRACKETMATCH";
  tid: string;
  did: string;
  round: number;
  index: number;
  /** Entrant refs (uid, or a team id) — one per side (or empty until seeded). */
  sideA?: string[];
  sideB?: string[];
  scoreA?: number;
  scoreB?: number;
  winnerTo?: { matchId: string; slot: "A" | "B" } | null;
  label?: string;
  status?: MatchStatus;
}

/** A durable payment receipt (SK `PAYMENT#<ts>` under the payer). */
export interface PaymentItem extends BaseItem {
  entity: "PAYMENT";
  uid: string;
  ts: string;
  /** What this payment was for. */
  kind: "tournament" | "league";
  refId: string; // tid / lid
  divisionId?: string;
  amount: StoredMoney; // total charged
  applicationFee?: StoredMoney;
  paymentIntentId: string;
  status: PaymentStatus;
  receiptUrl?: string;
  refundedAmount?: StoredMoney;
  createdAt: string;
}

/** Stripe webhook idempotency marker (SK META, TTL). Presence ⇒ already processed. */
export interface StripeEventItem extends BaseItem {
  entity: "STRIPEEVENT";
  eventId: string; // evt_…
  type: string;
  processedAt: string;
  ttl?: number;
}

/** An organizer's Stripe Connect (Express) account (SK `CONNECT#META`). */
export interface ConnectAccountItem extends BaseItem {
  entity: "CONNECT";
  uid: string;
  accountId: string; // acct_…
  status: ConnectStatus;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  createdAt: string;
  updatedAt: string;
}
