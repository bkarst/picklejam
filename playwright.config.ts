import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config (PRD §14.3). E2E runs against a PRODUCTION build
 * (`next build && next start`) — the SEO moat requires asserting real rendered
 * HTML. Stage 0 covers the walking-skeleton smoke; later stages wire DynamoDB
 * Local + Stripe test mode + stubbed maps/weather/geo-IP over the seed fixture.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "test/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: BASE_URL, trace: "on-first-retry" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    // webkit + firefox added in the Stage 1 SEO/render moat gate.
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
