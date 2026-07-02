/**
 * _util.ts — shared helpers for the /api/account/* authorized route handlers.
 *
 * `_`-prefixed so Next never treats it as a route. `guarded` lets handlers throw
 * a `Response` (requireAuth's 401, or `bad(...)` validation errors) and have it
 * returned verbatim instead of surfacing as a 500 — so the happy path stays flat.
 */

import type { NextRequest } from "next/server";

/** Run a handler body, returning any thrown `Response` (401 / 400 / 409) as-is. */
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

/** Parse a JSON object body or 400. */
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

/**
 * Read an optional free-text field for a merge/overlay update:
 * absent → `{ set:false }` (keep current); `null`/`""` → `{ set:true, value:undefined }`
 * (clear it); a string → `{ set:true, value }`. Any other type → 400.
 */
export function readOptText(
  body: Record<string, unknown>,
  key: string,
): { set: boolean; value?: string } {
  if (!(key in body)) return { set: false };
  const v = body[key];
  if (v === null || v === "") return { set: true, value: undefined };
  if (typeof v !== "string") bad(`${key} must be a string`);
  return { set: true, value: v };
}
