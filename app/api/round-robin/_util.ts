/**
 * _util.ts — shared parsing/authorization helpers for the /api/round-robin/*
 * route handlers (`_`-prefixed so Next never treats it as a route).
 *
 * The Round-Robin tool is NO-LOGIN: create/score/advance are gated by a secret
 * `creatorToken` — carried in the **`X-RR-Token` header** (or `token` in the JSON
 * body) — NOT by `requireAuth`. Only claim requires auth. `rrErr` maps a thrown
 * {@link RrError} (400/403/404) to the JSON error `Response` shape via `bad`.
 */

import type { NextRequest } from "next/server";
import { bad } from "@/app/api/_util";
import { verifyRequest } from "@/lib/auth/verify";
import { RrError } from "@/lib/data/roundrobin";
import type {
  RrConfig,
  RrFormat,
  PlayMode,
  Entrant,
  ScoringConfig,
  PoolsConfig,
} from "@/lib/roundrobin/types";

export const MAX_TITLE = 140;

const RR_FORMATS: RrFormat[] = ["roundRobin", "mixer", "movement", "swiss", "poolsBracket"];
const PLAY_MODES: PlayMode[] = ["singles", "doubles"];
const TOKEN_HEADER = "x-rr-token"; // Web Headers.get is case-insensitive

/** Map a thrown domain {@link RrError} → a JSON error Response (via `bad`); rethrow others. */
export function rrErr(err: unknown): never {
  if (err instanceof RrError) bad(err.message, err.status);
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

/** A required non-negative integer field, or 400. */
export function reqInt(body: Record<string, unknown>, key: string): number {
  const v = body[key];
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
    bad(`${key} must be a non-negative integer`);
  }
  return v as number;
}

/** The creator token: `X-RR-Token` header (preferred) or `token` in the JSON body. */
export function tokenFrom(req: NextRequest, body: Record<string, unknown>): string | undefined {
  const header = req.headers.get(TOKEN_HEADER);
  if (header && header.trim()) return header.trim();
  if (typeof body.token === "string" && body.token.trim()) return body.token.trim();
  return undefined;
}

/**
 * Best-effort uid from a Bearer token — optional. RR mutations are token-gated,
 * but a signed-in OWNER (who claimed the event) may also authorize by uid, so we
 * surface it when present and swallow any auth failure (never 401 here).
 */
export async function optionalUid(req: NextRequest): Promise<string | undefined> {
  try {
    return (await verifyRequest(req)).uid;
  } catch {
    return undefined;
  }
}

function parseScoring(raw: unknown): ScoringConfig {
  if (typeof raw !== "object" || raw === null) bad("config.scoring is required");
  const s = raw as Record<string, unknown>;
  const pointsToWin = s.pointsToWin;
  if (typeof pointsToWin !== "number" || !Number.isInteger(pointsToWin) || pointsToWin < 1) {
    bad("config.scoring.pointsToWin must be a positive integer");
  }
  const winBy = s.winBy;
  if (typeof winBy !== "number" || !Number.isInteger(winBy) || winBy < 1) {
    bad("config.scoring.winBy must be a positive integer");
  }
  const out: ScoringConfig = { pointsToWin: pointsToWin as number, winBy: winBy as number };
  if (s.cap === null) out.cap = null;
  else if (typeof s.cap === "number" && Number.isInteger(s.cap)) out.cap = s.cap;
  if (typeof s.gamesPerMatch === "number" && Number.isInteger(s.gamesPerMatch) && s.gamesPerMatch > 0) {
    out.gamesPerMatch = s.gamesPerMatch;
  }
  return out;
}

function parsePools(raw: unknown): PoolsConfig {
  if (typeof raw !== "object" || raw === null) bad("config.pools is invalid");
  const p = raw as Record<string, unknown>;
  const poolCount = p.poolCount;
  if (typeof poolCount !== "number" || !Number.isInteger(poolCount) || poolCount < 1) {
    bad("config.pools.poolCount must be a positive integer");
  }
  const advancePerPool = p.advancePerPool;
  if (typeof advancePerPool !== "number" || !Number.isInteger(advancePerPool) || advancePerPool < 1) {
    bad("config.pools.advancePerPool must be a positive integer");
  }
  if (p.elim !== "single" && p.elim !== "double") bad("config.pools.elim must be 'single' or 'double'");
  return {
    poolCount: poolCount as number,
    advancePerPool: advancePerPool as number,
    elim: p.elim,
  };
}

/**
 * Validate + normalize the raw `config` into a well-formed {@link RrConfig}. This
 * is a STRUCTURAL guard (shapes/types); the engine's `validateConfig` (run in the
 * data layer) owns per-format feasibility. Entrant ids default to `e<index>` and a
 * missing `rngSeed` is stamped server-side so every viewer shares one schedule.
 */
export function parseConfig(raw: unknown): RrConfig {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) bad("config is required");
  const c = raw as Record<string, unknown>;

  const format = c.format;
  if (typeof format !== "string" || !RR_FORMATS.includes(format as RrFormat)) {
    bad("config.format is invalid");
  }
  const mode = c.mode;
  if (typeof mode !== "string" || !PLAY_MODES.includes(mode as PlayMode)) {
    bad("config.mode is invalid");
  }

  if (!Array.isArray(c.entrants) || c.entrants.length === 0) {
    bad("config.entrants must be a non-empty array");
  }
  const entrants: Entrant[] = (c.entrants as unknown[]).map((e, i) => {
    if (typeof e !== "object" || e === null) bad(`config.entrants[${i}] is invalid`);
    const ent = e as Record<string, unknown>;
    if (typeof ent.name !== "string" || !ent.name.trim()) bad(`config.entrants[${i}].name is required`);
    const id = typeof ent.id === "string" && ent.id.trim() ? ent.id.trim() : `e${i}`;
    const out: Entrant = { id, name: ent.name.trim() };
    if (typeof ent.seed === "number" && Number.isFinite(ent.seed)) out.seed = ent.seed;
    if (typeof ent.rating === "number" && Number.isFinite(ent.rating)) out.rating = ent.rating;
    return out;
  });

  const courts = c.courts;
  if (typeof courts !== "number" || !Number.isInteger(courts) || courts < 1) {
    bad("config.courts must be a positive integer");
  }

  const scoring = parseScoring(c.scoring);
  const rngSeed =
    typeof c.rngSeed === "number" && Number.isFinite(c.rngSeed)
      ? Math.trunc(c.rngSeed)
      : Math.floor(Math.random() * 0xffffffff);

  const config: RrConfig = {
    format: format as RrFormat,
    mode: mode as PlayMode,
    entrants,
    courts: courts as number,
    scoring,
    rngSeed,
  };
  if (typeof c.fixedPartners === "boolean") config.fixedPartners = c.fixedPartners;
  if (typeof c.rounds === "number" && Number.isInteger(c.rounds) && c.rounds > 0) config.rounds = c.rounds;
  if (typeof c.playEveryoneTwice === "boolean") config.playEveryoneTwice = c.playEveryoneTwice;
  if (c.movement === "upDown" || c.movement === "king") config.movement = c.movement;
  if (typeof c.popcorn === "boolean") config.popcorn = c.popcorn;
  if (c.pools !== undefined && c.pools !== null) config.pools = parsePools(c.pools);

  return config;
}
