/**
 * movement.ts — E3: court movement (§6.8).
 *
 * Courts are ranked 1 (top) .. C (bottom); each hosts one match between two
 * sides (a "side" is one entrant — a singles player or a fixed team). After a
 * round, winners move UP one court and losers move DOWN one court, bounded by
 * the court range (court-1 winner and court-C loser hold their court). Extra
 * entrants beyond 2·C wait in a bye pool and cycle in at the bottom court.
 *
 * Because the movement is a function of who *won*, both kinds are DYNAMIC:
 * `generateSchedule` returns round 1, `nextRound` advances from confirmed
 * scores. `upDown` = "Up & Down the River"; `king` = "King of the Court"
 * (identical movement; king additionally crowns the court-1 holder). Ties are
 * resolved in favour of the upper side (side A) holding its court.
 */

import type { Match, RrConfig, RrRound } from "../types";
import { mkMatch, outcome, seededOrder } from "./shared";

/** Sides that can be seated (2 per court) given entrants + courts. */
function courtsUsed(config: RrConfig): number {
  return Math.max(1, Math.min(config.courts, Math.floor(config.entrants.length / 2)));
}

/** Total movement rounds (config-driven; defaults to a full rotation). */
export function movementRounds(config: RrConfig): number {
  const active = courtsUsed(config) * 2;
  return config.rounds ?? Math.max(1, active - 1);
}

function buildRoundFromSeating(
  seating: string[][],
  waitingSides: string[][],
  roundNum: number,
  courts: number,
): RrRound {
  const matches: Match[] = [];
  for (let k = 0; k < courts; k++) {
    const upper = seating[2 * k];
    const lower = seating[2 * k + 1];
    matches.push(mkMatch(roundNum, k, [upper[0]], [lower[0]], { court: k + 1 }));
  }
  return {
    round: roundNum,
    matches,
    byes: waitingSides.flat(),
    label: `Round ${roundNum}`,
  };
}

/** Round 1: seed-shuffle entrants, seat two per court top→bottom. */
export function movementRound1(config: RrConfig): RrRound {
  const C = courtsUsed(config);
  const sides = seededOrder(
    config.entrants.map((e) => e.id),
    config.rngSeed,
  ).map((id) => [id]);
  const active = sides.slice(0, C * 2).flat();
  const waiting = sides.slice(C * 2).flat();
  return buildRoundFromSeating(
    active.map((id) => [id]),
    waiting.map((id) => [id]),
    1,
    C,
  );
}

/** Winner / loser entrant id for a court's match (tie ⇒ upper side holds). */
function resolve(m: Match): { winner: string; loser: string } {
  const o = outcome(m);
  if (o === "B") return { winner: m.sideB[0], loser: m.sideA[0] };
  // "A" or "tie" (upper holds) or unscored (fall back to upper) — deterministic.
  return { winner: m.sideA[0], loser: m.sideB[0] };
}

/**
 * Advance one movement round from the just-completed round: winners up, losers
 * down, bottom loser cycles to the bye pool when a waiting entrant exists.
 */
export function movementNext(config: RrConfig, completed: RrRound[]): RrRound | null {
  if (completed.length === 0) return movementRound1(config);
  if (completed.length >= movementRounds(config)) return null;

  const last = completed[completed.length - 1];
  const C = last.matches.length;
  const byCourt = [...last.matches].sort((a, b) => (a.court ?? a.index) - (b.court ?? b.index));
  const win: string[] = [];
  const los: string[] = [];
  for (const m of byCourt) {
    const { winner, loser } = resolve(m);
    win.push(winner);
    los.push(loser);
  }
  const waiting = last.byes.slice();

  // Next seating[2k]=upper, seating[2k+1]=lower for court k (0-based).
  const seating: string[][] = Array.from({ length: C * 2 }, () => [""]);
  const set = (court: number, slot: 0 | 1, id: string) => {
    seating[2 * court + slot] = [id];
  };

  if (C === 1) {
    set(0, 0, win[0]);
    if (waiting.length === 0) {
      set(0, 1, los[0]);
    } else {
      set(0, 1, waiting[0]);
      waiting.push(los[0]);
      waiting.shift();
    }
  } else {
    // Top court: its winner stays, the winner from court 2 comes up.
    set(0, 0, win[0]);
    set(0, 1, win[1]);
    // Middle courts k (1..C-2): loser from above drops in, winner from below rises.
    for (let k = 1; k < C - 1; k++) {
      set(k, 0, los[k - 1]);
      set(k, 1, win[k + 1]);
    }
    // Bottom court: loser from above drops in; its own loser stays or cycles out.
    set(C - 1, 0, los[C - 2]);
    if (waiting.length === 0) {
      set(C - 1, 1, los[C - 1]);
    } else {
      set(C - 1, 1, waiting[0]);
      waiting.push(los[C - 1]);
      waiting.shift();
    }
  }

  return buildRoundFromSeating(seating, waiting.map((id) => [id]), completed.length + 1, C);
}

/** King of the Court: the court-1 winner of the final round is the king. */
export function movementChampion(config: RrConfig, rounds: RrRound[]): string | null {
  if (config.movement !== "king") return null;
  if (rounds.length < movementRounds(config)) return null;
  const last = rounds[rounds.length - 1];
  const top = last.matches.find((m) => (m.court ?? m.index + 1) === 1);
  if (!top || outcome(top) === null) return null;
  return resolve(top).winner;
}
