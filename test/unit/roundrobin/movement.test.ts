import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { generateSchedule, nextRound } from "@/lib/roundrobin/engine";
import type { RrConfig, RrRound } from "@/lib/roundrobin/types";
import { entrants, SCORING, scoreRound, sideAWins, simulate } from "./_helpers";

function movementConfig(courts: number, kind: "upDown" | "king", rounds: number, seed = 42): RrConfig {
  return {
    format: "movement",
    mode: "singles",
    movement: kind,
    entrants: entrants(courts * 2), // exact fill ⇒ no waiting pool
    courts,
    rounds,
    scoring: SCORING,
    rngSeed: seed,
  };
}

/** Which court (1-based) hosts a given entrant id in a round. */
function courtOf(round: RrRound, id: string): number | null {
  for (const m of round.matches) {
    if (m.sideA.includes(id) || m.sideB.includes(id)) return m.court ?? m.index + 1;
  }
  return null;
}

describe("E3 movement — up & down the river / king (§6.8)", () => {
  it("winners move up one court, losers down one, bounded by the court range", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 5 }),
        fc.integer({ min: 1, max: 1_000_000 }),
        (courts, seed) => {
          const cfg = movementConfig(courts, "upDown", 4, seed);
          const rounds = simulate(cfg, sideAWins);
          for (let r = 0; r < rounds.length - 1; r++) {
            const cur = rounds[r];
            const nxt = rounds[r + 1];
            for (const m of cur.matches) {
              const k = m.court ?? m.index + 1;
              const winner = m.sideA[0]; // sideAWins
              const loser = m.sideB[0];
              const expWin = k === 1 ? 1 : k - 1;
              const expLose = k === courts ? courts : k + 1;
              expect(courtOf(nxt, winner)).toBe(expWin);
              expect(courtOf(nxt, loser)).toBe(expLose);
            }
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it("king dynamic determinism: seed + confirmed scores ⇒ identical next round", () => {
    const cfg = movementConfig(3, "king", 5, 999);
    const r1 = generateSchedule(cfg).rounds;
    const scored = r1.map((r) => scoreRound(r, sideAWins));
    const a = nextRound(cfg, scored);
    const b = nextRound(cfg, scored);
    expect(a).toEqual(b);
    expect(a).not.toBeNull();
  });

  it("king crowns the court-1 holder once the run completes", () => {
    const cfg = movementConfig(3, "king", 4, 5);
    const rounds = simulate(cfg, sideAWins);
    // Simulate returns exactly `rounds` rounds and then nextRound is null.
    expect(nextRound(cfg, rounds)).toBeNull();
    // Champion is the court-1 winner of the final round.
    const last = rounds[rounds.length - 1];
    const top = last.matches.find((m) => (m.court ?? m.index + 1) === 1)!;
    expect(top.sideA[0]).toBeTruthy();
  });

  it("every round is a valid seating (no entrant appears twice)", () => {
    const cfg = movementConfig(4, "upDown", 6, 3);
    for (const r of simulate(cfg, sideAWins)) {
      const seen = new Set<string>();
      for (const m of r.matches) for (const id of [...m.sideA, ...m.sideB]) {
        expect(seen.has(id)).toBe(false);
        seen.add(id);
      }
      for (const id of r.byes) {
        expect(seen.has(id)).toBe(false);
        seen.add(id);
      }
    }
  });
});
