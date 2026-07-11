/**
 * Global test setup (PRD §14.1 determinism). Adds jest-dom + axe matchers for
 * component tests. A fixed clock / seeded RNG are injected per-test where needed
 * (the engine takes an explicit `rngSeed`; DB helpers accept an injectable `now`).
 */
import "@testing-library/jest-dom/vitest";
import { toHaveNoViolations } from "jest-axe";
import { expect } from "vitest";

// jest-axe ships a jest-shaped matcher object ({ toHaveNoViolations }); vitest's
// expect.extend accepts it at runtime (cast bridges the jest↔vitest matcher types).
expect.extend(toHaveNoViolations as unknown as Parameters<typeof expect.extend>[0]);

// jsdom doesn't implement `window.matchMedia`, so any component that reads a media
// query (e.g. `useReducedMotion`) throws on render in component tests. Provide a
// minimal, non-matching stub (reduced-motion OFF; no-op listeners). Guarded by
// `typeof window` so it's a no-op in node-environment (integration) suites.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string): MediaQueryList =>
      ({
        // Report `prefers-reduced-motion` ON so components take their deterministic,
        // animation-free path (no GSAP timelines under jsdom + fake timers); any
        // other query resolves to non-matching.
        matches: /prefers-reduced-motion/i.test(query),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  });
}
