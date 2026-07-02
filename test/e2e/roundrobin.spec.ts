import { test, expect } from "@playwright/test";

/**
 * Stage 5 gate (§14.3): J4 — Round robin: create → run → standings (the free
 * wedge). The NO-LOGIN path must never block, so this test never authenticates.
 *
 * Flow: build a round robin in the browser (live engine preview) → Generate →
 * land on the run console with the creator token in localStorage → score a match
 * through the console UI (keyboard-accessible number inputs) → complete the rest
 * via the real token-gated score API (the same code path the Save button calls,
 * which re-materializes standings) → the public board shows standings + a
 * champion. Engine correctness (static = f(seed); dynamic = f(seed+scores)) and
 * keystroke score entry are additionally covered by the vitest property + component
 * suites; this asserts the end-to-end journey.
 */

test("J4 — no-login: create a round robin → run console → standings + champion", async ({
  page,
  request,
}) => {
  // NO auth anywhere in this test — the wedge is zero-friction.
  await page.goto("/round-robin/new");

  // Default format is a doubles round robin; each entrant is a competitor.
  const addTeam = page.getByRole("textbox", { name: "Add a team" });
  await expect(addTeam).toBeVisible();
  for (const name of ["Alice", "Bravo", "Cobra", "Delta"]) {
    await addTeam.fill(name);
    await addTeam.press("Enter");
  }

  // The live preview (pure engine, in the browser) renders a schedule.
  await expect(page.getByText(/Round 1/i).first()).toBeVisible();

  await page.getByRole("button", { name: /generate round robin/i }).click();
  await page.waitForURL(/\/round-robin\/[^/]+\/live$/);

  const eventId = page.url().match(/round-robin\/([^/]+)\/live/)![1];
  const token = await page.evaluate((id) => localStorage.getItem(`rr-token-${id}`), eventId);
  expect(token).toBeTruthy();

  // Run console shows editable rows (the device holds the creator token).
  const firstSave = page.getByRole("button", { name: "Save", exact: true }).first();
  await expect(firstSave).toBeVisible({ timeout: 10_000 });

  // Score the first match through the console UI (accessible number inputs).
  const spins = page.getByRole("spinbutton");
  await spins.nth(0).fill("11");
  await spins.nth(1).fill("3");
  await firstSave.click();
  await expect(page.getByRole("button", { name: "Saved" }).first()).toBeVisible({ timeout: 10_000 });

  // Complete every match deterministically via the real (token-gated) score API —
  // the side with entrant "e0" (Alice) always wins ⇒ Alice is the unique champion.
  const full = await request.get(`/api/round-robin/${eventId}`).then((r) => r.json());
  for (const round of full.rounds) {
    for (const m of round.matches) {
      const aWins = m.sideA.includes("e0") ? true : m.sideB.includes("e0") ? false : true;
      const res = await request.post(`/api/round-robin/${eventId}/score`, {
        headers: { "X-RR-Token": token! },
        data: { matchId: m.id, scoreA: aWins ? 11 : 3, scoreB: aWins ? 3 : 11 },
      });
      expect(res.ok()).toBeTruthy();
    }
  }

  // Public board: standings materialized + Alice crowned champion.
  await page.goto(`/round-robin/${eventId}`);
  await expect(page.getByRole("table")).toBeVisible(); // native standings table
  await expect(page.getByText("Champion")).toBeVisible();
  await expect(page.getByText("Alice").first()).toBeVisible();
  // Crawlable SoftwareApplication structured data (§3.4).
  const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).join(" ");
  expect(ld).toContain('"SoftwareApplication"');
});

test("J4 — a bad creator token cannot score (no-login is token-gated)", async ({ request }) => {
  // Create anonymously via the API, then attempt to score with a wrong token.
  const created = await request
    .post("/api/round-robin", {
      data: {
        title: "Token Guard RR",
        config: {
          format: "roundRobin",
          mode: "singles",
          entrants: [
            { id: "e0", name: "A", seed: 1 },
            { id: "e1", name: "B", seed: 2 },
            { id: "e2", name: "C", seed: 3 },
            { id: "e3", name: "D", seed: 4 },
          ],
          courts: 2,
          scoring: { pointsToWin: 11, winBy: 2, cap: null },
          rngSeed: 7,
        },
      },
    })
    .then((r) => r.json());
  const full = await request.get(`/api/round-robin/${created.eventId}`).then((r) => r.json());
  const firstMatch = full.rounds[0].matches[0];
  const res = await request.post(`/api/round-robin/${created.eventId}/score`, {
    headers: { "X-RR-Token": "not-the-real-token" },
    data: { matchId: firstMatch.id, scoreA: 11, scoreB: 0 },
  });
  expect(res.status()).toBe(403);
});
