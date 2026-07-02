/**
 * _util.ts — shared parsing/validation for the /api/tournaments/* route handlers
 * (`_`-prefixed so Next never treats it as a route). Maps a thrown
 * {@link TourneyError} (400/403/404/409) to the JSON error `Response` shape.
 */

import { bad } from "@/app/api/_util";
import { TourneyError } from "@/lib/data/tournaments";
import type { StoredMoney } from "@/lib/db/types";

export const MAX_TITLE = 140;
export const MAX_DESC = 4000;

/** Map a thrown domain {@link TourneyError} → a JSON error Response; rethrow others. */
export function tourneyErr(err: unknown): never {
  if (err instanceof TourneyError) bad(err.message, err.status);
  throw err;
}

/** A required trimmed string field, ≤ max chars, or 400. */
export function reqStr(body: Record<string, unknown>, key: string, max: number): string {
  const v = body[key];
  if (typeof v !== "string" || !v.trim()) bad(`${key} is required`);
  const t = (v as string).trim();
  if (t.length > max) bad(`${key} must be ≤ ${max} characters`);
  return t;
}

/** An optional trimmed string field (undefined when absent/blank). */
export function optStr(body: Record<string, unknown>, key: string, max: number): string | undefined {
  const v = body[key];
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "string") bad(`${key} must be a string`);
  const t = (v as string).trim();
  if (!t) return undefined;
  if (t.length > max) bad(`${key} must be ≤ ${max} characters`);
  return t;
}

/** An optional finite number field. */
export function optNum(body: Record<string, unknown>, key: string): number | undefined {
  const v = body[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "number" || !Number.isFinite(v)) bad(`${key} must be a number`);
  return v as number;
}

/** An optional non-negative integer field. */
export function optInt(body: Record<string, unknown>, key: string): number | undefined {
  const v = optNum(body, key);
  if (v === undefined) return undefined;
  if (!Number.isInteger(v) || v < 0) bad(`${key} must be a non-negative integer`);
  return v;
}

/**
 * Parse a required `price` into {@link StoredMoney} (integer minor units + ISO-4217).
 * Accepts `{ amount, currency }` (minor units) — NEVER a float major-unit value, so
 * the money path stays exact (§14.5).
 */
export function reqPrice(body: Record<string, unknown>, currency: string): StoredMoney {
  const raw = body.price;
  if (typeof raw === "object" && raw !== null) {
    const p = raw as Record<string, unknown>;
    if (typeof p.amount !== "number" || !Number.isInteger(p.amount) || p.amount < 0) {
      bad("price.amount must be a non-negative integer (minor units)");
    }
    const cur = typeof p.currency === "string" && p.currency ? p.currency.toLowerCase() : currency;
    return { amount: p.amount as number, currency: cur };
  }
  if (typeof raw === "number") {
    if (!Number.isInteger(raw) || raw < 0) bad("price must be a non-negative integer (minor units)");
    return { amount: raw, currency };
  }
  return bad("price is required (integer minor units)");
}
