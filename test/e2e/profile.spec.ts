import { test, expect } from "@playwright/test";

/**
 * Stage 2 profile gate (§14.3): a PUBLIC profile renders with Person JSON-LD and
 * is indexable; a PRIVATE profile is noindex + a minimal card (no field leak).
 * Requires the E2E users seeded by scripts/seed-e2e-users.ts (e2euser/privacyfan).
 */

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    try {
      localStorage.setItem("pl-auth-mode", "dev");
      localStorage.setItem("pl-consent", JSON.stringify({ analytics: false, ads: false, decided: true }));
    } catch {
      /* ignore */
    }
  });
});

test("public profile: indexable, Person JSON-LD, name shown", async ({ page }) => {
  const res = await page.goto("/players/e2euser");
  expect(res?.status()).toBe(200);
  // Not noindexed (public).
  const robots = page.locator('meta[name="robots"]');
  if (await robots.count()) {
    await expect(robots).not.toHaveAttribute("content", /noindex/);
  }
  await expect(page.getByRole("heading", { name: /E2E User/ })).toBeVisible();
  const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).join(" ");
  expect(ld).toContain('"Person"');
});

test("private profile: noindex + minimal card (no detail leak)", async ({ page }) => {
  await page.goto("/players/privacyfan");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByText("This profile is private")).toBeVisible();
  // Private details (ratings/home city) must NOT be exposed on a private profile.
  await expect(page.getByText(/DUPR/i)).toHaveCount(0);
  await expect(page.getByText(/Lawrence/i)).toHaveCount(0);
});
