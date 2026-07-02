import { describe, it, expect } from "vitest";
import { validateConfig } from "@/lib/roundrobin/engine";
import type { RrConfig } from "@/lib/roundrobin/types";
import { entrants, SCORING } from "./_helpers";

const base = (over: Partial<RrConfig>): RrConfig => ({
  format: "roundRobin",
  mode: "singles",
  entrants: entrants(6),
  courts: 2,
  scoring: SCORING,
  rngSeed: 1,
  ...over,
});

describe("validateConfig — per-format guards (§6.8)", () => {
  it("accepts a well-formed config", () => {
    const res = validateConfig(base({}));
    expect(res.ok).toBe(true);
    expect(res.errors).toEqual([]);
  });

  it("never throws and always returns the shape", () => {
    const res = validateConfig(base({ entrants: [] }));
    expect(res).toHaveProperty("ok");
    expect(res).toHaveProperty("errors");
    expect(res).toHaveProperty("warnings");
  });

  it("courts ≥ 1, pointsToWin ≥ 1, winBy ≥ 1", () => {
    expect(validateConfig(base({ courts: 0 })).ok).toBe(false);
    expect(validateConfig(base({ scoring: { pointsToWin: 0, winBy: 2 } })).ok).toBe(false);
    expect(validateConfig(base({ scoring: { pointsToWin: 11, winBy: 0 } })).ok).toBe(false);
  });

  it("rejects duplicate entrant ids and <2 entrants", () => {
    expect(validateConfig(base({ entrants: [{ id: "x", name: "x" }] })).ok).toBe(false);
    expect(
      validateConfig(base({ entrants: [{ id: "x", name: "x" }, { id: "x", name: "y" }] })).errors.join(),
    ).toMatch(/unique/i);
  });

  it("mixer (doubles) requires ≥ 4 entrants", () => {
    const bad = validateConfig(base({ format: "mixer", mode: "doubles", fixedPartners: false, entrants: entrants(3) }));
    expect(bad.ok).toBe(false);
    expect(bad.errors.join()).toMatch(/at least 4/i);
    expect(validateConfig(base({ format: "mixer", mode: "doubles", fixedPartners: false, entrants: entrants(4) })).ok).toBe(true);
  });

  it("swiss requires ≥ 2 rounds", () => {
    expect(validateConfig(base({ format: "swiss", rounds: 1 })).ok).toBe(false);
    expect(validateConfig(base({ format: "swiss" })).ok).toBe(false); // rounds undefined
    expect(validateConfig(base({ format: "swiss", rounds: 3 })).ok).toBe(true);
  });

  it("movement requires a movement kind", () => {
    expect(validateConfig(base({ format: "movement" })).ok).toBe(false);
    expect(validateConfig(base({ format: "movement", movement: "king", courts: 2, entrants: entrants(4) })).ok).toBe(true);
  });

  it("poolsBracket: needs pools config, ≥2 qualifiers, and advancePerPool ≤ pool size", () => {
    expect(validateConfig(base({ format: "poolsBracket" })).ok).toBe(false);
    // advance more than the pool can hold
    expect(
      validateConfig(base({ format: "poolsBracket", entrants: entrants(4), pools: { poolCount: 2, advancePerPool: 3, elim: "single" } })).ok,
    ).toBe(false);
    // 1 pool advancing 1 ⇒ only 1 qualifier, no bracket
    expect(
      validateConfig(base({ format: "poolsBracket", pools: { poolCount: 1, advancePerPool: 1, elim: "single" } })).ok,
    ).toBe(false);
    // valid
    const ok = validateConfig(base({ format: "poolsBracket", entrants: entrants(8), pools: { poolCount: 2, advancePerPool: 2, elim: "single" } }));
    expect(ok.ok).toBe(true);
  });

  it("warns (not errors) when qualifiers are not a power of two", () => {
    const res = validateConfig(base({ format: "poolsBracket", entrants: entrants(9), pools: { poolCount: 3, advancePerPool: 1, elim: "single" } }));
    expect(res.ok).toBe(true);
    expect(res.warnings.join()).toMatch(/power of two/i);
  });
});
