/**
 * Round-Robin engine — shared domain contract (PRD §6.8, Stage 5).
 *
 * The engine is PURE and SEEDED: the static schedule is a deterministic function
 * of `RrConfig` (incl. `rngSeed`), and dynamic rounds are a deterministic function
 * of `rngSeed` + the confirmed scores so far. "Same seed ⇒ identical schedule for
 * every viewer" is the load-bearing invariant (§14.1) — never call `Math.random`,
 * `Date.now`, or read ambient state inside the engine; thread everything through
 * the seeded RNG (see `./rng`).
 *
 * A competitor is modelled as a {@link Side}: a list of entrant ids (one for
 * singles / fixed-doubles-team entrants, two for a rotating mixer pairing). This
 * keeps {@link Standing} crediting uniform — every id on the winning side is
 * credited a win — across all five formats.
 */

/** The five generators (§6.8). */
export type RrFormat =
  | "roundRobin" //  E1 — circle-method: everyone meets once (or twice)
  | "mixer" //       E2 — social mixer: rotating partners, balanced, Popcorn no-repeat
  | "movement" //    E3 — court movement: Up & Down the River / King of the Court
  | "swiss" //       E4 — Swiss: nearest-record pairing, no repeats, bye ≤ 1
  | "poolsBracket"; // E5 — pool play → single/double-elim bracket

export type PlayMode = "singles" | "doubles";
export type MovementKind = "upDown" | "king";
export type ElimKind = "single" | "double";

/** A competing unit. For fixed-side formats a doubles TEAM is a single entrant
 *  (e.g. name "Ana & Bo"); for the mixer, entrants are individual players. */
export interface Entrant {
  id: string; // stable within an event (e.g. "e0", "e1", …)
  name: string;
  seed?: number; // 1-based seed (E5 seeding / display ordering)
  rating?: number; // optional DUPR-style rating
}

export interface ScoringConfig {
  pointsToWin: number; // e.g. 11
  winBy: number; // e.g. 2
  cap?: number | null; // hard ceiling (e.g. 15); at cap win-by is ignored; null/undefined = none
  gamesPerMatch?: number; // best-of; v1 defaults to 1 (single game)
}

export interface PoolsConfig {
  poolCount: number; // number of pools (E5)
  advancePerPool: number; // top-N from each pool advance to the bracket
  elim: ElimKind; // bracket type for the knockout stage
}

export interface RrConfig {
  format: RrFormat;
  mode: PlayMode;
  /** Doubles only: true ⇒ partners stay together (team = one entrant, E1/E3/E4/E5);
   *  false ⇒ partners rotate (mixer, E2). Ignored for singles. */
  fixedPartners?: boolean;
  entrants: Entrant[];
  courts: number; // courts available for parallel play (≥1)
  /** Desired rounds. E1: omit ⇒ full RR (n-1, or 2(n-1) if `playEveryoneTwice`).
   *  E2 mixer & E4 swiss: number of rounds to play. E3: number of rounds. */
  rounds?: number;
  playEveryoneTwice?: boolean; // E1 "twice"
  scoring: ScoringConfig;
  /** Deterministic integer seed. Same seed ⇒ identical static schedule. */
  rngSeed: number;
  movement?: MovementKind; // E3
  popcorn?: boolean; // E2 hard no-repeat-partner (capped at the feasible max)
  pools?: PoolsConfig; // E5
}

/** One side of a match: entrant ids (1 = singles / team entrant; 2 = mixer pair). */
export type Side = string[];

export type MatchStatus = "pending" | "scored" | "conflict";

export interface Match {
  id: string; // stable within the event, e.g. "r1m0" or "QF1"
  round: number; // 1-based
  index: number; // 0-based position within the round
  court?: number; // 1-based court, when assigned
  sideA: Side;
  sideB: Side;
  scoreA?: number;
  scoreB?: number;
  /** Bracket plumbing (E5): where winner / loser advance. null ⇒ terminal. */
  winnerTo?: { matchId: string; slot: "A" | "B" } | null;
  loserTo?: { matchId: string; slot: "A" | "B" } | null;
  label?: string; // "Pool A", "QF", "SF", "Final", "3rd place", …
  status?: MatchStatus;
}

export interface RrRound {
  round: number; // 1-based
  matches: Match[];
  byes: string[]; // entrant ids sitting out this round (fairness tracked)
  label?: string; // "Round 1", "Quarterfinals", …
}

export interface Schedule {
  rounds: RrRound[];
  /** True when later rounds depend on entered scores (swiss E4 / king E3 / bracket E5). */
  dynamic: boolean;
}

export interface Standing {
  entrantId: string;
  rank: number; // 1-based, after the tiebreak ladder
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number; // pointsFor - pointsAgainst
  byes: number;
  played: number; // scored matches this entrant took part in
}

export interface ValidationResult {
  ok: boolean;
  errors: string[]; // per-format guard failures (doubles≥4, even fixed teams, swiss≥2R, pools×bracket, …)
  warnings: string[];
}

/** A single match's confirmed score. */
export interface ScoreInput {
  matchId: string;
  scoreA: number;
  scoreB: number;
}

// ── API / persistence DTOs (shared by the data layer and the UI) ──────────────

export type RrEventStatus = "notStarted" | "running" | "complete";

/** UI-facing event metadata (the data layer's RR META item is a superset). */
export interface RrEventMeta {
  eventId: string;
  title: string;
  format: RrFormat;
  mode: PlayMode;
  status: RrEventStatus;
  dynamic: boolean;
  rngSeed: number;
  courts: number;
  scoring: ScoringConfig;
  /** Present once claimed by a signed-in user (else the event is anonymous). */
  organizerId?: string | null;
  championId?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Full event read (pattern 16 — one query on PK=RR#id). */
export interface RrEventFull {
  event: RrEventMeta;
  entrants: Entrant[];
  rounds: RrRound[];
  standings: Standing[];
}

/** POST /api/round-robin body — the no-login create path stamps a token server-side. */
export interface CreateRrInput {
  title: string;
  config: RrConfig; // includes entrants + format + rngSeed
}

/** Response to a create — the anonymous creator persists `creatorToken` locally so
 *  they can score/advance/claim later (N2 `rrCreatorToken`). */
export interface CreateRrResult {
  eventId: string;
  creatorToken: string;
}

// ── Engine surface (implemented in ./engine, re-exported from ./index) ─────────
//
// validateConfig(config): ValidationResult
//   Per-format feasibility guards. Never throws; returns ok=false + messages.
//
// generateSchedule(config): Schedule
//   Static schedule = pure f(config). For dynamic formats returns what is known
//   up front (E5: all pool rounds; E4: round 1; E3 king: round 1) with dynamic=true.
//
// nextRound(config, completed): RrRound | null
//   Dynamic advance = pure f(seed + confirmed scores). Returns the next round, or
//   null when the event is complete. No-op (null) for fully-static formats.
//
// computeStandings(config, rounds): Standing[]
//   Canonical tiebreak ladder (§6.8): wins → point-diff → points-for →
//   head-to-head (E1/E4/E5 only) → fewest byes → seed, then rng. Ranked 1..n.
//
// champion(config, rounds): string | null
//   The event winner once decided (bracket final / clear points leader), else null.
