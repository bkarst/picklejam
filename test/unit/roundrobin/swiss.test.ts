import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { generateSchedule, nextRound } from "@/lib/roundrobin/engine";
import type { RrConfig } from "@/lib/roundrobin/types";
import { entrants, pairKey, SCORING, scoreRound, sideAWins, simulate } from "./_helpers";

function swissConfig(n: number, rounds: number, seed = 2024): RrConfig {
  return {
    format: "swiss",
    mode: "singles",
    entrants: entrants(n),
    courts: 4,
    rounds,
    scoring: SCORING,
    rngSeed: seed,
  };
}

describe("E4 swiss — nearest-record pairing (§6.8)", () => {
  it("bye ≤ 1 per player; no entrant appears twice in a round", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 4, max: 11 }),
        fc.integer({ min: 2, max: 4 }),
        fc.integer({ min: 1, max: 1_000_000 }),
        (n, rounds, seed) => {
          const cfg = swissConfig(n, rounds, seed);
          const played = simulate(cfg, sideAWins);
          const byeCount = new Map<string, number>();
          for (const r of played) {
            const seen = new Set<string>();
            for (const m of r.matches) for (const id of [...m.sideA, ...m.sideB]) {
              expect(seen.has(id)).toBe(false);
              seen.add(id);
            }
            for (const id of r.byes) {
              byeCount.set(id, (byeCount.get(id) ?? 0) + 1);
              expect(seen.has(id)).toBe(false);
              seen.add(id);
            }
          }
          for (const c of byeCount.values()) expect(c).toBeLessThanOrEqual(1);
          expect(played.length).toBe(rounds);
        },
      ),
      { numRuns: 60 },
    );
  });

  // Undirected pairing key (mirrors the engine) + a brute-force "does a rematch-free
  // perfect matching exist on these players given prior pairings?" oracle.
  const mk = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  function hasRematchFreeMatching(players: string[], played: Set<string>): boolean {
    if (players.length === 0) return true;
    const [p, ...rest] = players;
    for (let k = 0; k < rest.length; k++) {
      if (!played.has(mk(p, rest[k]))) {
        const remaining = [...rest.slice(0, k), ...rest.slice(k + 1)];
        if (hasRematchFreeMatching(remaining, played)) return true;
      }
    }
    return false;
  }
  /** Assert every scheduled rematch was GENUINELY unavoidable (no rematch-free matching). */
  function assertNoAvoidableRematch(cfg: RrConfig): void {
    const played = new Set<string>();
    for (const r of simulate(cfg, sideAWins)) {
      const players = r.matches.flatMap((m) => [m.sideA[0], m.sideB[0]]);
      const rematched = r.matches.some((m) => played.has(mk(m.sideA[0], m.sideB[0])));
      if (rematched) {
        // A rematch is only legitimate when NO rematch-free perfect matching existed on
        // this round's paired players. Pre-fix the greedy emitted rematches while one did.
        expect(hasRematchFreeMatching(players, played)).toBe(false);
      }
      for (const m of r.matches) played.add(mk(m.sideA[0], m.sideB[0]));
    }
  }

  it("M28: 8 players over 6 rounds (seed 1) — no avoidable rematch (smoke)", () => {
    assertNoAvoidableRematch(swissConfig(8, 6, 1));
  });

  // The red→green anchor: the greedy scheduled avoidable rematches for some (n, rounds, seed);
  // the brute-force oracle catches ANY rematch the engine could have avoided.
  it("M28: never schedules an avoidable rematch across sizes/rounds/seeds (brute-force verified)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 4, max: 10 }),
        fc.integer({ min: 3, max: 6 }),
        fc.integer({ min: 1, max: 1_000_000 }),
        (n, rounds, seed) => assertNoAvoidableRematch(swissConfig(n, rounds, seed)),
      ),
      { numRuns: 120 },
    );
  });

  it("no rematch while avoidable (8 players, 3 rounds)", () => {
    const cfg = swissConfig(8, 3, 55);
    const seen = new Set<string>();
    for (const r of simulate(cfg, sideAWins)) {
      for (const m of r.matches) {
        const key = pairKey(m.sideA[0], m.sideB[0]);
        expect(seen.has(key)).toBe(false); // rematch would be unavoidable only with more rounds
        seen.add(key);
      }
    }
  });

  it("dynamic determinism: same (config, completed) ⇒ identical next round", () => {
    const cfg = swissConfig(9, 4, 321);
    const r1 = generateSchedule(cfg).rounds.map((r) => scoreRound(r, sideAWins));
    expect(nextRound(cfg, r1)).toEqual(nextRound(cfg, r1));
  });

  it("generateSchedule returns round 1 and is marked dynamic", () => {
    const cfg = swissConfig(6, 3);
    const sched = generateSchedule(cfg);
    expect(sched.dynamic).toBe(true);
    expect(sched.rounds).toHaveLength(1);
    expect(sched.rounds[0].matches).toHaveLength(3);
  });
});
