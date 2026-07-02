/**
 * /api/courts/[courtId]/review — court reviews (PRD §6.4).
 *
 * POST / PUT → upsert the caller's ONE review for the court (create or edit).
 * DELETE     → remove the caller's review.
 *
 * All require auth (`requireAuth` 401s propagate via `guarded`). Input is
 * validated (rating 1–5, length bounds) and passed through a light profanity /
 * link-spam guard. One-per-user keying (see lib/data/reviews) is itself the
 * rate-limit: a second write edits the same row rather than piling up.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { getCourt } from "@/lib/data/courts";
import { upsertReview, deleteReview } from "@/lib/data/reviews";
import { guarded, bad, jsonBody } from "@/app/api/_util";

export const dynamic = "force-dynamic";

const MAX_TITLE = 120;
const MAX_BODY = 2000;
const MAX_TAGS = 10;
const MAX_TAG_LEN = 40;

/** Minimal, illustrative slur/profanity screen — a real impl uses a maintained list. */
const PROFANITY = ["fuck", "shit", "bitch", "asshole", "cunt", "nigger", "faggot"];

function hasProfanity(text: string | undefined): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return PROFANITY.some((w) => new RegExp(`\\b${w}\\b`).test(lower));
}

/** Link-stuffing heuristic: several URLs in a short review reads as spam. */
function looksLikeSpam(text: string | undefined): boolean {
  if (!text) return false;
  return (text.match(/https?:\/\//gi) ?? []).length >= 3;
}

/** Optional trimmed string within `max`, or 400. Absent/empty → undefined. */
function optText(body: Record<string, unknown>, key: string, max: number): string | undefined {
  const v = body[key];
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "string") bad(`${key} must be a string`);
  const trimmed = (v as string).trim();
  if (!trimmed) return undefined;
  if (trimmed.length > max) bad(`${key} must be ≤ ${max} characters`);
  return trimmed;
}

function parseTags(body: Record<string, unknown>): string[] | undefined {
  if (!("tags" in body) || body.tags === undefined || body.tags === null) return undefined;
  if (!Array.isArray(body.tags)) bad("tags must be an array of strings");
  const tags = body.tags
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t.length <= MAX_TAG_LEN)
    .slice(0, MAX_TAGS);
  return tags;
}

async function upsert(req: NextRequest, ctx: { params: Promise<{ courtId: string }> }): Promise<Response> {
  return guarded(async () => {
    const { courtId } = await ctx.params;
    const user = await requireAuth(req);
    if (!(await getCourt(courtId))) bad("Court not found", 404);

    const body = await jsonBody(req);
    const rating = body.rating1to5;
    if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      bad("rating1to5 must be an integer from 1 to 5");
    }

    const title = optText(body, "title", MAX_TITLE);
    const text = optText(body, "body", MAX_BODY);
    if (hasProfanity(title) || hasProfanity(text)) bad("Please remove inappropriate language");
    if (looksLikeSpam(text)) bad("This review looks like spam");

    const tags = parseTags(body);
    const photoUrl = optText(body, "photoUrl", 500);

    const review = await upsertReview({
      courtId,
      uid: user.uid,
      rating1to5: rating,
      title,
      body: text,
      tags,
      photoUrl,
    });
    return Response.json(review);
  });
}

export function POST(req: NextRequest, ctx: { params: Promise<{ courtId: string }> }): Promise<Response> {
  return upsert(req, ctx);
}

export function PUT(req: NextRequest, ctx: { params: Promise<{ courtId: string }> }): Promise<Response> {
  return upsert(req, ctx);
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ courtId: string }> },
): Promise<Response> {
  return guarded(async () => {
    const { courtId } = await ctx.params;
    const user = await requireAuth(req);
    await deleteReview(courtId, user.uid);
    return Response.json({ ok: true });
  });
}
