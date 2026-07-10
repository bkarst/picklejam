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
import { revalidatePath } from "next/cache";
import { verifyRequest } from "@/lib/auth/verify";
import { getItem } from "@/lib/db/client";
import { courtKeys } from "@/lib/db/keys";
import { getCourt } from "@/lib/data/courts";
import { courtLocalDay } from "@/lib/directory/court-local-day";
import { createCheckin, getCourtCheckinsToday, getMyCheckins } from "@/lib/data/checkins";
import { checkInToEvent, getOutingMeta } from "@/lib/data/outings";
import { canAccessPrivateOuting } from "@/lib/outings/access";
import { isEventCheckinOpen } from "@/lib/outings/timing";
import { notifyEventCheckin } from "@/lib/outings/notify";
import { outingPath } from "@/lib/urls";
import { earnCheckin } from "@/lib/data/gamify-earn";
import {
  issueAnonToken,
  getAnonCheckinsForDay,
  recordAnonCheckin,
  touchAnonToken,
} from "@/lib/data/anon";
import { guarded, bad, jsonBodyOptional } from "@/app/api/_util";
import { sanitizeMultiline } from "@/lib/util/sanitize";
import type { CheckinItem, OutingItem } from "@/lib/db/types";

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

/**
 * Resolve + authorize an EVENT check-in's outing ("check in with a group event",
 * §6.2/§6.7). Requires a signed-in caller (arrival is marked on THEIR RSVP), the
 * event to be at THIS court, and — for private events — the shared access rule
 * (lib/outings/access, the same gate RSVP uses).
 */
async function resolveEventOuting(
  outingId: string,
  courtId: string,
  uid: string | undefined,
  body: Record<string, unknown>,
): Promise<OutingItem> {
  if (!uid) bad("Sign in to check in for an event", 401);
  const outing = await getOutingMeta(outingId);
  if (!outing) bad("Event not found", 404);
  if (outing!.courtId !== courtId) bad("This event is at a different court");
  // Enforce the SAME window the button renders (lib/outings/timing) — without
  // this, a crafted request could stamp arrivals and fan out notifications at
  // any time, days before or after the event.
  if (!isEventCheckinOpen(outing!.startTs, outing!.endTs, Date.now())) {
    bad("Event check-in isn't open — it opens 2 hours before start");
  }
  const token = typeof body.inviteToken === "string" ? body.inviteToken : undefined;
  if (!(await canAccessPrivateOuting(outing!, uid!, token))) {
    bad("This is a private event — an invite is required to check in", 403);
  }
  return outing!;
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

    // Event check-in ("check in with a group event"): resolve + authorize the
    // outing up front so a bad event reference 4xxs before anything is written.
    const outingId = typeof body.outingId === "string" && body.outingId ? body.outingId : undefined;
    const outing = outingId ? await resolveEventOuting(outingId, courtId, uid, body) : undefined;

    // ── account check-in ──────────────────────────────────────────────────────
    if (uid) {
      const today = (await getMyCheckins(uid)).filter((c) => c.checkinDay === day);
      const existing = today.find((c) => c.courtId === courtId);
      if (existing) {
        // Already checked in at this court today (e.g. a plain morning check-in,
        // or a double-tap). An EVENT check-in still records arrival — and still
        // notifies, but only when the arrival is NEW: checkInToEvent's
        // exactly-once stamp is the gate, so a re-tap never re-notifies while a
        // first event check-in after an unrelated court check-in still does.
        if (outing) {
          try {
            if (await checkInToEvent(outing, uid)) {
              await notifyEventCheckin({ outing, courtName: court.name, actorUid: uid });
            }
          } catch (err) {
            console.error("[checkin] event side effects failed (swallowed)", err);
          }
          revalidatePath(outingPath(outing.outingId));
        }
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
        ...(outing ? { outingId: outing.outingId, groupId: outing.groupId ?? null } : {}),
      });

      // Event side effects — arrival on the RSVP + the ANONYMOUS fan-out to the
      // host group's members and the court's followers (§9.3). The fan-out is
      // gated on a NEWLY-recorded arrival (exactly-once). Failure-isolated: the
      // durable check-in above never rolls back on a notify hiccup.
      if (outing) {
        try {
          if (await checkInToEvent(outing, uid)) {
            await notifyEventCheckin({ outing, courtName: court.name, actorUid: uid });
          }
        } catch (err) {
          console.error("[checkin] event side effects failed (swallowed)", err);
        }
        revalidatePath(outingPath(outing.outingId));
      }
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
