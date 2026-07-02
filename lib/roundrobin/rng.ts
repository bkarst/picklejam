/**
 * rng.ts — the ONLY source of randomness in the round-robin engine (§14.1).
 *
 * A tiny, fast, fully-deterministic PRNG (mulberry32). Given the same integer
 * seed it yields the same stream on every machine and every viewer — which is
 * what makes "static schedule = f(rngSeed)" and "dynamic round = f(rngSeed +
 * confirmed scores)" reproducible. The engine must NEVER use `Math.random`.
 */

/** mulberry32 — 32-bit seed → deterministic `[0,1)` generator. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in `[0, n)` from an rng. */
export function randInt(rng: () => number, n: number): number {
  return Math.floor(rng() * n);
}

/** Fisher–Yates — returns a NEW shuffled array; does not mutate the input. */
export function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Derive a stable sub-seed (e.g. per-round) so nested draws stay reproducible. */
export function deriveSeed(seed: number, salt: number): number {
  // xmix the two integers → a new 32-bit seed.
  let h = (seed ^ Math.imul(salt + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
