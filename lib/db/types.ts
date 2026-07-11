/**
 * types.ts — typed entity models (PRD §9.3).
 *
 * Stage 0 fully types the entities the early stages read/write immediately:
 * the geo directory (country/state/city), courts (Stage 1 ingestion), and
 * users/ratings (Stage 2). Later stages add their own entity interfaces beside
 * their features. Every item extends `BaseItem` (keys + discriminator + stamps).
 */

// Type-only imports — the gamification pure-logic layer owns the earn-rule + counter
// vocabularies; these are the single source of truth (no runtime dependency: erased).
import type { EarnRule, CapFamily } from "@/lib/gamify/earn-rules";
import type { Counters } from "@/lib/gamify/badges";

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
  /** Optional IANA timezone override (e.g. `America/New_York`). When absent, the court's
   *  local day is derived from lat/lng (see {@link courtLocalDay}). */
  tz?: string;

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
  /** Facility-quality score 0–100 from the "courts/play" setup fields ONLY
   *  (nets, lines, surface, capacity, amenities, lighting, indoor) — never reviews
   *  or check-ins. Computed at ingest via {@link courtFacilityScore}. */
  facilityScore?: number;
  /** 1–5 quality tier derived from {@link facilityScore} and GATED by {@link dedicated}:
   *  a non-dedicated (shared / converted) court is capped at tier 4. Sort/filter key. */
  facilityTier?: number;

  // gamification status (§G7 / §G13.7) — race-safe conditional-set claims + month-close writes
  /** First-ever authed check-in (Trailblazer, §G7.3). */
  trailblazerUid?: string;
  trailblazerAt?: string;
  /** First-ever review (First Reviewer, §G7.3). */
  firstReviewerUid?: string;
  /** This month's Court Captain, crowned at the previous month's close (§G7.2). */
  captainUid?: string;
  captainMonth?: string; // yyyymm the captaincy is FOR

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
  /** Mirrored from the auth token — where the notification email mirror is sent. */
  email?: string;
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
  /** Set when the check-in is for a specific event (group meet-up / outing, §6.7). */
  outingId?: string | null;
  /** Denormalized host group of an event check-in (the notification fan-out target). */
  groupId?: string | null;
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

/** Notification types (§9.3; gamification adds the G14 rail). */
export type NotificationType =
  | "new_game_at_followed_court"
  | "outing_rsvp"
  /** A player checked in for a group event (anonymous copy — never names the player). */
  | "outing_checkin"
  /** Pre-event "can you make it?" RSVP ask for an outing. */
  | "outing_reminder"
  | "review_helpful"
  | "system"
  // — gamification (§G14) —
  | "badge_awarded"
  | "level_up"
  | "quest_completed"
  | "court_captain"
  | "streak_at_risk"
  | "elite_status";

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
  /** Set when the attendee checked in for the event (they arrived at the court). */
  arrivedAt?: string;
}

/**
 * Pre-event RSVP reminder queue row (§6.7). Bucketed by UTC due-day
 * (`REMDAY#yyyy-mm-dd`) so the reminder job reads one partition per day — never
 * a scan. Recurring outings re-enqueue the next occurrence when processed.
 */
export interface OutingReminderItem extends BaseItem {
  entity: "OUTINGREM";
  outingId: string;
  /** The occurrence this reminder announces (ISO start). */
  occurrenceTs: string;
  /** When the reminder becomes due to send (ISO). */
  dueTs: string;
  /** Epoch-seconds expiry — unclaimed rows die instead of accumulating. */
  ttl: number;
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
  /** Organizer-uploaded photo/logo (cropped to an 800×800 square). */
  avatarUrl?: string;
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
  kind: "tournament" | "league" | "ladder";
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
  /** Set once, atomically, the first time the account reaches "complete" — the
   *  exactly-once marker for the `connect_onboarding_completed` analytics event. */
  onboardingCompletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Leagues, League Participation & Ladders (Stage 7, PRD §7.2–7.4) ───────────
// A league lives in ONE partition `LEAGUE#<lid>`:
//   META             → LeagueItem          (meta + fee config + Connect + season)
//   DIVISION#<did>   → LeagueDivisionItem  (flight price/capacity/skill gate)
//   TEAM#<teamId>    → LeagueTeamItem       (a registered team / partnership)
//   REG#<uid>        → LeagueRegistrationItem (a member's entry + payment ledger)
//   WEEK#<w>#MATCH#  → ScheduleMatchItem    (weekly fixtures + two-party scores)
//   STANDING#<did>#<rank> → LeagueStandingItem (materialized, rank-ordered)
//   AVAIL#<uid>#WEEK#<w>  → AvailabilityItem  (sub-pool availability)
// A ladder lives in `LADDER#<lid>`: META (LadderItem) + RUNG#<pos> (RungItem,
// rank-ordered) + CHALLENGE#<cid> (ChallengeItem, + GSI1 by challenged uid).

export type LeagueFormat = "league" | "ladder";
export type LeagueStatus = "draft" | "published" | "complete" | "cancelled";
/** A weekly fixture's two-party confirmation lifecycle (§7.3). */
export type MatchConfirmStatus = "scheduled" | "reported" | "confirmed" | "conflict";

/** LEAGUE META (§7.2). Publishable only when Connect is complete + ≥1 division. */
export interface LeagueItem extends BaseItem {
  entity: "LEAGUE";
  lid: string;
  title: string;
  slug: string;
  cityKey: string;
  courtId?: string;
  venueName?: string;
  organizerId: string;
  status: LeagueStatus;
  startDate: string; // ISO date — GSI ordering
  endDate?: string;
  seasonWeeks: number; // number of weekly rounds
  description?: string;
  /** Organizer-uploaded photo/logo (cropped to an 800×800 square). */
  avatarUrl?: string;
  currency: string;
  feeMode: FeeMode;
  feePercentBps: number;
  feeFixed: number;
  connectedAccountId?: string | null;
  playMode: "singles" | "doubles" | "team";
  createdAt: string;
  updatedAt: string;
}

/** A league division / flight (SK `DIVISION#<did>`). */
export interface LeagueDivisionItem extends BaseItem {
  entity: "LEAGUEDIVISION";
  lid: string;
  did: string;
  name: string;
  price: StoredMoney;
  capacity?: number;
  skillMin?: number;
  skillMax?: number;
  duprMin?: number;
  duprMax?: number;
  playMode: "singles" | "doubles" | "team";
  registeredCount: number;
  createdAt: string;
  updatedAt: string;
}

/** A registered team / partnership (SK `TEAM#<teamId>`). */
export interface LeagueTeamItem extends BaseItem {
  entity: "LEAGUETEAM";
  lid: string;
  teamId: string;
  did: string;
  name: string;
  memberUids: string[];
  createdAt: string;
  updatedAt: string;
}

/** A member's league registration (SK `REG#<uid>`) + GSI1 (my registrations). */
export interface LeagueRegistrationItem extends BaseItem {
  entity: "LEAGUEREG";
  lid: string;
  uid: string;
  did: string;
  startDate: string;
  teamId?: string | null;
  /** Solo entrant awaiting a partner from the free-agent pool (§7.2). */
  freeAgent?: boolean;
  partnerUid?: string | null;
  partnerStatus?: PartnerStatus;
  paymentStatus: PaymentStatus;
  checkoutSessionId?: string;
  paymentIntentId?: string;
  amount?: StoredMoney;
  applicationFee?: StoredMoney;
  authorizedNotCaptured?: boolean;
  refundedAmount?: StoredMoney;
  registeredAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** A weekly fixture (SK `WEEK#<w>#MATCH#<mid>`) with a two-party score confirm. */
export interface ScheduleMatchItem extends BaseItem {
  entity: "SCHEDULEMATCH";
  lid: string;
  did: string;
  week: number;
  mid: string;
  /** Entrant refs (teamId or uid) — one per side; empty ⇒ bye. */
  sideA?: string[];
  sideB?: string[];
  scoreA?: number;
  scoreB?: number;
  confirmStatus: MatchConfirmStatus;
  /** Two-party handshake: who reported, who confirmed (§7.3). */
  reportedBy?: string;
  confirmedBy?: string;
  playedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** A materialized league standings row (SK `STANDING#<did>#<rank>`). */
export interface LeagueStandingItem extends BaseItem {
  entity: "LEAGUESTANDING";
  lid: string;
  did: string;
  entrantId: string; // teamId or uid
  rank: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  played: number;
}

export type AvailabilityStatus = "in" | "out" | "sub";

/** A member's weekly availability / sub-pool flag (SK `AVAIL#<uid>#WEEK#<w>`). */
export interface AvailabilityItem extends BaseItem {
  entity: "AVAILABILITY";
  lid: string;
  uid: string;
  week: number;
  status: AvailabilityStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Ladders (§7.4) ───────────────────────────────────────────────────────────

export interface LadderItem extends BaseItem {
  entity: "LADDER";
  lid: string;
  title: string;
  slug: string;
  cityKey: string;
  courtId?: string;
  venueName?: string;
  organizerId: string;
  status: LeagueStatus;
  startDate: string;
  description?: string;
  /** Organizer-uploaded photo/logo (cropped to an 800×800 square). */
  avatarUrl?: string;
  currency: string;
  feeMode: FeeMode;
  feePercentBps: number;
  feeFixed: number;
  connectedAccountId?: string | null;
  price: StoredMoney;
  /** How many rungs above yourself you may challenge (§7.4). */
  challengeRange: number;
  /** Days a challenged player has to respond before forfeit (§7.4). */
  responseWindowDays: number;
  playMode: "singles" | "doubles";
  /** Optimistic-concurrency version for the rung board; bumped atomically with each
   *  full-board rewrite so concurrent reorders can't lose an update (§7.4). */
  rungsVersion?: number;
  createdAt: string;
  updatedAt: string;
}

/** A rung = a player's ranked position + their paid membership (SK `RUNG#<pos>`). */
export interface RungItem extends BaseItem {
  entity: "RUNG";
  lid: string;
  position: number; // 1 = top
  uid: string;
  displayName?: string;
  rating?: number;
  paymentStatus: PaymentStatus;
  wins: number;
  losses: number;
  createdAt: string;
  updatedAt: string;
}

export type ChallengeStatus =
  | "open" //       issued, awaiting the challenged player's response
  | "accepted" //   accepted, awaiting play + result
  | "declined"
  | "reported" //   a result was reported, awaiting the other party's confirm
  | "confirmed" //  both confirmed → re-rank applied
  | "expired"; //   response window elapsed with no response

/** A ladder challenge (SK `CHALLENGE#<cid>`) + GSI1 (my incoming challenges). */
export interface ChallengeItem extends BaseItem {
  entity: "CHALLENGE";
  lid: string;
  cid: string;
  challengerUid: string;
  challengedUid: string;
  challengerPos: number;
  challengedPos: number;
  status: ChallengeStatus;
  dueDate: string; // ISO — response/response-window deadline
  scoreChallenger?: number;
  scoreChallenged?: number;
  reportedBy?: string;
  confirmedBy?: string;
  winnerUid?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Groups & Clubs (Stage 8, PRD §6.9) ───────────────────────────────────────
// A group lives in ONE partition `GROUP#<groupId>`:
//   META            → GroupItem          (meta + visibility/joinPolicy + memberCount)
//   MEMBER#<uid>    → GroupMemberItem     (role + status; GSI1 = my groups)
//   INVITE#<token>  → GroupInviteItem     (invite, TTL)
//   MEETUP#<ts>#<id>→ (the Outing's MEETUP pointer, written by createOuting, §6.7)
// plus a COURT→GROUP pointer under `COURT#<courtId>` / SK `GROUP#<groupId>`
// (GroupCourtRefItem) so pattern 28 ("groups that play here") is one Query. The
// pointer PROJECTS `visibility` so a private group filters out of the public
// court/city rails in a single pass (§9.5 note).

export type GroupVisibility = "private" | "unlisted" | "public"; // default private (§6.9)
export type GroupJoinPolicy = "invite" | "request" | "open"; //     default invite
export type GroupMemberRole = "owner" | "admin" | "member";
export type GroupMemberStatus = "active" | "pending" | "invited";

/** GROUP META (§6.9). `noindex` unless visibility === "public". */
export interface GroupItem extends BaseItem {
  entity: "GROUP";
  groupId: string;
  name: string;
  slug: string;
  description?: string;
  cityKey: string;
  /** Primary court the group plays at (drives the home-court pointer + rail). */
  homeCourtId?: string;
  /** Any additional courts the group plays at (each gets a COURT→GROUP pointer). */
  courtIds?: string[];
  creatorId: string;
  visibility: GroupVisibility;
  joinPolicy: GroupJoinPolicy;
  avatarUrl?: string;
  /** Reconciled by Streams on MEMBER insert/remove (§9.4). */
  memberCount: number;
  /**
   * Cap on ACTIVE members (§6.9). Set at create (default 40, `DEFAULT_GROUP_MAX_MEMBERS`)
   * and editable in settings. Absent on legacy groups → the default applies. Enforced at
   * join / approve / invite-accept.
   */
  maxMembers?: number;
  createdAt: string;
  updatedAt: string;
}

/** A group membership (SK `MEMBER#<uid>`) + GSI1 (my groups). */
export interface GroupMemberItem extends BaseItem {
  entity: "GROUPMEMBER";
  groupId: string;
  uid: string;
  role: GroupMemberRole;
  status: GroupMemberStatus;
  joinedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** COURT→GROUP pointer (`PK=COURT#<courtId>`, SK `GROUP#<groupId>`), §9.5 #28.
 *  Projects `visibility` so private groups filter out of the public court rail. */
export interface GroupCourtRefItem extends BaseItem {
  entity: "GROUPCOURTREF";
  courtId: string;
  groupId: string;
  cityKey: string;
  visibility: GroupVisibility;
  createdAt: string;
}

/** A group invite (SK `INVITE#<token>`) — TTL-expiring (§14.6 invite TTL). */
export interface GroupInviteItem extends BaseItem {
  entity: "GROUPINVITE";
  groupId: string;
  token: string;
  invitedBy: string;
  email?: string;
  expiresAt: string; // ISO; `ttl` mirrors it in epoch-seconds for DynamoDB TTL
  createdAt: string;
}

// ── Content Hub + News (Stage 9, PRD §6.5/§6.6) ──────────────────────────────
// Evergreen guides + gear (CONTENT#) and dated news (NEWS#), DB-stored with a
// MARKDOWN body + structured fields (key-takeaways / FAQ / related-city CTA) so
// the render stays sanitized + component-free. Authors (AUTHOR#) carry E-E-A-T.
//   CONTENT#<id>/META  → ContentItem  (GSI2 category feed, GSI3 slug, GSI1 author)
//   AUTHOR#<id>/META   → AuthorItem   (their GSI1 partition holds their articles)
//   NEWS#<id>/META     → NewsItem     (GSI2 NEWS#ALL feed, GSI3 slug)
//   NEWS#<id>/TOPIC#<t>→ NewsTopicPointerItem (GSI2 NEWSTOPIC#<t>, a news item ∈ many topics)

export type PublishStatus = "draft" | "published";

/** A frequently-asked question rendered as an FAQPage entry. */
export interface FaqEntry {
  question: string;
  answer: string;
}

/** An evergreen guide/gear article (SK META). Body is trusted markdown. */
export interface ContentItem extends BaseItem {
  entity: "CONTENT";
  id: string;
  slug: string;
  category: string; // e.g. "guides", "gear", "rules"
  title: string;
  excerpt: string;
  /** Markdown body (rendered sanitized; headings drive the TOC). */
  body: string;
  keyTakeaways?: string[];
  faq?: FaqEntry[];
  authorId: string;
  authorName?: string; // denormalized for cards without a join
  /** Resolves to a real city page for the "related local" CTA (§12 rule 4). */
  relatedCityKey?: string;
  coverImage?: string;
  tags?: string[];
  readMinutes?: number;
  status: PublishStatus;
  publishedAt: string; // ISO — drives GSI2/GSI1 recency
  updatedAt: string;
  createdAt: string;
}

/** An author profile (E-E-A-T signals for the content). */
export interface AuthorItem extends BaseItem {
  entity: "AUTHOR";
  authorId: string;
  slug: string;
  name: string;
  bio?: string;
  avatarUrl?: string;
  /** Short credential line (e.g. "USAPA-certified coach"). */
  credentials?: string;
  socials?: { twitter?: string; instagram?: string; website?: string };
  createdAt: string;
  updatedAt: string;
}

/** A dated news article (SK META). Carries source attribution + topics. */
export interface NewsItem extends BaseItem {
  entity: "NEWS";
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string; // markdown
  /** Original source (attribution / NewsArticle). */
  source?: { name: string; url?: string };
  topics: string[];
  coverImage?: string;
  /** Related evergreen article ids (cross-link into the hub). */
  relatedContentIds?: string[];
  status: PublishStatus;
  publishedAt: string; // ISO — drives the GSI2 feeds
  updatedAt: string;
  createdAt: string;
}

/** A per-topic pointer (SK `TOPIC#<topic>`) so a news item joins many topic feeds. */
export interface NewsTopicPointerItem extends BaseItem {
  entity: "NEWSTOPIC";
  newsId: string;
  topic: string;
  slug: string;
  title: string;
  publishedAt: string;
}

/** A newsletter subscriber (§6.5/§6.6 capture). */
export interface SubscriberItem extends BaseItem {
  entity: "SUBSCRIBER";
  email: string;
  source?: string; // which page/CTA captured them
  confirmedAt?: string;
  createdAt: string;
}

// ── gamification layer (Gamification PRD §G13) ──────────────────────────────

/** Badge-driving tallies on the gamify profile (single source: lib/gamify/badges). */
export type GamifyCounters = Counters;

/** User gamification preferences (§G12.12). */
export interface GamifyPrefs {
  /** Master switch — hides every surface & silences the toaster (RP still accrues). */
  enabled: boolean;
  /** Streak-at-risk reminders (default OFF, §G8). */
  streakReminders: boolean;
  /** Weekly digest email. */
  digest: boolean;
  /** Appear on leaderboards (forced hidden for private profiles). */
  leaderboards: "public" | "hidden";
}

/** The per-user gamify aggregate (§G13.1) — created lazily on first earn (E24). */
export interface GamifyProfileItem extends BaseItem {
  entity: "GAMIFY";
  uid: string;
  /** Resolved IANA timezone (§G13.0) — self-heals from the browser. */
  tz?: string;
  /** Current balance (≥ 0 display floor). */
  rp: number;
  /** Lifetime RP (revocations subtract). */
  rpLifetime: number;
  /** max(rpLifetime) ever — levels never regress (§G5). */
  rpLevelWatermark: number;
  /** Derived level, denormalized for cards. */
  level: number;
  // — streak state machine (§G8.1/§G8.2) —
  streakWeeks: number;
  streakBest: number;
  streakPrev?: number;
  lastPlayedWeek?: string; // ISO week, user tz
  coveredWeek?: string;
  brokenAtWeek?: string;
  lastRepairWeek?: string;
  rainChecks: number; // 0–2
  counters: GamifyCounters;
  /** ≤ 3 pinned badge ids for the public showcase. */
  showcase?: string[];
  prefs: GamifyPrefs;
  /** Per-family daily cap windows, day-keyed (user tz); stale keys pruned by the sweep. */
  dailyEarn?: Record<string, Partial<Record<CapFamily, number>>>;
  /** Rolling month window (user tz) — dashboard, personal panel, group boards. */
  monthEarn?: { month: string; rp: number };
  eliteYears?: string[];
  createdAt: string;
  updatedAt: string;
}

/** An append-only, idempotent XP ledger row (§G13.2) — SK IS the deterministic sourceKey. */
export interface XpLedgerItem extends BaseItem {
  entity: "XP";
  uid: string;
  rule: EarnRule;
  points: number; // negative for revocations (#REV rows)
  sourceKey: string;
  refType?: "court" | "outing" | "tournament" | "league" | "ladder" | "group" | "rr" | "quest";
  refId?: string;
  label: string;
  ts: string;
  createdAt: string;
}

/** A tiered badge award (§G13.4) — one row per family, tier upgraded in place. */
export interface BadgeAwardItem extends BaseItem {
  entity: "BADGE";
  uid: string;
  familyId: string;
  tier: number; // 1–4; 0 = one-off special
  awardedAt: string;
  tierHistory: { tier: number; at: string }[];
}

/** A quest definition (§G13.5) — weekly / starter / community. */
export interface QuestItem extends BaseItem {
  entity: "QUEST";
  questId: string; // week-stamped for weeklies (§G9.1)
  kind: "weekly" | "starter" | "community";
  scope: "user" | string; // cityKey for community quests
  title: string;
  /** Typed predicate — which ledger rules / non-ledger ticks count, optional distinct dimension. */
  rule: { counts: string[]; distinctBy?: "courtId"; target: number };
  rewardRp: number;
  startTs: string;
  endTs: string;
  badgeId?: string;
  goal?: number; // community
  progress?: number; // community (atomic ADD)
  status: "active" | "closed";
}

/** Per-user quest progress (§G13.5). */
export interface QuestProgItem extends BaseItem {
  entity: "QUESTPROG";
  uid: string;
  questId: string;
  target: number;
  count: number;
  /** For `distinctBy` quests: the distinct dimension values seen (e.g. courtIds). */
  seen?: string[];
  completedAt?: string;
}

/** A leaderboard tally — atomic ADD per qualifying earn (§G13.6). */
export interface LbTallyItem extends BaseItem {
  entity: "LBTALLY";
  scope: "court" | "city";
  scopeId: string; // courtId | cityKey
  month: string; // yyyymm, scope-local (§G13.0)
  uid: string;
  value: number; // check-in days (court) | RP (city)
}

/** A materialized leaderboard rank row (§G13.6). */
export interface LbRankItem extends BaseItem {
  entity: "LBRANK";
  scope: "court" | "city";
  scopeId: string;
  month: string;
  rank: number;
  uid: string;
  value: number;
  movement?: number; // vs prior month, ± positions
  displayName: string; // denormalized (public profiles only)
  username?: string; // denormalized for the profile link (public profiles only)
  avatarUrl?: string;
  level?: number;
}

/** A board partition's rebuild-gate META (§G13.6). */
export interface LbBoardMetaItem extends BaseItem {
  entity: "LBMETA";
  scopeId: string;
  month: string;
  floor: number; // lowest ranked value — the rebuild gate
  rankCount: number;
  version: number; // optimistic concurrency for rebuilds
  frozen?: boolean; // admin freeze (§G16)
  frozenBy?: string; // admin uid — audit trail (§G16.6c)
  frozenAt?: string;
  /** The month's Court Captain, recorded at month-close (§G7.2) — powers captain history. */
  captainUid?: string;
  captainName?: string; // denormalized (public captains only)
  captainUsername?: string;
  captainAvatarUrl?: string;
}

/** An Elite roster / nomination row (§G13.7). */
export interface EliteAwardItem extends BaseItem {
  entity: "ELITEAWARD";
  year: string;
  uid: string;
  status: "nominated" | "approved" | "rejected";
  nominatedAt: string;
  decidedAt?: string;
  decidedBy?: string;
}

/** A moderation strike (§G13.7) — behind the Elite "zero strikes" criterion. */
export interface StrikeItem extends BaseItem {
  entity: "STRIKE";
  uid: string;
  reason: string;
  refType?: string;
  refId?: string;
  issuedBy: string;
  ts: string;
  expiresAt?: string;
}
