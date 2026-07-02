import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest config (PRD §14.2). Default `node` environment for unit/integration;
 * component tests opt into jsdom with a `// @vitest-environment jsdom` header.
 * `server-only` is stubbed so server modules (lib/db, lib/stripe…) import cleanly
 * outside Next. E2E lives in Playwright (`playwright.config.ts`), not here.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
      "server-only": path.resolve(import.meta.dirname, "test/stubs/empty.ts"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["test/setup.ts"],
    include: ["test/**/*.test.{ts,tsx}"],
    exclude: ["test/e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      include: ["lib/**", "components/**", "brand.config.ts"],
      exclude: ["**/*.d.ts", "test/**"],
    },
  },
});
