/**
 * Ambient types for jest-axe (v10 ships none; @types/jest-axe targets jest).
 * Pure ambient module declaration — no top-level import/export (keeps it a script
 * file so `declare module` reliably declares the new module).
 */
declare module "jest-axe" {
  interface AxeViolation {
    id: string;
    impact?: "minor" | "moderate" | "serious" | "critical" | null;
    description: string;
    nodes: unknown[];
  }
  interface AxeResults {
    violations: AxeViolation[];
    passes: unknown[];
  }
  export function axe(html: Element | string, options?: unknown): Promise<AxeResults>;
  export function configureAxe(options?: unknown): typeof axe;
  export const toHaveNoViolations: {
    toHaveNoViolations(results: AxeResults): { pass: boolean; message: () => string };
  };
}
