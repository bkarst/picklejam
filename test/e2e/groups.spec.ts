import { test, expect } from "@playwright/test";

/**
 * Stage 8 gate (§14.3): a group create → join → schedule a meet-up (reusing the
 * Outings flow) → the meet-up shows on the group detail + city game finder, and
 * the group shows on the court's "Groups that play here" rail + city group finder;
 * PLUS a private group stays noindex and out of every public rail. The seed sets up
 * the group + meet-up (FakeGateway / dev-auth); this verifies the surfaces.
 */

const COURT = "/courts/us/kansas/lawrence/sports-pavilion-at-rock-chalk-park";

function devUid(email: string): string {
  return "dev_" + email.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function devToken(email: string): string {
  const payload = JSON.stringify({ uid: devUid(email), email });
  const b64 = Buffer.from(payload).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return "dev." + b64;
}
const AUTH = (email: string) => ({ Authorization: `Bearer ${devToken(email)}`, "content-type": "application/json" });

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

test("Stage 8 — public group: detail + meet-up + court rail + city finder + open join", async ({ page, request }, testInfo) => {
  // The open-join mutates the one shared seeded group — run on a single project.
  test.skip(testInfo.project.name !== "chromium", "join mutates shared seeded group");

  // Group detail: name + crawlable SportsOrganization JSON-LD. The meet-up's place &
  // time are MEMBERS-ONLY (§6.9), so a non-member (signed-out here) sees a join prompt,
  // never the meet-up itself — even though the group and its identity are public.
  await page.goto("/groups/e2egroup");
  await expect(page.getByText("Lawrence Dinkers Club").first()).toBeVisible();
  await expect(page.getByText("Dinkers Club Open Play")).toHaveCount(0);
  await expect(page.getByText(/visible to members/i)).toBeVisible();
  const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).join(" ");
  expect(ld).toContain('"SportsOrganization"');

  // City group finder lists the public group.
  await page.goto("/groups/in/us/kansas/lawrence");
  await expect(page.getByText("Lawrence Dinkers Club").first()).toBeVisible();

  // The court's "Groups that play here" rail shows it.
  await page.goto(COURT);
  await expect(page.getByText(/groups that play here/i)).toBeVisible();
  await expect(page.getByText("Lawrence Dinkers Club").first()).toBeVisible();

  // The meet-up (a public Outing hostType=GROUP) appears in the city game finder.
  await page.goto("/play/us/kansas/lawrence");
  await expect(page.getByText("Dinkers Club Open Play").first()).toBeVisible();

  // Open policy → joining lands you active immediately.
  const join = await request.post("/api/groups/e2egroup/join", { headers: AUTH("gjoiner@dev.local") });
  expect(join.ok()).toBeTruthy();
  const member = await join.json();
  expect(member.status).toBe("active");
});

test("Stage 8 — a private group is members-only: noindex, no leak to non-members, out of public rails", async ({ page }) => {
  // A NON-member (signed-out) visitor must NOT see any group specifics — the shell is
  // cached + shared and the server can't identify the viewer, so the name/description/
  // meet-ups are delivered client-side via the authenticated API (which 404s here).
  await page.goto("/groups/e2egroupx");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByText(/this group is private/i)).toBeVisible();
  await expect(page.getByText("Secret Lawrence Ballers")).toHaveCount(0); // name never leaks

  // Never in the public city finder or the court rail either.
  await page.goto("/groups/in/us/kansas/lawrence");
  await expect(page.getByText("Secret Lawrence Ballers")).toHaveCount(0);
  await page.goto(COURT);
  await expect(page.getByText("Secret Lawrence Ballers")).toHaveCount(0);
});

test("Stage 8 — a private group reveals its details to a signed-in member", async ({ page }) => {
  // The owner (a member) DOES see the private group's name + details, delivered
  // client-side by the authenticated `useGroup` (the members-only gate).
  await page.goto("/login");
  await page.getByLabel("Email").fill("gowner@dev.local");
  await page.getByLabel("Password").fill("devpass123");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/account/);

  await page.goto("/groups/e2egroupx");
  await expect(page.getByRole("heading", { name: "Secret Lawrence Ballers" })).toBeVisible({ timeout: 10_000 });
});
