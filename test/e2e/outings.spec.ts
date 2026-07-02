import { test, expect } from "@playwright/test";

/**
 * Stage 4 gate (§14.3): J3 — Create outing → RSVP → waitlist.
 *
 * Covered end-to-end through the real HTTP + UI stack:
 *  - an organizer creates a game via the 5-step wizard (reached from the court's
 *    "add a game" on-ramp, which prefills ?court=<id>) → lands on the outing
 *    detail page with crawlable SportsEvent JSON-LD;
 *  - the organizer RSVPs "Going" and sees the optimistic confirmation;
 *  - a seeded FULL (capacity-1, waitlist-on) game puts the next player on the
 *    waitlist at position #1 — capacity enforced, never oversold;
 *  - a seeded future public game appears on the court's Upcoming Games grid.
 *
 * Capacity concurrency, OUTING+OUTINGREF+RSVP item shapes, and series RRULE
 * expansion are additionally covered by the vitest unit/integration suites.
 * Dev-auth + consent pre-decided for determinism (init script must NOT clear the
 * dev session — it re-runs on every navigation).
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

test("J3 — organizer creates a game via the wizard, then RSVPs Going", async ({ page }) => {
  await devLogin(page, "creator@dev.local");

  // Organizer on-ramp: from the court page → wizard with the court prefilled.
  await page.goto(COURT);
  await page.getByRole("link", { name: /add a game/i }).first().click();
  await page.waitForURL(/\/outings\/new\?court=/);

  // Step 1 (Where) — court is prefilled from ?court, so just advance.
  await expect(page.getByText("Selected court")).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click(); // → When
  await page.getByRole("button", { name: "Next" }).click(); // → Details

  // Step 3 (Details) — title is required to advance.
  await page.getByPlaceholder("e.g. Morning Open Play").fill("E2E Twilight Rally");
  await page.getByRole("button", { name: "Next" }).click(); // → Visibility
  await page.getByRole("button", { name: "Next" }).click(); // → Review

  await page.getByRole("button", { name: "Create game" }).click();

  // Landed on the new outing detail page.
  await page.waitForURL(/\/outings\/[0-9A-Za-z]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "E2E Twilight Rally" })).toBeVisible();

  // Crawlable SportsEvent structured data (§3.4).
  const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).join(" ");
  expect(ld).toContain('"SportsEvent"');
  expect(ld).toContain("E2E Twilight Rally");

  // RSVP Going (game has capacity → not full → direct "I'm Going!").
  await page.getByRole("button", { name: /i'm going/i }).click();
  await expect(page.getByText(/you're going/i)).toBeVisible({ timeout: 10_000 });
});

test("J3 — a full game places the next RSVP on the waitlist (capacity enforced)", async ({ page }, testInfo) => {
  // Per-project user: chromium + mobile run in parallel against the same seeded
  // outing, so a shared uid would collide on one RSVP row. Distinct users simply
  // both join the same waitlist (positions #1/#2) — no contended row.
  await devLogin(page, `waitlister-${testInfo.project.name}@dev.local`);

  await page.goto("/outings/e2ewait");
  // The one spot is already taken by the organizer.
  await expect(page.getByText("(1/1)")).toBeVisible();

  // Full + waitlist enabled → the primary action is "Join Waitlist". Retry the click
  // until it takes: under parallel load the client can hydrate after the button is
  // visible, so a first click may be a no-op (re-joining a waitlist is idempotent).
  await expect(async () => {
    await page.getByRole("button", { name: /join waitlist/i }).click();
    await expect(page.getByText(/you're on the waitlist/i)).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 20_000 });

  // Not oversold — still 1/1 going.
  await expect(page.getByText("(1/1)")).toBeVisible();
});

test("J3 — a future public game appears on the court's Upcoming Games grid", async ({ page }) => {
  await page.goto(COURT);
  await expect(page.getByRole("link", { name: /Morning Open Play/i }).first()).toBeVisible();
});
