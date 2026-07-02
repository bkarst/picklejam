/**
 * Augments Vitest's matchers with `toHaveNoViolations` (registered in
 * test/setup.ts from jest-axe). jest-dom's own vitest matchers come from
 * "@testing-library/jest-dom/vitest".
 */
import "vitest";

declare module "vitest" {
  interface Assertion<T = unknown> {
    toHaveNoViolations(): T;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): unknown;
  }
}
