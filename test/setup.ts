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
