/**
 * users.ts — read repositories + authorized write helpers for the profile &
 * ratings data spine (PRD §6.3, §9.5 #12 & #13).
 *
 * Every read is ONE `Query`/`GetItem` (no scans, no joins). Username uniqueness
 * is race-safe: a dedicated `USERNAME#<username>` reservation row is claimed with
 * a conditional `Put` inside a `transactWrite` alongside the USER/PROFILE write,
 * so two accounts can never own the same slug (see {@link putProfileWithUsername}).
 */

import {
  getItem,
  query,
  putItem,
  updateItem,
  deleteItem,
  transactWrite,
  txPut,
  txDelete,
  type TransactItem,
} from "@/lib/db/client";
import { GSI } from "@/lib/db/table";
import { userKeys, usernameKey } from "@/lib/db/keys";
import { slugify } from "@/lib/util/slug";
import { emitInsert } from "@/lib/streams/inline";
import type { AuthedUser } from "@/lib/auth/verify";
import type {
  UserProfileItem,
  RatingItem,
  RatingSystem,
  Visibility,
  NotifPrefs,
} from "@/lib/db/types";

// ── reads (one query/getItem each) ───────────────────────────────────────────

/** The caller's profile by uid (GetItem on `USER#<uid>`/`PROFILE`). */
export async function getUserProfile(
  uid: string,
  opts?: { consistentRead?: boolean },
): Promise<UserProfileItem | undefined> {
  return getItem<UserProfileItem>(userKeys.profile(uid), opts);
}

/** #12 — public profile by username (GSI3), one Query. */
export async function getUserByUsername(username: string): Promise<UserProfileItem | undefined> {
  const { items } = await query<UserProfileItem>({
    index: GSI.bySlug,
    pk: userKeys.bySlug(username).gsi3pk,
    skEquals: "META",
    limit: 1,
  });
  return items[0];
}

/** #13 — all of a user's ratings (one Query on the base table). */
export async function getUserRatings(uid: string): Promise<RatingItem[]> {
  const { items } = await query<RatingItem>({
    pk: userKeys.profile(uid).pk,
    skBeginsWith: userKeys.ratingPrefix(),
  });
  return items;
}

// ── username uniqueness ──────────────────────────────────────────────────────

/** The persisted reservation row shape (its own `USERNAME#<username>` partition). */
export interface UsernameReservationItem {
  pk: string;
  sk: string;
  entity: "USERNAME";
  username: string;
  uid: string;
  createdAt?: string;
}

/** Fetch the reservation row for a username (GetItem), if any. */
export async function getUsernameReservation(
  username: string,
): Promise<UsernameReservationItem | undefined> {
  return getItem<UsernameReservationItem>(usernameKey(username));
}

/**
 * Pure decision: does an existing reservation (or its absence) permit `forUid` to
 * use the username? Available when unclaimed, or when the claim already belongs
 * to `forUid` (so editing your own profile without changing your username is a
 * no-op). Extracted so it can be unit-tested without a database.
 */
export function reservationAllows(
  reservation: Pick<UsernameReservationItem, "uid"> | undefined,
  forUid?: string,
): boolean {
  if (!reservation) return true;
  return forUid !== undefined && reservation.uid === forUid;
}

/** Whether `username` is free (or already owned by `forUid`). */
export async function isUsernameAvailable(username: string, forUid?: string): Promise<boolean> {
  const existing = await getUsernameReservation(username);
  return reservationAllows(existing, forUid);
}

/** Thrown when a username reservation conditional fails → HTTP 409 at the edge. */
export class UsernameTakenError extends Error {
  constructor(public readonly username: string) {
    super(`Username "${username}" is taken`);
    this.name = "UsernameTakenError";
  }
}

/** True if a DynamoDB error is a conditional-check failure (single op or transaction). */
function isConditionalFailure(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { name?: string; CancellationReasons?: Array<{ Code?: string } | null> };
  if (e.name === "ConditionalCheckFailedException") return true;
  if (e.name === "TransactionCanceledException") {
    return (e.CancellationReasons ?? []).some((r) => r?.Code === "ConditionalCheckFailed");
  }
  return false;
}

function reservationItem(username: string, uid: string): UsernameReservationItem {
  return {
    ...usernameKey(username),
    entity: "USERNAME",
    username,
    uid,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Create or update a profile with a race-safe username reservation.
 *
 * - When the username is unchanged (`oldUsername === profile.username`), a plain
 *   `Put` suffices — no reservation churn.
 * - Otherwise a `transactWrite` atomically (a) claims the new reservation with
 *   `attribute_not_exists(pk)`, (b) writes the USER/PROFILE item (carrying its
 *   `USERSLUG#` GSI3 projection), and (c) deletes the OLD reservation when the
 *   username actually changed. A failed conditional throws {@link UsernameTakenError}.
 */
export async function putProfileWithUsername(
  profile: UserProfileItem,
  oldUsername?: string,
): Promise<void> {
  const changed = oldUsername === undefined || oldUsername !== profile.username;
  if (!changed) {
    await putItem(profile as unknown as Record<string, unknown>);
    return;
  }

  const isCreate = oldUsername === undefined;
  const items: TransactItem[] = [
    txPut(
      reservationItem(profile.username, profile.uid) as unknown as Record<string, unknown>,
      "attribute_not_exists(pk)",
    ),
    // On a first-time CREATE, guard the PROFILE row with `attribute_not_exists(pk)` too (L14):
    // a concurrent first-access for the SAME uid must not create a second profile pointing at a
    // second reservation — the losing call's reservation would be orphaned (a permanently-dead
    // handle). The whole transaction fails atomically if EITHER row already exists. An EDIT that
    // changes the username (oldUsername defined) legitimately overwrites the existing profile.
    isCreate
      ? txPut(profile as unknown as Record<string, unknown>, "attribute_not_exists(pk)")
      : txPut(profile as unknown as Record<string, unknown>),
  ];
  // On a real change (not first-time create), release the previously-held slug.
  if (oldUsername !== undefined && oldUsername !== profile.username) {
    items.push(txDelete(usernameKey(oldUsername)));
  }

  try {
    await transactWrite(items);
  } catch (err) {
    if (isConditionalFailure(err)) throw new UsernameTakenError(profile.username);
    throw err;
  }
}

// ── profile construction ─────────────────────────────────────────────────────

/** The editable + system fields that fully describe a profile item. */
export interface ProfileInput {
  uid: string;
  username: string;
  displayName: string;
  gender?: string;
  homeCityKey?: string;
  homeCourtId?: string;
  avatarUrl?: string;
  visibility: Visibility;
  defaultRatingSource?: RatingSystem;
  onboarded?: boolean;
  completedSteps?: string[];
  /**
   * Side-channel fields that OTHER subsystems write onto the same PROFILE item via
   * partial `updateItem`s (notification prefs, the unsubscribe suppression list, and
   * check-in visibility). They are NOT edited here, but a profile edit does a full
   * `Put`, so they must be carried through or they get silently wiped — resurrecting a
   * one-click unsubscribe is a CAN-SPAM / RFC 8058 compliance failure.
   */
  notifPrefs?: NotifPrefs;
  unsubscribed?: string[];
  checkinVisibility?: "public" | "private";
  /** Preserve the original create timestamp across updates. */
  createdAt?: string;
}

/** Build a fully-keyed USER/PROFILE item (base key + USERSLUG# GSI3 projection). */
export function buildProfileItem(input: ProfileInput): UserProfileItem {
  const now = new Date().toISOString();
  return {
    ...userKeys.profile(input.uid),
    ...userKeys.bySlug(input.username),
    entity: "USER",
    uid: input.uid,
    username: input.username,
    displayName: input.displayName,
    visibility: input.visibility,
    ...(input.gender !== undefined ? { gender: input.gender } : {}),
    ...(input.homeCityKey !== undefined ? { homeCityKey: input.homeCityKey } : {}),
    ...(input.homeCourtId !== undefined ? { homeCourtId: input.homeCourtId } : {}),
    ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
    ...(input.defaultRatingSource !== undefined
      ? { defaultRatingSource: input.defaultRatingSource }
      : {}),
    ...(input.onboarded !== undefined ? { onboarded: input.onboarded } : {}),
    ...(input.completedSteps !== undefined ? { completedSteps: input.completedSteps } : {}),
    // Preserve side-channel fields owned by other subsystems (see ProfileInput) so a
    // full-Put profile edit never wipes notif prefs / the unsubscribe list / check-in
    // visibility.
    ...(input.notifPrefs !== undefined ? { notifPrefs: input.notifPrefs } : {}),
    ...(input.unsubscribed !== undefined ? { unsubscribed: input.unsubscribed } : {}),
    ...(input.checkinVisibility !== undefined ? { checkinVisibility: input.checkinVisibility } : {}),
    createdAt: input.createdAt ?? now,
    updatedAt: now,
  };
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 7);
}

/** Find a free username starting from `base`, appending `-2`, `-3`, … as needed. */
export async function generateUniqueUsername(base: string): Promise<string> {
  const root = slugify(base) || "player";
  let candidate = root;
  let n = 1;
  // Bounded probing; the reservation conditional is the real uniqueness guard.
  while (n < 50 && !(await isUsernameAvailable(candidate))) {
    n += 1;
    candidate = `${root}-${n}`;
  }
  return candidate;
}

/**
 * Fetch the caller's profile, creating a minimal public one on first access
 * (§13.8): a unique username derived from the token name/email, displayName from
 * the token, visibility `public`, `onboarded:false`.
 */
export async function getOrCreateProfile(user: AuthedUser): Promise<UserProfileItem> {
  const existing = await getUserProfile(user.uid);
  if (existing) return existing;

  const base = user.name ?? user.email?.split("@")[0] ?? "player";
  for (let attempt = 0; attempt < 5; attempt++) {
    const username =
      attempt === 0
        ? await generateUniqueUsername(base)
        : `${slugify(base) || "player"}-${randomSuffix()}`;
    const profile = buildProfileItem({
      uid: user.uid,
      username,
      displayName: user.name ?? user.email ?? "Player",
      visibility: "public",
      onboarded: false,
    });
    try {
      await putProfileWithUsername(profile); // create (create-only: reservation + profile)
      // Emit the profile INSERT so the §9.4 aggregator runs (inline in dev/CI; the real
      // Streams Lambda in prod). The new profile has no homeCityKey yet, so this attributes
      // no player until onboarding sets the city (a MODIFY the PUT route emits, M14).
      await emitInsert(profile as unknown as Record<string, unknown>);
      return profile;
    } catch (err) {
      if (err instanceof UsernameTakenError) {
        // A conditional failed. Either a CONCURRENT first-access for THIS uid already created
        // the profile — return the winner's profile (never leak a second reservation, L14) — or
        // the username was taken by a DIFFERENT uid, in which case retry with a fresh suffix. A
        // strongly-consistent read distinguishes the two without racing the winner's commit.
        const winner = await getUserProfile(user.uid, { consistentRead: true });
        if (winner) return winner;
        continue; // username taken by someone else → retry with a suffix
      }
      throw err;
    }
  }
  throw new Error("Could not allocate a unique username");
}

// ── ratings ──────────────────────────────────────────────────────────────────

/** The rating systems (§9.3), in default-preference order (verified DUPR first). */
export const RATING_SYSTEMS: readonly RatingSystem[] = ["DUPR", "UTRP", "WPR", "CTPR", "SELF"];

/** Runtime guard for the `RatingSystem` union (validates untrusted request bodies). */
export function isRatingSystem(x: unknown): x is RatingSystem {
  return typeof x === "string" && (RATING_SYSTEMS as readonly string[]).includes(x);
}

/** Build a RATING#<system> item. Self-entered ratings are `verified:false`. */
export function buildRatingItem(input: {
  uid: string;
  system: RatingSystem;
  value: number;
  verified: boolean;
  source?: string;
  createdAt?: string;
}): RatingItem {
  const now = new Date().toISOString();
  return {
    ...userKeys.rating(input.uid, input.system),
    entity: "RATING",
    uid: input.uid,
    system: input.system,
    value: input.value,
    verified: input.verified,
    ...(input.source !== undefined ? { source: input.source } : {}),
    createdAt: input.createdAt ?? now,
    updatedAt: now,
  };
}

/** Upsert a single rating row (last write wins per system). */
export async function upsertRating(rating: RatingItem): Promise<void> {
  await putItem(rating as unknown as Record<string, unknown>);
}

/** Remove one rating system for a user. */
export async function deleteRating(uid: string, system: RatingSystem): Promise<void> {
  await deleteItem(userKeys.rating(uid, system));
}

/**
 * Pure preference: pick the best default rating source from a user's ratings.
 * Prefers verified over self-entered, then a fixed system priority. Extracted so
 * it can be unit-tested without a database.
 */
export function chooseDefaultRatingSource(ratings: RatingItem[]): RatingSystem | undefined {
  if (ratings.length === 0) return undefined;
  const rank = (r: RatingItem) => (r.verified ? 0 : 100) + RATING_SYSTEMS.indexOf(r.system);
  return [...ratings].sort((a, b) => rank(a) - rank(b))[0]?.system;
}

// ── onboarding ───────────────────────────────────────────────────────────────

/** Set `onboarded:true` and merge `completedSteps` (union) on the profile. */
export async function completeOnboarding(
  uid: string,
  completedSteps: string[] = [],
): Promise<void> {
  const existing = await getUserProfile(uid);
  const merged = Array.from(new Set([...(existing?.completedSteps ?? []), ...completedSteps]));
  await updateItem({
    key: userKeys.profile(uid),
    update: "SET onboarded = :t, completedSteps = :steps, updatedAt = :now",
    values: { ":t": true, ":steps": merged, ":now": new Date().toISOString() },
  });
}
