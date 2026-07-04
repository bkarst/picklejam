/**
 * keys.ts — key builders for every §9.3 entity / §9.5 access pattern.
 *
 * Single-table design: entity type is encoded in `#`-delimited key prefixes.
 * Each builder returns the exact primary-key (and GSI-key) attributes for an
 * entity, so that every §9.5 read is a single `Query`/`GetItem` (no scans, no
 * joins). Numeric sort-key components are zero-padded so lexicographic ordering
 * matches numeric ordering (an implementation detail on top of the PRD notation).
 *
 * Round-trip parsers are provided for the slug/geo keys the SSG layer resolves.
 */

// ── primitives ──────────────────────────────────────────────────────────────

import { GEO_PARTITION_PRECISION } from "@/lib/geo/constants";

export const SEP = "#";
const META = "META";

/** Zero-pad a non-negative integer so string sort == numeric sort. */
export function pad(n: number, width = 4): string {
  return Math.trunc(n).toString().padStart(width, "0");
}

export interface PrimaryKey {
  pk: string;
  sk: string;
}
export interface Gsi1Key {
  gsi1pk: string;
  gsi1sk: string;
}
export interface Gsi2Key {
  gsi2pk: string;
  gsi2sk: string;
}
export interface Gsi3Key {
  gsi3pk: string;
  gsi3sk: string;
}
export interface Gsi4Key {
  gsi4pk: string;
  gsi4sk: string;
}

/** `<country>#<state>#<city>` — the canonical city key (PRD §9.8). */
export function cityKeyOf(country: string, state: string, city: string): string {
  return [country, state, city].join(SEP);
}

/** Split a `cityKey` back into its parts. */
export function parseCityKey(cityKey: string): {
  country: string;
  state: string;
  city: string;
} {
  const [country, state, city] = cityKey.split(SEP);
  return { country, state, city };
}

// ── User & ratings ──────────────────────────────────────────────────────────

export const userKeys = {
  /** USER/PROFILE (pattern: profile by uid). */
  profile: (uid: string): PrimaryKey => ({ pk: `USER${SEP}${uid}`, sk: "PROFILE" }),
  /** Public profile by username — GSI3 (§9.5 #12). */
  bySlug: (username: string): Gsi3Key => ({
    gsi3pk: `USERSLUG${SEP}${username}`,
    gsi3sk: META,
  }),
  /** A single rating row (§9.5 #13). */
  rating: (uid: string, system: string): PrimaryKey => ({
    pk: `USER${SEP}${uid}`,
    sk: `RATING${SEP}${system}`,
  }),
  /** Prefix to query all of a user's ratings. */
  ratingPrefix: (): string => `RATING${SEP}`,
  /** Court follow row + its GSI1 (court's followers). */
  followCourt: (uid: string, courtId: string): PrimaryKey & Gsi1Key => ({
    pk: `USER${SEP}${uid}`,
    sk: `FOLLOW${SEP}COURT${SEP}${courtId}`,
    gsi1pk: `COURT${SEP}${courtId}`,
    gsi1sk: `FOLLOWER${SEP}${uid}`,
  }),
} as const;

// ── Geo directory ───────────────────────────────────────────────────────────

export const geoKeys = {
  country: (c: string): PrimaryKey => ({ pk: `COUNTRY${SEP}${c}`, sk: META }),
  state: (c: string, st: string): PrimaryKey & Gsi2Key => ({
    pk: `STATE${SEP}${c}${SEP}${st}`,
    sk: META,
    gsi2pk: `COUNTRY${SEP}${c}`,
    gsi2sk: `STATE${SEP}${st}`,
  }),
  city: (c: string, st: string, city: string): PrimaryKey & Gsi2Key => ({
    pk: `CITY${SEP}${cityKeyOf(c, st, city)}`,
    sk: META,
    gsi2pk: `STATE${SEP}${c}${SEP}${st}`,
    gsi2sk: `CITY${SEP}${city}`,
  }),
  /** GSI2 PK to list all states in a country (§9.5 #7). */
  statesInCountry: (c: string): string => `COUNTRY${SEP}${c}`,
  /** GSI2 PK to list all cities in a state (§9.5 #7). */
  citiesInState: (c: string, st: string): string => `STATE${SEP}${c}${SEP}${st}`,
  /** Day-bucketed city check-in rollup (§9.4 CITYDAY). */
  cityDay: (cityKey: string, day: string): PrimaryKey => ({
    pk: `CITYDAY${SEP}${cityKey}`,
    sk: day,
  }),
} as const;

// ── Court ───────────────────────────────────────────────────────────────────

export const courtKeys = {
  meta: (courtId: string): PrimaryKey => ({ pk: `COURT${SEP}${courtId}`, sk: META }),
  /** GSI2 — courts in a city, ordered by popularityRank in the read layer (§9.5 #2). */
  inCity: (courtId: string, cityKey: string): Gsi2Key => ({
    gsi2pk: `CITY${SEP}${cityKey}`,
    gsi2sk: `COURT${SEP}${courtId}`,
  }),
  /** GSI2 PK to query all courts in a city. */
  cityCourtsPk: (cityKey: string): string => `CITY${SEP}${cityKey}`,
  /** GSI3 — court by URL slug (§9.5 #1). */
  bySlug: (cityKey: string, slug: string): Gsi3Key => ({
    gsi3pk: `COURTSLUG${SEP}${cityKey}${SEP}${slug}`,
    gsi3sk: META,
  }),
  courtSlugPk: (cityKey: string, slug: string): string =>
    `COURTSLUG${SEP}${cityKey}${SEP}${slug}`,
  /** GSI4 — geohash radius search (§9.5 #3, §9.7). prefix = geohash4, full = geohash9. */
  geo: (courtId: string, geohash: string): Gsi4Key => ({
    gsi4pk: `GEO${SEP}${geohash.slice(0, GEO_PARTITION_PRECISION)}`,
    gsi4sk: `${geohash}${SEP}${courtId}`,
  }),
  geoPk: (geohashPrefix: string): string => `GEO${SEP}${geohashPrefix}`,
  /** Review row + GSI1 (a user's reviews) (§9.5 #4, #6-adjacent). */
  review: (courtId: string, ts: string, uid: string): PrimaryKey & Gsi1Key => ({
    pk: `COURT${SEP}${courtId}`,
    sk: `REVIEW${SEP}${ts}${SEP}${uid}`,
    gsi1pk: `USER${SEP}${uid}`,
    gsi1sk: `REVIEW${SEP}${ts}`,
  }),
  reviewPrefix: (): string => `REVIEW${SEP}`,
  /**
   * One-per-user review at a STABLE key `REVIEW#<uid>` (Stage 3) so an edit
   * targets the SAME item — no `ts` in the SK means re-reviewing overwrites rather
   * than creating a duplicate row. GSI1 `USER#uid`/`REVIEW#<createdTs>` still
   * orders "my reviews" by recency; the base-table SK still begins with `REVIEW#`
   * so `reviewPrefix()` listing keeps working. `createdTs` is only needed on the
   * write (for GSI1 ordering); point ops (GetItem/Delete) narrow to `{pk,sk}`.
   */
  reviewByUser: (courtId: string, uid: string, createdTs = ""): PrimaryKey & Gsi1Key => ({
    pk: `COURT${SEP}${courtId}`,
    sk: `REVIEW${SEP}${uid}`,
    gsi1pk: `USER${SEP}${uid}`,
    gsi1sk: `REVIEW${SEP}${createdTs}`,
  }),
  /** Durable check-in row + GSI1 (my check-ins) (§9.5 #5, #6). uid null for anon. */
  checkin: (
    courtId: string,
    ts: string,
    id: string,
    uid?: string | null,
  ): PrimaryKey & Partial<Gsi1Key> => ({
    pk: `COURT${SEP}${courtId}`,
    sk: `CHECKIN${SEP}${ts}${SEP}${id}`,
    ...(uid ? { gsi1pk: `USER${SEP}${uid}`, gsi1sk: `CHECKIN${SEP}${ts}` } : {}),
  }),
  checkinPrefix: (): string => `CHECKIN${SEP}`,
  /** Group→court pointer (§9.5 #28: groups that play here). */
  groupAtCourt: (courtId: string, groupId: string): PrimaryKey => ({
    pk: `COURT${SEP}${courtId}`,
    sk: `GROUP${SEP}${groupId}`,
  }),
  groupsAtCourtPrefix: (): string => `GROUP${SEP}`,
  /** Outing→court pointer (OUTINGREF) for games-at-a-court (§9.5 #9). */
  outingRef: (courtId: string, startTs: string, outingId: string): PrimaryKey => ({
    pk: `COURT${SEP}${courtId}`,
    sk: `OUTING${SEP}${startTs}${SEP}${outingId}`,
  }),
  outingRefPrefix: (): string => `OUTING${SEP}`,
} as const;

/** Parse a `COURTSLUG#<c>#<st>#<city>#<slug>` GSI3 PK back to parts. */
export function parseCourtSlugPk(gsi3pk: string): {
  cityKey: string;
  slug: string;
} | null {
  const parts = gsi3pk.split(SEP);
  if (parts[0] !== "COURTSLUG" || parts.length < 5) return null;
  // COURTSLUG # c # st # city # slug
  const [, c, st, city, ...slugParts] = parts;
  return { cityKey: cityKeyOf(c, st, city), slug: slugParts.join(SEP) };
}

// ── Outings & RSVPs ─────────────────────────────────────────────────────────

export const outingKeys = {
  meta: (outingId: string): PrimaryKey => ({ pk: `OUTING${SEP}${outingId}`, sk: META }),
  /** GSI1 — organizer's outings (§9.5 #11). */
  byOrganizer: (organizerId: string, startTs: string): Gsi1Key => ({
    gsi1pk: `USER${SEP}${organizerId}`,
    gsi1sk: `OUTING${SEP}${startTs}`,
  }),
  /** GSI2 — city game finder for a court-local day (§9.5 #8). */
  cityGame: (cityKey: string, yyyymmdd: string, startTs: string, outingId: string): Gsi2Key => ({
    gsi2pk: `CITYGAME${SEP}${cityKey}${SEP}${yyyymmdd}`,
    gsi2sk: `${startTs}${SEP}${outingId}`,
  }),
  cityGamePk: (cityKey: string, yyyymmdd: string): string =>
    `CITYGAME${SEP}${cityKey}${SEP}${yyyymmdd}`,
  /** RSVP row + GSI1 (my RSVPs) (§9.5 #10, #11). */
  rsvp: (outingId: string, uid: string, startTs: string): PrimaryKey & Gsi1Key => ({
    pk: `OUTING${SEP}${outingId}`,
    sk: `RSVP${SEP}${uid}`,
    gsi1pk: `USER${SEP}${uid}`,
    gsi1sk: `RSVP${SEP}${startTs}`,
  }),
  rsvpPrefix: (): string => `RSVP${SEP}`,
  series: (seriesId: string): PrimaryKey => ({ pk: `SERIES${SEP}${seriesId}`, sk: META }),
} as const;

// ── Groups & clubs ──────────────────────────────────────────────────────────

export const groupKeys = {
  meta: (groupId: string): PrimaryKey => ({ pk: `GROUP${SEP}${groupId}`, sk: META }),
  byCreator: (creatorId: string, createdAt: string): Gsi1Key => ({
    gsi1pk: `USER${SEP}${creatorId}`,
    gsi1sk: `GROUP${SEP}${createdAt}`,
  }),
  /** GSI2 — city group finder (§9.5 #25). */
  inCity: (groupId: string, cityKey: string): Gsi2Key => ({
    gsi2pk: `GROUPLOC${SEP}${cityKey}`,
    gsi2sk: groupId,
  }),
  cityGroupsPk: (cityKey: string): string => `GROUPLOC${SEP}${cityKey}`,
  /** GSI3 — group by slug (§9.5 #24). */
  bySlug: (slug: string): Gsi3Key => ({ gsi3pk: `GROUPSLUG${SEP}${slug}`, gsi3sk: META }),
  groupSlugPk: (slug: string): string => `GROUPSLUG${SEP}${slug}`,
  /** Membership row + GSI1 (my groups) (§9.5 #26, #27). */
  member: (groupId: string, uid: string): PrimaryKey & Gsi1Key => ({
    pk: `GROUP${SEP}${groupId}`,
    sk: `MEMBER${SEP}${uid}`,
    gsi1pk: `USER${SEP}${uid}`,
    gsi1sk: `GROUPMEMBER${SEP}${groupId}`,
  }),
  memberPrefix: (): string => `MEMBER${SEP}`,
  myGroupsPrefix: (): string => `GROUPMEMBER${SEP}`,
  invite: (groupId: string, token: string): PrimaryKey => ({
    pk: `GROUP${SEP}${groupId}`,
    sk: `INVITE${SEP}${token}`,
  }),
  meetupRef: (groupId: string, startTs: string, outingId: string): PrimaryKey => ({
    pk: `GROUP${SEP}${groupId}`,
    sk: `MEETUP${SEP}${startTs}${SEP}${outingId}`,
  }),
  meetupPrefix: (): string => `MEETUP${SEP}`,
  /** COURT→GROUP pointer — "groups that play at a court" (§9.5 #28). */
  courtRef: (courtId: string, groupId: string): PrimaryKey => ({
    pk: `COURT${SEP}${courtId}`,
    sk: `GROUP${SEP}${groupId}`,
  }),
  courtGroupsPrefix: (): string => `GROUP${SEP}`,
} as const;

// ── Round robin (free tool) ─────────────────────────────────────────────────

export const rrKeys = {
  meta: (eventId: string): PrimaryKey => ({ pk: `RR${SEP}${eventId}`, sk: META }),
  /** GSI1 — a user's saved RR events (absent until claimed). */
  byOrganizer: (organizerId: string, createdAt: string): Gsi1Key => ({
    gsi1pk: `USER${SEP}${organizerId}`,
    gsi1sk: `RR${SEP}${createdAt}`,
  }),
  entrant: (eventId: string, eIdx: number): PrimaryKey => ({
    pk: `RR${SEP}${eventId}`,
    sk: `ENTRANT${SEP}${pad(eIdx)}`,
  }),
  entrantPrefix: (): string => `ENTRANT${SEP}`,
  round: (eventId: string, r: number): PrimaryKey => ({
    pk: `RR${SEP}${eventId}`,
    sk: `ROUND${SEP}${pad(r, 3)}${SEP}${META}`,
  }),
  match: (eventId: string, r: number, m: number): PrimaryKey => ({
    pk: `RR${SEP}${eventId}`,
    sk: `ROUND${SEP}${pad(r, 3)}${SEP}MATCH${SEP}${pad(m)}`,
  }),
  roundPrefix: (): string => `ROUND${SEP}`,
  standing: (eventId: string, rank: number): PrimaryKey => ({
    pk: `RR${SEP}${eventId}`,
    sk: `STANDING${SEP}${pad(rank)}`,
  }),
  standingPrefix: (): string => `STANDING${SEP}`,
} as const;

// ── Content & news ──────────────────────────────────────────────────────────

export const contentKeys = {
  meta: (id: string): PrimaryKey => ({ pk: `CONTENT${SEP}${id}`, sk: META }),
  /** GSI2 — category feed by recency (§9.5 #14). */
  inCategory: (category: string, publishedAt: string): Gsi2Key => ({
    gsi2pk: `CONTENTCAT${SEP}${category}`,
    gsi2sk: publishedAt,
  }),
  categoryPk: (category: string): string => `CONTENTCAT${SEP}${category}`,
  /** GSI3 — by URL slug within a category. */
  bySlug: (category: string, slug: string): Gsi3Key => ({
    gsi3pk: `CONTENTSLUG${SEP}${category}${SEP}${slug}`,
    gsi3sk: META,
  }),
  /** GSI1 — an author's articles. */
  byAuthor: (authorId: string, publishedAt: string): Gsi1Key => ({
    gsi1pk: `AUTHOR${SEP}${authorId}`,
    gsi1sk: publishedAt,
  }),
  authorPk: (authorId: string): string => `AUTHOR${SEP}${authorId}`,
  /** An author profile (E-E-A-T) — same partition as their GSI1 articles feed. */
  author: (authorId: string): PrimaryKey => ({ pk: `AUTHOR${SEP}${authorId}`, sk: META }),
  authorBySlug: (slug: string): Gsi3Key => ({ gsi3pk: `AUTHORSLUG${SEP}${slug}`, gsi3sk: META }),
} as const;

export const newsKeys = {
  meta: (id: string): PrimaryKey => ({ pk: `NEWS${SEP}${id}`, sk: META }),
  /** GSI2 — the global "all news" feed by recency (§9.5 #15). */
  allFeed: (publishedAt: string): Gsi2Key => ({
    gsi2pk: `NEWS${SEP}ALL`,
    gsi2sk: publishedAt,
  }),
  allFeedPk: (): string => `NEWS${SEP}ALL`,
  /** Lightweight per-topic pointer item (a news item can carry several topics). */
  topicPointer: (id: string, topic: string, publishedAt: string): PrimaryKey & Gsi2Key => ({
    pk: `NEWS${SEP}${id}`,
    sk: `TOPIC${SEP}${topic}`,
    gsi2pk: `NEWSTOPIC${SEP}${topic}`,
    gsi2sk: publishedAt,
  }),
  topicPk: (topic: string): string => `NEWSTOPIC${SEP}${topic}`,
  /** GSI3 — by slug. */
  bySlug: (slug: string): Gsi3Key => ({ gsi3pk: `NEWSSLUG${SEP}${slug}`, gsi3sk: META }),
  topicPointerPrefix: (): string => `TOPIC${SEP}`,
} as const;

/** Newsletter subscribers (§6.5/§6.6 capture). Keyed by lower-cased email. */
export const subscriberKeys = {
  byEmail: (email: string): PrimaryKey => ({
    pk: `SUBSCRIBER${SEP}${email.trim().toLowerCase()}`,
    sk: META,
  }),
} as const;

// ── Tournaments (paid) ──────────────────────────────────────────────────────

export const tourneyKeys = {
  meta: (tid: string): PrimaryKey => ({ pk: `TOURNEY${SEP}${tid}`, sk: META }),
  /** GSI2 — location finder (§9.5 #17). */
  inCity: (tid: string, cityKey: string, startDate: string): Gsi2Key => ({
    gsi2pk: `TOURNEYLOC${SEP}${cityKey}`,
    gsi2sk: `${startDate}${SEP}${tid}`,
  }),
  cityPk: (cityKey: string): string => `TOURNEYLOC${SEP}${cityKey}`,
  bySlug: (slug: string): Gsi3Key => ({ gsi3pk: `TOURNEYSLUG${SEP}${slug}`, gsi3sk: META }),
  byOrganizer: (organizerId: string, startDate: string): Gsi1Key => ({
    gsi1pk: `USER${SEP}${organizerId}`,
    gsi1sk: `TOURNEY${SEP}${startDate}`,
  }),
  division: (tid: string, did: string): PrimaryKey => ({
    pk: `TOURNEY${SEP}${tid}`,
    sk: `DIVISION${SEP}${did}`,
  }),
  /** Registration row + GSI1 (my registrations) (§9.5 #18, #19). */
  registration: (tid: string, did: string, uid: string, startDate: string): PrimaryKey & Gsi1Key => ({
    pk: `TOURNEY${SEP}${tid}`,
    sk: `REG${SEP}${did}${SEP}${uid}`,
    gsi1pk: `USER${SEP}${uid}`,
    gsi1sk: `REG${SEP}TOURNEY${SEP}${startDate}`,
  }),
  bracketMatch: (tid: string, did: string, r: number, m: number): PrimaryKey => ({
    pk: `TOURNEY${SEP}${tid}`,
    sk: `BRACKET${SEP}${did}${SEP}R${pad(r, 3)}${SEP}M${pad(m)}`,
  }),
} as const;

// ── Leagues & ladders (paid) — format ∈ {LEAGUE, LADDER} ─────────────────────

export const leagueKeys = {
  meta: (lid: string): PrimaryKey => ({ pk: `LEAGUE${SEP}${lid}`, sk: META }),
  inCity: (lid: string, cityKey: string, startDate: string): Gsi2Key => ({
    gsi2pk: `LEAGUELOC${SEP}${cityKey}`,
    gsi2sk: `${startDate}${SEP}${lid}`,
  }),
  cityPk: (cityKey: string): string => `LEAGUELOC${SEP}${cityKey}`,
  bySlug: (slug: string): Gsi3Key => ({ gsi3pk: `LEAGUESLUG${SEP}${slug}`, gsi3sk: META }),
  byOrganizer: (organizerId: string, startDate: string): Gsi1Key => ({
    gsi1pk: `USER${SEP}${organizerId}`,
    gsi1sk: `LEAGUE${SEP}${startDate}`,
  }),
  division: (lid: string, did: string): PrimaryKey => ({
    pk: `LEAGUE${SEP}${lid}`,
    sk: `DIVISION${SEP}${did}`,
  }),
  team: (lid: string, teamId: string): PrimaryKey => ({
    pk: `LEAGUE${SEP}${lid}`,
    sk: `TEAM${SEP}${teamId}`,
  }),
  registration: (lid: string, uid: string, startDate: string): PrimaryKey & Gsi1Key => ({
    pk: `LEAGUE${SEP}${lid}`,
    sk: `REG${SEP}${uid}`,
    gsi1pk: `USER${SEP}${uid}`,
    gsi1sk: `REG${SEP}LEAGUE${SEP}${startDate}`,
  }),
  scheduleMatch: (lid: string, week: number, mid: string): PrimaryKey => ({
    pk: `LEAGUE${SEP}${lid}`,
    sk: `WEEK${SEP}${pad(week, 3)}${SEP}MATCH${SEP}${mid}`,
  }),
  standing: (lid: string, did: string, rank: number): PrimaryKey => ({
    pk: `LEAGUE${SEP}${lid}`,
    sk: `STANDING${SEP}${did}${SEP}${pad(rank)}`,
  }),
  availability: (lid: string, uid: string, week: number): PrimaryKey => ({
    pk: `LEAGUE${SEP}${lid}`,
    sk: `AVAIL${SEP}${uid}${SEP}WEEK${SEP}${pad(week, 3)}`,
  }),
} as const;

export const ladderKeys = {
  meta: (lid: string): PrimaryKey => ({ pk: `LADDER${SEP}${lid}`, sk: META }),
  rung: (lid: string, position: number): PrimaryKey => ({
    pk: `LADDER${SEP}${lid}`,
    sk: `RUNG${SEP}${pad(position)}`,
  }),
  rungPrefix: (): string => `RUNG${SEP}`,
  /**
   * Per-uid membership marker. RUNG rows are keyed by POSITION, so a conditional
   * `putNew` on this uid-keyed row is what enforces one rung per uid across concurrent
   * first-joins (M11). Lives in the ladder partition; ignored by rung/challenge reads.
   */
  member: (lid: string, uid: string): PrimaryKey => ({
    pk: `LADDER${SEP}${lid}`,
    sk: `MEMBER${SEP}${uid}`,
  }),
  /** Challenge row + GSI1 (my incoming challenges) (§9.5 #22). */
  challenge: (lid: string, cid: string, challengedUid: string, dueDate: string): PrimaryKey & Gsi1Key => ({
    pk: `LADDER${SEP}${lid}`,
    sk: `CHALLENGE${SEP}${cid}`,
    gsi1pk: `USER${SEP}${challengedUid}`,
    gsi1sk: `CHALLENGE${SEP}${dueDate}`,
  }),
  challengePrefix: (): string => `CHALLENGE${SEP}`,
} as const;

// ── Payments, notifications & system ────────────────────────────────────────

export const paymentKeys = {
  payment: (uid: string, ts: string): PrimaryKey => ({
    pk: `USER${SEP}${uid}`,
    sk: `PAYMENT${SEP}${ts}`,
  }),
  /** Stripe webhook idempotency dedupe (§9.5 #23). */
  stripeEvent: (evtId: string): PrimaryKey => ({
    pk: `STRIPEEVENT${SEP}${evtId}`,
    sk: META,
  }),
  /** A user's payments list (GetItem/Query on the USER partition, PAYMENT# prefix). */
  paymentPrefix: (): string => `PAYMENT${SEP}`,
} as const;

/** Stripe Connect (Express) account — one reusable account per organizer. */
export const connectKeys = {
  account: (uid: string): PrimaryKey => ({ pk: `USER${SEP}${uid}`, sk: `CONNECT${SEP}${META}` }),
} as const;

export const notifKeys = {
  /** Notification row + GSI1 (my notifications, newest first). */
  notif: (uid: string, ts: string, id: string): PrimaryKey & Gsi1Key => ({
    pk: `USER${SEP}${uid}`,
    sk: `NOTIF${SEP}${ts}${SEP}${id}`,
    gsi1pk: `USER${SEP}${uid}`,
    gsi1sk: `NOTIF${SEP}${ts}`,
  }),
  notifPrefix: (): string => `NOTIF${SEP}`,
} as const;

export const systemKeys = {
  /** Ephemeral anonymous browser token (TTL). */
  anonToken: (token: string): PrimaryKey => ({ pk: `ANON${SEP}${token}`, sk: META }),
  /**
   * Per-(anon token, court, court-local day) check-in dedupe marker (TTL, §6.2).
   * Lives in the token's own partition so an anonymous check-in can be deduped +
   * burst-capped without a GSI (anon check-ins carry no uid). Stores NO PII — only
   * courtId/day and a pointer to the durable check-in row.
   */
  anonCheckin: (token: string, day: string, courtId: string): PrimaryKey => ({
    pk: `ANON${SEP}${token}`,
    sk: `CHECKIN${SEP}${day}${SEP}${courtId}`,
  }),
  /** Prefix to list an anon token's check-in markers for a day (dedupe + burst cap). */
  anonCheckinDayPrefix: (day: string): string => `CHECKIN${SEP}${day}${SEP}`,
} as const;

// ── Username uniqueness reservation (§9.5 #12, Stage 2) ──────────────────────

/**
 * A username-reservation row that makes username uniqueness race-safe. Its own
 * partition (`USERNAME#<username>` / `META`) lets a conditional `attribute_not_exists(pk)`
 * `Put` inside a `transactWrite` claim a username atomically alongside the
 * USER/PROFILE write — two users can never end up owning the same slug.
 */
export function usernameKey(username: string): PrimaryKey {
  return { pk: `USERNAME${SEP}${username}`, sk: META };
}

/** All key builders, grouped, for ergonomic imports + exhaustive round-trip tests. */
export const keys = {
  user: userKeys,
  geo: geoKeys,
  court: courtKeys,
  outing: outingKeys,
  group: groupKeys,
  rr: rrKeys,
  content: contentKeys,
  news: newsKeys,
  subscriber: subscriberKeys,
  tourney: tourneyKeys,
  league: leagueKeys,
  ladder: ladderKeys,
  payment: paymentKeys,
  connect: connectKeys,
  notif: notifKeys,
  system: systemKeys,
} as const;
