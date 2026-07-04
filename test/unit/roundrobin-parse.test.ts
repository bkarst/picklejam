import { describe, it, expect } from "vitest";
import { parseConfig } from "@/app/api/round-robin/_util";

/**
 * parseConfig scoring allowlist — regression for M18: the round-robin "Time cap"
 * setting (minutes) was collected in the builder but the server-side scoring parser
 * only carried pointsToWin/winBy/cap, silently STRIPPING `timeCapMin` on create. A time
 * cap (wall-clock, e.g. 15 min) is distinct from `cap` (a points ceiling), so it needs
 * its own field that survives the parse. These assert the parser now carries it.
 */
const rawBase = {
  format: "roundRobin",
  mode: "singles",
  entrants: [
    { id: "e0", name: "A", seed: 1 },
    { id: "e1", name: "B", seed: 2 },
    { id: "e2", name: "C", seed: 3 },
    { id: "e3", name: "D", seed: 4 },
  ],
  courts: 2,
  rngSeed: 42,
};

describe("parseConfig scoring.timeCapMin (M18)", () => {
  it("carries a chosen time cap through the server allowlist", () => {
    const cfg = parseConfig({
      ...rawBase,
      scoring: { pointsToWin: 11, winBy: 2, cap: null, timeCapMin: 15 },
    });
    expect(cfg.scoring.timeCapMin).toBe(15); // pre-fix: stripped → undefined
    // The distinct points ceiling is unaffected.
    expect(cfg.scoring.cap).toBeNull();
    expect(cfg.scoring.pointsToWin).toBe(11);
  });

  it("treats absent / zero as 'no time cap', and carries an explicit null", () => {
    expect(
      parseConfig({ ...rawBase, scoring: { pointsToWin: 11, winBy: 2 } }).scoring.timeCapMin,
    ).toBeUndefined();
    expect(
      parseConfig({ ...rawBase, scoring: { pointsToWin: 11, winBy: 2, timeCapMin: 0 } }).scoring.timeCapMin,
    ).toBeUndefined();
    expect(
      parseConfig({ ...rawBase, scoring: { pointsToWin: 11, winBy: 2, timeCapMin: null } }).scoring.timeCapMin,
    ).toBeNull();
  });
});
