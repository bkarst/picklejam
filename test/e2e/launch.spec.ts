import { test, expect } from "@playwright/test";

/**
 * Stage 10 release gate (§2.1/§2.2/§16): AdSense eligibility (ads render on eligible
 * content pages, SUPPRESSED on the homepage + payment/account surfaces), ads.txt,
 * Consent Mode banner, and the marketing/legal pages (crawlable + JSON-LD + a real
 * 404 for an unknown legal doc). NOTE: no consent is pre-decided here (unlike the
 * other specs) so the consent banner is exercised. With no ADSENSE publisher id in
 * the E2E env, an eligible AdSlot shows its house-ad (aria-label "PickleLoko tip").
 */

const HOUSE_AD = '[aria-label="PickleLoko tip"], [aria-label="Advertisement"]';

test("release — ads render on an eligible content page, suppressed on the homepage (§2.2)", async ({ page }) => {
  // Eligible: a city directory page carries an ad slot.
  await page.goto("/courts/us/kansas/lawrence");
  await expect(page.locator(HOUSE_AD).first()).toBeVisible();

  // Ineligible: the homepage never carries ads.
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expect(page.locator(HOUSE_AD)).toHaveCount(0);
});

test("release — ads.txt serves valid text/plain", async ({ request }) => {
  const res = await request.get("/ads.txt");
  expect(res.ok()).toBeTruthy();
  expect(res.headers()["content-type"]).toContain("text/plain");
});

test("release — marketing + legal render crawlable HTML + JSON-LD; unknown legal doc 404s", async ({ page, request }) => {
  // Pricing: FAQPage JSON-LD, in raw server HTML (JS-off).
  const pricingHtml = await request.get("/pricing").then((r) => r.text());
  expect(pricingHtml).toContain('"FAQPage"');
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

  // A legal doc renders and is indexable (no noindex robots meta — count avoids the
  // 30s auto-wait that getAttribute() incurs when the element legitimately absent).
  await page.goto("/legal/privacy");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  expect(await page.locator('meta[name="robots"][content*="noindex"]').count()).toBe(0);

  // An unknown legal doc is a real 404 (generateStaticParams + dynamicParams:false).
  const missing = await page.goto("/legal/does-not-exist");
  expect(missing?.status()).toBe(404);
});

test("release — the consent banner is presented and can be declined (Consent Mode v2)", async ({ page }) => {
  await page.goto("/courts/us/kansas/lawrence");
  const banner = page.getByRole("dialog", { name: /cookie consent/i });
  await expect(banner).toBeVisible();
  await banner.getByRole("button", { name: /reject|essential/i }).click();
  await expect(banner).toBeHidden();
});

test("release — contact form endpoint accepts a message", async ({ request }) => {
  const res = await request.post("/api/contact", {
    headers: { "content-type": "application/json" },
    data: { name: "E2E Tester", email: "e2e@example.com", message: "This is a release-gate contact message." },
  });
  expect(res.ok()).toBeTruthy();
});
