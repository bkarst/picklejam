/**
 * _util.ts — shared helpers for the top-level /api/* route handlers.
 *
 * `_`-prefixed so Next never treats it as a route. `guarded` lets a handler throw
 * a `Response` (requireAuth's 401, or `bad(...)` validation errors) and have it
 * returned verbatim instead of surfacing as a 500 — so the happy path stays flat.
 * (Mirrors app/api/account/_util.ts for handlers outside the /account tree.)
 */

import type { NextRequest } from "next/server";

/** Run a handler body, returning any thrown `Response` (401 / 400 / 404 / 429) as-is. */
export async function guarded(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }
}

/** Throw a JSON error `Response` (caught by {@link guarded}). Returns `never`. */
export function bad(message: string, status = 400): never {
  throw Response.json({ error: message }, { status });
}

/** Parse a required JSON object body, or 400. */
export async function jsonBody(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const b: unknown = await req.json();
    if (typeof b === "object" && b !== null && !Array.isArray(b)) {
      return b as Record<string, unknown>;
    }
  } catch {
    /* fall through to 400 */
  }
  return bad("Invalid JSON body");
}

/** Parse an OPTIONAL JSON object body; an absent/empty/invalid body → `{}`. */
export async function jsonBodyOptional(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const b: unknown = await req.json();
    if (typeof b === "object" && b !== null && !Array.isArray(b)) {
      return b as Record<string, unknown>;
    }
  } catch {
    /* no/'' body — anonymous check-ins may POST nothing */
  }
  return {};
}
