import { test, expect, type Page, type Browser } from "@playwright/test";

/**
 * Stage 7 gate (§14.3): J7 — league participant score + two-party confirm →
 * standings, and the ladder challenge → both-confirm → auto re-rank. Registrations
 * are pre-seeded as paid (FakeGateway); every MUTATION here is a REAL button click
 * in the browser. Two-party flows use one isolated browser CONTEXT per player (no
 * fragile re-login on a shared page). Pinned to one project (shared seeded rows);
 * board/standings state is READ via the API only to locate rows + assert outcomes.
 */

function devUid(email: string): string {
  return "dev_" + email.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

/** A fresh browser context signed in as `email` (dev auth + consent pre-decided). */
async function signedInPage(browser: Browser, baseURL: string | undefined, email: string): Promise<Page> {
  const ctx = await browser.newContext({ baseURL });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("pl-auth-mode", "dev");
      localStorage.setItem("pl-consent", JSON.stringify({ analytics: false, ads: false, decided: true }));
    } catch {
      /* ignore */
    }
  });
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("devpass123");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/account/);
  return page;
}

test("J7 — league: report score + opponent confirm through the participant console → standings", async ({
  browser,
  baseURL,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "two-party UI flow runs once (shared seeded state)");

  // Player 1 reports the week's score through the console.
  const p1 = await signedInPage(browser, baseURL, "lp1@dev.local");
  await p1.goto("/leagues/e2eleague/my-team");
  const scores = p1.getByPlaceholder("0");
  await expect(scores.nth(1)).toBeVisible({ timeout: 15_000 });
  await scores.nth(0).fill("11");
  await scores.nth(1).fill("5");
  await p1.getByRole("button", { name: /submit score/i }).click();
  await expect(p1.getByText(/waiting for your opponent/i)).toBeVisible({ timeout: 10_000 });

  // Player 2 (the opponent) confirms through the console.
  const p2 = await signedInPage(browser, baseURL, "lp2@dev.local");
  await p2.goto("/leagues/e2eleague/my-team");
  await p2.getByRole("button", { name: /confirm score/i }).click();
  await expect(p2.getByText(/confirmed|final/i).first()).toBeVisible({ timeout: 10_000 });

  // Standings materialized (poll — the confirm's server-side re-materialization
  // completes just after the optimistic "confirmed" UI): exactly one win + one loss.
  await expect
    .poll(
      async () => {
        const after = await request.get("/api/leagues/e2eleague").then((r) => r.json());
        const st = after.standings as Array<{ wins: number; losses: number }>;
        return st.some((s) => s.wins === 1) && st.some((s) => s.losses === 1);
      },
      { timeout: 10_000 },
    )
    .toBeTruthy();

  await p1.context().close();
  await p2.context().close();
});

test("J7 — ladder: challenge → accept → report → confirm through the console → auto re-rank", async ({
  browser,
  baseURL,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "full challenge lifecycle UI runs once (shared seeded state)");

  // Read the board to pick the bottom player (challenger) + the rung directly above.
  const before = await request.get("/api/ladders/e2eladder").then((r) => r.json());
  const rungs = (before.rungs as Array<{ position: number; uid: string }>).slice().sort((a, b) => a.position - b.position);
  expect(rungs.length).toBeGreaterThanOrEqual(2);
  const challenged = rungs[rungs.length - 2];
  const challenger = rungs[rungs.length - 1];
  const email: Record<string, string> = {
    [devUid("rp1@dev.local")]: "rp1@dev.local",
    [devUid("rp2@dev.local")]: "rp2@dev.local",
    [devUid("rp3@dev.local")]: "rp3@dev.local",
  };

  const pCh = await signedInPage(browser, baseURL, email[challenger.uid]);
  const pCd = await signedInPage(browser, baseURL, email[challenged.uid]);
  const challenges = "/ladders/e2eladder/challenges";

  // 1) Challenger issues (challengeRange=1 ⇒ exactly one eligible opponent, so the
  //    "Challenge" button is unambiguous; on success it flips to disabled "Challenged").
  await pCh.goto(challenges);
  await pCh.getByRole("button", { name: /^Challenge$/ }).first().click();
  await expect(pCh.getByRole("button", { name: /^Challenged$/ })).toBeVisible({ timeout: 10_000 });

  // 2) Challenged accepts.
  await pCd.goto(challenges);
  await pCd.getByRole("button", { name: /^Accept$/ }).click();
  await expect(pCd.getByText(/play & report|accepted/i).first()).toBeVisible({ timeout: 10_000 });

  // 3) Challenger reports the result (challenger wins).
  await pCh.goto(challenges);
  const s = pCh.getByPlaceholder("0");
  await expect(s.nth(1)).toBeVisible({ timeout: 10_000 });
  await s.nth(0).fill("11");
  await s.nth(1).fill("6");
  await pCh.getByRole("button", { name: /report result/i }).click();
  await expect(pCh.getByText(/waiting for your opponent/i).first()).toBeVisible({ timeout: 10_000 });

  // 4) Challenged confirms → re-rank applied.
  await pCd.goto(challenges);
  await pCd.getByRole("button", { name: /confirm result/i }).click();
  await expect(pCd.getByText(/confirmed/i).first()).toBeVisible({ timeout: 10_000 });

  // Auto re-rank (poll — the confirm's server-side re-rank completes just after the
  // optimistic "confirmed" UI): the challenger has moved up into the challenged's rung.
  await expect
    .poll(
      async () => {
        const after = await request.get("/api/ladders/e2eladder").then((r) => r.json());
        return (after.rungs as Array<{ position: number; uid: string }>).find((x) => x.uid === challenger.uid)?.position;
      },
      { timeout: 10_000 },
    )
    .toBe(challenged.position);

  await pCh.context().close();
  await pCd.context().close();
});
