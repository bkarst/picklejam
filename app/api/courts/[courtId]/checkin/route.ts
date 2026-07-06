/**
 * POST /api/courts/[courtId]/checkin — check in at a court (PRD §6.2).
 *
 * Auth is OPTIONAL: a valid Bearer → an account check-in (appears in "my
 * check-ins", shows identity unless `anonymous`); otherwise ANONYMOUS via an
 * `x-anon-token` (from the header or body) — if none is supplied we mint one and
 * return it for the client to persist. The check-in day is the COURT-local day.
 *
 * Anti-abuse (per identity, per court, per day):
 *   • duplicate same-day check-in at the same court → return the EXISTING one (not
 *     an error), so a double-tap / refresh is a no-op.
 *   • burst cap → 429 once an identity exceeds MAX_CHECKINS_PER_DAY that day.
 * Account identity is deduped via GSI1 (`getMyCheckins`); anonymous identity via
 * the token's per-day dedupe markers (anon rows carry no uid to query by).
 */

import type { NextRequest } from "next/server";
import { verifyRequest } from "@/lib/auth/verify";
import { getItem } from "@/lib/db/client";
import { courtKeys } from "@/lib/db/keys";
import { getCourt } from "@/lib/data/courts";
import { courtLocalDay } from "@/lib/directory/court-local-day";
import { createCheckin, getCourtCheckinsToday, getMyCheckins } from "@/lib/data/checkins";
import { earnCheckin } from "@/lib/data/gamify-earn";
import {
  issueAnonToken,
  getAnonCheckinsForDay,
  recordAnonCheckin,
  touchAnonToken,
} from "@/lib/data/anon";
import { guarded, bad, jsonBodyOptional } from "@/app/api/_util";
import { sanitizeMultiline } from "@/lib/util/sanitize";
import type { CheckinItem } from "@/lib/db/types";

export const dynamic = "force-dynamic";

const MAX_CHECKINS_PER_DAY = 10;
/**
 * Per-court, per-day ceiling on ANONYMOUS check-ins. A fresh anon token is a new identity
 * minted for free, so the per-token cap above is Sybil-able (mint token → check in → discard,
 * looped) and would let one attacker inflate a court's "players here today" arbitrarily (L3).
 * This bounds that to a fixed, generous number that real anonymous use never reaches.
 */
export const MAX_ANON_CHECKINS_PER_COURT_PER_DAY = 100;
const MAX_NOTE = 280;
const MAX_SKILL = 10;

interface CheckinFields {
  note?: string;
  skill?: number;
  lookingToPlay?: boolean;
  anonymous: boolean;
}

/** Validate + normalize the optional check-in fields (400 on bad input). */
function parseFields(body: Record<string, unknown>): CheckinFields {
  let note: string | undefined;
  if (typeof body.note === "string" && body.note.trim()) {
    // Strip HTML so the note renders as clean plaintext in the "checked in today" list.
    note = sanitizeMultiline(body.note) || undefined;
    if (note && note.length > MAX_NOTE) bad(`note must be ≤ ${MAX_NOTE} characters`);
  }
  let skill: number | undefined;
  if (body.skill !== undefined && body.skill !== null) {
    if (typeof body.skill !== "number" || !Number.isFinite(body.skill)) bad("skill must be a number");
    if (body.skill < 0 || body.skill > MAX_SKILL) bad(`skill must be between 0 and ${MAX_SKILL}`);
    skill = body.skill;
  }
  const lookingToPlay = typeof body.lookingToPlay === "boolean" ? body.lookingToPlay : undefined;
  const anonymous = body.anonymous === true;
  return { note, skill, lookingToPlay, anonymous };
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ courtId: string }> },
): Promise<Response> {
  return guarded(async () => {
    const { courtId } = await ctx.params;
    const court = await getCourt(courtId);
    if (!court) bad("Court not found", 404);

    const day = courtLocalDay(court);
    const body = await jsonBodyOptional(req);
    const fields = parseFields(body);

    // Soft auth: a valid Bearer identifies the account; its absence is fine (anon).
    let uid: string | undefined;
    try {
      uid = (await verifyRequest(req)).uid;
    } catch {
      /* anonymous check-in */
    }

    // ── account check-in ──────────────────────────────────────────────────────
    if (uid) {
      const today = (await getMyCheckins(uid)).filter((c) => c.checkinDay === day);
      const existing = today.find((c) => c.courtId === courtId);
      if (existing) {
        const todayCount = (await getCourtCheckinsToday(courtId, day)).length;
        return Response.json({ checkin: existing, todayCount });
      }
      if (today.length >= MAX_CHECKINS_PER_DAY) bad("Daily check-in limit reached", 429);

      const checkin = await createCheckin({
        courtId,
        uid,
        anonymous: fields.anonymous, // an account can hide its identity per check-in
        note: fields.note,
        skill: fields.skill,
        lookingToPlay: fields.lookingToPlay,
        day,
      });
      // Rally Points — after the durable write (failure-isolated). Anonymous check-ins
      // earn nothing (§G2.4); the block is absent when the account hid its identity.
      const gamify = fields.anonymous
        ? undefined
        : await earnCheckin({
            uid,
            courtId,
            courtName: court.name,
            courtCityKey: court.cityKey,
            day,
            note: fields.note,
            lookingToPlay: fields.lookingToPlay,
          });
      const todayCount = (await getCourtCheckinsToday(courtId, day)).length;
      return Response.json({ checkin, todayCount, ...(gamify ? { gamify } : {}) });
    }

    // ── anonymous check-in ────────────────────────────────────────────────────
    const headerToken = req.headers.get("x-anon-token");
    const bodyToken = typeof body.anonToken === "string" ? body.anonToken : null;
    let anonToken = headerToken ?? bodyToken;
    const fresh = !anonToken;
    if (!anonToken) anonToken = await issueAnonToken();

    const todaysCheckins = await getCourtCheckinsToday(courtId, day);
    const markers = fresh ? [] : await getAnonCheckinsForDay(anonToken, day);
    const dup = markers.find((m) => m.courtId === courtId);
    if (dup) {
      const existing = await getItem<CheckinItem>({
        pk: courtKeys.meta(courtId).pk,
        sk: dup.checkinSk,
      });
      return Response.json({ checkin: existing, anonToken, todayCount: todaysCheckins.length });
    }
    if (markers.length >= MAX_CHECKINS_PER_DAY) bad("Daily check-in limit reached", 429);
    // Court-level anti-Sybil ceiling: a token-anonymous check-in carries no uid, so count
    // those and stop once a court has taken its daily anonymous allotment (L3). A per-token
    // cap alone can't stop a mint→check-in→discard loop from inflating the metric.
    const anonToday = todaysCheckins.filter((c) => !c.uid).length;
    if (anonToday >= MAX_ANON_CHECKINS_PER_COURT_PER_DAY) {
      bad("This court has reached today's anonymous check-in limit", 429);
    }

    const checkin = await createCheckin({
      courtId,
      uid: null,
      anonymous: true,
      note: fields.note,
      skill: fields.skill,
      lookingToPlay: fields.lookingToPlay,
      day,
    });
    await recordAnonCheckin(anonToken, courtId, day, checkin.sk);
    await touchAnonToken(anonToken, courtId);
    return Response.json({ checkin, anonToken, todayCount: todaysCheckins.length + 1 });
  });
}
