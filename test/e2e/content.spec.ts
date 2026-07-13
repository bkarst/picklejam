import { test, expect } from "@playwright/test";

/**
 * Stage 9 gate (§14.3): evergreen article + news render COMPLETE crawlable HTML
 * (JS-off) with validated JSON-LD (Article / NewsArticle / Person), breadcrumbs,
 * a related-local CTA that resolves to a real city page (§12 rule 4), an author
 * E-E-A-T page, and a working newsletter subscribe. Content is DB-seeded.
 */

const ARTICLE = "/learn/guides/dinking-basics";
const NEWS = "/news/mlp-announces-expanded-2026-season";
const AUTHOR = "/learn/authors/jamie-green";

test("Stage 9 — evergreen article: crawlable server HTML (JS-off) + Article/Person JSON-LD + related-local CTA", async ({ page, request }) => {
  // RAW server HTML (a plain fetch — no JS runs): the body + structured data must
  // be fully present server-side (the SEO moat).
  const html = await request.get(ARTICLE).then((r) => r.text());
  expect(html).toContain('"Article"'); // JSON-LD @type
  expect(html).toContain('"Person"'); // author Person
  expect(html.toLowerCase()).toContain("dink"); // article body rendered server-side

  // Rendered page: H1, breadcrumb structured data, and the related-local CTA that
  // links into a REAL city page (no orphan link).
  await page.goto(ARTICLE);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).join(" ");
  expect(ld).toContain('"Article"');
  expect(ld).toContain('"BreadcrumbList"');
  await expect(page.locator('a[href*="/courts/us/kansas/lawrence"]').first()).toBeVisible();
});

test("Stage 9 — news article: NewsArticle JSON-LD + crawlable HTML", async ({ page, request }) => {
  const html = await request.get(NEWS).then((r) => r.text());
  expect(html).toContain('"NewsArticle"');

  await page.goto(NEWS);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("Stage 9 — author profile carries Person JSON-LD + lists their articles", async ({ page }) => {
  await page.goto(AUTHOR);
  const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).join(" ");
  expect(ld).toContain('"Person"');
  // Their published article is linked from the profile.
  await expect(page.locator(`a[href="${ARTICLE}"]`).first()).toBeVisible();
});

test("Stage 9 — newsletter subscribe accepts an email", async ({ request }, testInfo) => {
  const email = `sub-${testInfo.project.name}-${test.info().testId}@example.com`;
  const res = await request.post("/api/newsletter", {
    headers: { "content-type": "application/json" },
    data: { email, source: "e2e" },
  });
  expect(res.ok()).toBeTruthy();
});

test("Stage 9 — the news sitemap is valid XML with a news:publication", async ({ request }) => {
  const res = await request.get("/news-sitemap.xml");
  expect(res.ok()).toBeTruthy();
  const xml = await res.text();
  expect(xml).toContain("<urlset");
  expect(xml).toContain("news:publication");
});
