/**
 * limits.ts — group membership-cap limits (§6.9). Dependency-free + client-safe
 * (no server imports), so the data layer, route handlers, and the create/settings
 * forms all share ONE source of truth for the default and the allowed range.
 */

/** Default cap on a group's ACTIVE membership when the creator doesn't set one. */
export const DEFAULT_GROUP_MAX_MEMBERS = 40;

/** Smallest cap an owner may set (owner + at least one other member). */
export const MIN_GROUP_MAX_MEMBERS = 2;

/** Largest cap an owner may set (a sane ceiling for a single club). */
export const MAX_GROUP_MAX_MEMBERS = 10_000;

/** Whether `n` is a valid, settable member cap. */
export function isValidGroupMaxMembers(n: number): boolean {
  return Number.isInteger(n) && n >= MIN_GROUP_MAX_MEMBERS && n <= MAX_GROUP_MAX_MEMBERS;
}
