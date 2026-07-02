/**
 * anon.ts — ephemeral anonymous browser tokens (PRD §6.2).
 *
 * An anon token lets a signed-OUT visitor check in without an account. It is a
 * random, TTL'd id stored under its own `ANON#<token>` partition and is NEVER
 * identity-linked — it holds no uid/email/name/PII, only a rolling `lastCourtId`
 * and (in the same partition) per-day check-in dedupe markers used for anti-abuse.
 */

import { ulid } from "ulid";
import { getItem, query, putItem, updateItem } from "@/lib/db/client";
import { systemKeys } from "@/lib/db/keys";
import type { AnonTokenItem } from "@/lib/db/types";

/** How long an anon token (and its dedupe markers) live — 30 days. */
export const ANON_TTL_SECONDS = 30 * 24 * 60 * 60;

/** A per-(token, court, day) check-in dedupe marker. Carries NO PII. */
export interface AnonCheckinMarker {
  pk: string;
  sk: string;
  entity: "ANONCHECKIN";
  courtId: string;
  day: string;
  /** The durable check-in's SK, so a duplicate request can return the existing one. */
  checkinSk: string;
  ttl: number;
}

/** Build an anon-token item (pure). Contains only token + ttl — never any PII. */
export function buildAnonTokenItem(token: string, now: number = Date.now()): AnonTokenItem {
  return {
    ...systemKeys.anonToken(token),
    entity: "ANON",
    token,
    ttl: Math.floor(now / 1000) + ANON_TTL_SECONDS,
    createdAt: new Date(now).toISOString(),
  };
}

/** Mint + persist a fresh anon token, returning it for the client to store. */
export async function issueAnonToken(now: () => number = Date.now): Promise<string> {
  const token = ulid();
  await putItem(buildAnonTokenItem(token, now()) as unknown as Record<string, unknown>);
  return token;
}

/** Fetch an anon token's row (GetItem), if it still exists (TTL may have reaped it). */
export async function getAnonToken(token: string): Promise<AnonTokenItem | undefined> {
  return getItem<AnonTokenItem>(systemKeys.anonToken(token));
}

/**
 * Refresh a token's `lastCourtId` + TTL after activity (upsert — recreates the row
 * with entity/token if the TTL had reaped it). Stores no PII.
 */
export async function touchAnonToken(
  token: string,
  courtId: string,
  now: () => number = Date.now,
): Promise<void> {
  await updateItem({
    key: systemKeys.anonToken(token),
    update:
      "SET lastCourtId = :c, updatedAt = :u, #ttl = :ttl, " +
      "entity = if_not_exists(entity, :e), #tok = if_not_exists(#tok, :tok)",
    names: { "#ttl": "ttl", "#tok": "token" },
    values: {
      ":c": courtId,
      ":u": new Date(now()).toISOString(),
      ":ttl": Math.floor(now() / 1000) + ANON_TTL_SECONDS,
      ":e": "ANON",
      ":tok": token,
    },
  });
}

/** All of a token's check-in markers for `day` (one Query) — dedupe + burst cap. */
export async function getAnonCheckinsForDay(token: string, day: string): Promise<AnonCheckinMarker[]> {
  const { items } = await query<AnonCheckinMarker>({
    pk: systemKeys.anonToken(token).pk,
    skBeginsWith: systemKeys.anonCheckinDayPrefix(day),
  });
  return items;
}

/** Record that `token` checked into `courtId` on `day`, pointing at the check-in row. */
export async function recordAnonCheckin(
  token: string,
  courtId: string,
  day: string,
  checkinSk: string,
  now: () => number = Date.now,
): Promise<void> {
  const marker: AnonCheckinMarker = {
    ...systemKeys.anonCheckin(token, day, courtId),
    entity: "ANONCHECKIN",
    courtId,
    day,
    checkinSk,
    ttl: Math.floor(now() / 1000) + ANON_TTL_SECONDS,
  };
  await putItem(marker as unknown as Record<string, unknown>);
}
