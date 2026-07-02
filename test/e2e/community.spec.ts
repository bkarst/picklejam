import { test, expect } from "@playwright/test";

/**
 * Stage 3 gate (§14.3): J1 (discover → court → check in, anonymous then authed)
 * and J9 (review submit → Stream ratingAvg/reviewCount + Review JSON-LD).
 * Dev-auth + consent pre-decided for determinism. (The init script must NOT clear
 * the dev session — it re-runs on every navigation.)
 */

const COURT = "/courts/us/kansas/lawrence/sports-pavilion-at-rock-chalk-park";

async function devLogin(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("devpass123");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/account/);
}

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

test("J1 — anonymous check-in records a durable same-day check-in", async ({ page }) => {
  await page.goto(COURT);
  await page.getByRole("button", { name: "Check In" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /check in without an account/i }).click();
  await expect(dialog.getByText(/checked in today/i)).toBeVisible({ timeout: 10_000 });
  // Anonymous upsell offered (no identity captured).
  await expect(dialog.getByRole("button", { name: "Create a profile" })).toBeVisible();
});

test("J1 — authed check-in shows in My Check-in history", async ({ page }) => {
  await devLogin(page, "checkin.user@dev.local");

  await page.goto(COURT);
  await page.getByRole("button", { name: "Check In" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Check in", exact: true }).click();
  await expect(dialog.getByText(/checked in today/i)).toBeVisible({ timeout: 10_000 });
  await dialog.getByRole("button", { name: "Done" }).click();

  await page.goto("/account/checkins");
  await expect(page.getByText(/Sports Pavilion/i).first()).toBeVisible({ timeout: 10_000 });
});

test("J9 — seeded review renders crawlably with Review + AggregateRating JSON-LD", async ({ page }) => {
  await page.goto(COURT);
  const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).join(" ");
  expect(ld).toContain('"Review"');
  expect(ld).toContain('"AggregateRating"'); // populated now that reviewCount > 0
  await expect(page.getByText("Immaculate indoor courts", { exact: false })).toBeVisible();
});

test("J9 — a signed-in user can submit a review (one per user)", async ({ page }) => {
  await devLogin(page, "reviewer@dev.local");

  await page.goto(COURT);
  await page.getByRole("button", { name: /write a review/i }).click();
  // The composer is inline (not a dialog). The star radios are sr-only inputs
  // (the visible label captures the click) → force past the actionability check.
  await page.getByRole("radio", { name: /4 stars/i }).check({ force: true });
  await page.getByPlaceholder("Sum it up").fill("Solid courts");
  await page.getByPlaceholder(/How were the courts/i).fill("Great nets and plenty of parking.");
  await page.getByRole("button", { name: "Post review" }).click();
  await expect(page.getByText("Solid courts")).toBeVisible({ timeout: 10_000 });
});
