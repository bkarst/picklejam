import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Walking-skeleton smoke (roadmap Stage 0 E2E gate): the app shell renders as
 * complete crawlable HTML, crawl artifacts serve, 404 is branded, axe is clean,
 * and there's no mobile horizontal overflow.
 */

test.describe("walking skeleton", () => {
  test("home renders shell (H1, header, footer) as static HTML", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
  });

  test("robots.txt serves with disallows + the sitemap index", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/Disallow/i);
    // §3.7: robots advertises the single sitemap INDEX (/sitemap-index.xml);
    // crawlers discover every /sitemap/<id>.xml segment transitively through it.
    expect(body).toMatch(/Sitemap:.*\/sitemap-index\.xml/i);
  });

  test("/sitemap-index.xml serves the sitemap index over the segments", async ({ request }) => {
    const res = await request.get("/sitemap-index.xml");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("<sitemapindex");
    expect(body).toContain("/sitemap/static.xml");
  });

  test("a segment sitemap serves valid XML", async ({ request }) => {
    const res = await request.get("/sitemap/static.xml");
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain("<urlset");
  });

  test("default OG image renders as a PNG", async ({ request }) => {
    const res = await request.get("/opengraph-image");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");
  });

  test("unknown route renders the branded 404", async ({ page }) => {
    const res = await page.goto("/this-page-does-not-exist");
    expect(res?.status()).toBe(404);
    await expect(page.getByText("404")).toBeVisible();
  });

  test("home is axe-clean (no serious/critical violations)", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      // The two-tone brand wordmark is a logotype (WCAG 1.4.3-exempt from the
      // text-contrast requirement); every other element is held to AA.
      .exclude("[data-logo]")
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });

  test("no horizontal overflow on a phone viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(false);
  });
});
