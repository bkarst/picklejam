/**
 * _util.ts — shared helpers for the /api/groups/* route handlers (PRD §6.9).
 *
 * `mapGroupErrors` runs a handler body and converts the data layer's typed errors
 * (which carry a numeric `.status`) into JSON error `Response`s — so a
 * `GroupPermissionError` becomes a 403, `GroupNotFoundError` a 404, etc., and the
 * happy path in each route stays flat. Re-thrown `Response`s (requireAuth's 401,
 * `bad(...)`) pass through untouched.
 */

import { bad } from "@/app/api/_util";

interface WithStatus {
  status: number;
  message: string;
}

function hasStatus(err: unknown): err is WithStatus {
  return (
    typeof err === "object" &&
    err !== null &&
    typeof (err as { status?: unknown }).status === "number" &&
    typeof (err as { message?: unknown }).message === "string"
  );
}

/** Run `fn`, mapping typed group data-layer errors (`.status`) to JSON responses. */
export async function mapGroupErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof Response) throw err; // already an HTTP response (401/400/…)
    if (hasStatus(err)) bad(err.message, err.status); // 403 / 404 / 400 (returns never)
    throw err; // genuine 500
  }
}
