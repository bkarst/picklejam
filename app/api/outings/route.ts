/**
 * POST /api/outings — create an outing/game (PRD §6.7).
 *
 * Requires auth; the caller becomes the organizer. Validates the payload (title,
 * court, a valid start time, an optional RRULE) and writes OUTING + OUTINGREF
 * (+ SERIES / group MEETUP) in ONE atomic transaction (N15) via `createOuting`.
 */

import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/verify";
import { getCourt } from "@/lib/data/courts";
import { createOuting, type CreateOutingInput } from "@/lib/data/outings";
import { parseRrule } from "@/lib/outings/rrule";
import { guarded, bad, jsonBody } from "@/app/api/_util";
import type { OutingType, OutingHostType, Visibility } from "@/lib/db/types";

export const dynamic = "force-dynamic";

const MAX_TITLE = 140;
const MAX_DESC = 4000;
const OUTING_TYPES: OutingType[] = ["open", "private"];
const VISIBILITIES: Visibility[] = ["public", "unlisted", "private"];
const HOST_TYPES: OutingHostType[] = ["USER", "GROUP"];

function reqStr(body: Record<string, unknown>, key: string, max: number): string {
  const v = body[key];
  if (typeof v !== "string" || !v.trim()) bad(`${key} is required`);
  const trimmed = (v as string).trim();
  if (trimmed.length > max) bad(`${key} must be ≤ ${max} characters`);
  return trimmed;
}

function optNum(body: Record<string, unknown>, key: string): number | undefined {
  const v = body[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "number" || !Number.isFinite(v)) bad(`${key} must be a number`);
  return v as number;
}

function optIsoTs(body: Record<string, unknown>, key: string): string | undefined {
  const v = body[key];
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "string" || Number.isNaN(Date.parse(v))) bad(`${key} must be an ISO date-time`);
  return v as string;
}

export async function POST(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    const body = await jsonBody(req);

    const title = reqStr(body, "title", MAX_TITLE);
    const courtId = reqStr(body, "courtId", 200);
    const startTs = optIsoTs(body, "startTs");
    if (!startTs) bad("startTs is required");

    const court = await getCourt(courtId);
    if (!court) bad("Court not found", 404);

    const type = body.type === undefined ? undefined : (body.type as OutingType);
    if (type !== undefined && !OUTING_TYPES.includes(type)) bad("Invalid type");
    const visibility = body.visibility === undefined ? undefined : (body.visibility as Visibility);
    if (visibility !== undefined && !VISIBILITIES.includes(visibility)) bad("Invalid visibility");
    const hostType = body.hostType === undefined ? undefined : (body.hostType as OutingHostType);
    if (hostType !== undefined && !HOST_TYPES.includes(hostType)) bad("Invalid hostType");
    if (hostType === "GROUP" && typeof body.groupId !== "string") {
      bad("groupId is required when hostType is GROUP");
    }

    const capacity = optNum(body, "capacity");
    if (capacity !== undefined && (!Number.isInteger(capacity) || capacity < 1)) {
      bad("capacity must be a positive integer");
    }

    let rrule: string | undefined;
    if (typeof body.rrule === "string" && body.rrule.trim()) {
      rrule = body.rrule.trim();
      try {
        parseRrule(rrule);
      } catch (err) {
        bad(err instanceof Error ? err.message : "Invalid rrule");
      }
    }

    const description =
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim().slice(0, MAX_DESC)
        : undefined;

    const input: CreateOutingInput = {
      title,
      courtId,
      organizerId: user.uid,
      startTs: startTs!,
      endTs: optIsoTs(body, "endTs"),
      type,
      visibility,
      hostType,
      groupId: typeof body.groupId === "string" ? body.groupId : undefined,
      tz: typeof body.tz === "string" ? body.tz : undefined,
      skillMin: optNum(body, "skillMin"),
      skillMax: optNum(body, "skillMax"),
      capacity,
      waitlist: typeof body.waitlist === "boolean" ? body.waitlist : undefined,
      guestPolicy: body.guestPolicy === "allowed" ? "allowed" : body.guestPolicy === "none" ? "none" : undefined,
      description,
      rrule,
    };

    const outing = await createOuting(input);
    return Response.json(outing, { status: 201 });
  });
}
