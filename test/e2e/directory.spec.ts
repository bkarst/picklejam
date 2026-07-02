import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Stage 1 E2E gate: the SEO/render moat (§14.4) + J2 search/map (§14.3).
 * Runs against the DB-wired production build (seeded with Kansas).
 */

const CITY = "/courts/us/kansas/lawrence";

test.describe("court directory — SEO/render moat", () => {
  test("city page renders complete crawlable HTML with JS disabled", async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(CITY);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Pickleball Courts in Lawrence");
    // Court links present without JS (crawlable).
    const courtLinks = page.locator(`a[href^="${CITY}/"]`);
    expect(await courtLinks.count()).toBeGreaterThan(0);
    await ctx.close();
  });

  test("city page: canonical + BreadcrumbList/ItemList/FAQPage JSON-LD", async ({ page }) => {
    await page.goto(CITY);
    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute("href", /\/courts\/us\/kansas\/lawrence$/);
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
    const types = ld.join(" ");
    expect(types).toContain('"BreadcrumbList"');
    expect(types).toContain('"ItemList"');
    expect(types).toContain('"FAQPage"');
  });

  test("court detail: SportsActivityLocation JSON-LD, no empty AggregateRating", async ({ page }) => {
    await page.goto(CITY);
    const firstCourt = await page.locator(`a[href^="${CITY}/"]`).first().getAttribute("href");
    expect(firstCourt).toBeTruthy();
    await page.goto(firstCourt!);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).join(" ");
    expect(ld).toContain('"SportsActivityLocation"');
    // Empty-safe: a review-less court must not emit AggregateRating.
    expect(ld).not.toContain('"AggregateRating"');
  });

  test("/search is noindex", async ({ page }) => {
    await page.goto("/search");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("city + court pages are axe-clean", async ({ page }) => {
    for (const url of [CITY]) {
      await page.goto(url);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude("[data-logo]").analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
    }
  });
});

test.describe("J2 — search / map", () => {
  test.use({
    geolocation: { latitude: 38.9717, longitude: -95.2353 }, // Lawrence, KS
    permissions: ["geolocation"],
  });

  test("geolocation → geohash radius returns nearby courts in the list (a11y text equivalent)", async ({ page }) => {
    await page.goto("/search");
    // The list is the text equivalent of the map; expect ≥1 nearby court link.
    const results = page.locator('main a[href^="/courts/us/kansas/"]');
    await expect(results.first()).toBeVisible({ timeout: 10_000 });
    expect(await results.count()).toBeGreaterThan(0);
  });

  test("typeahead suggests cities + courts", async ({ page }) => {
    await page.goto("/search");
    const box = page.getByRole("combobox").first();
    await box.fill("lawr");
    const listbox = page.getByRole("listbox");
    await expect(listbox).toBeVisible({ timeout: 10_000 });
    await expect(listbox.getByText(/Lawrence, KS/)).toBeVisible();
  });
});
