import { test, expect } from "@playwright/test";

/**
 * J8 — Auth-gated resume (§14.3, required). A gated action (save a court) opens
 * the Auth modal when signed out and RESUMES the original intent on success
 * (UI §2.11). Runs in dev-auth mode (forced via localStorage before load), so no
 * live Firebase is needed.
 */

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    try {
      localStorage.setItem("pl-auth-mode", "dev");
      localStorage.removeItem("pl-dev-auth");
      // Pre-decide consent so the consent banner (also role="dialog") isn't present.
      localStorage.setItem("pl-consent", JSON.stringify({ analytics: false, ads: false, decided: true }));
    } catch {
      /* ignore */
    }
  });
});

test("J8 — gated save opens the modal and resumes on sign-in", async ({ page }) => {
  await page.goto("/courts/us/kansas/lawrence");

  const save = page.getByTestId("save-court").first();
  await expect(save).toBeVisible();
  await expect(save).toHaveAttribute("aria-pressed", "false");

  // Gated action → the auth modal (scoped by its accessible name; the consent
  // banner is also a dialog but suppressed above).
  await save.click();
  const dialog = page.getByRole("dialog", { name: /welcome back|create your account|log in/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("tab", { name: "Sign up" })).toBeVisible();

  // Sign up (dev), which resolves the pending intent.
  await dialog.getByRole("tab", { name: "Sign up" }).click();
  await dialog.getByLabel("Name").fill("Test Player");
  await dialog.getByLabel("Email").fill("j8.player@dev.local");
  await dialog.getByLabel("Password").fill("hunter2pw");
  await dialog.getByRole("button", { name: "Create account" }).click();

  // Modal closes and the ORIGINAL intent resumes: the court is now saved.
  await expect(dialog).toBeHidden();
  await expect(save).toHaveAttribute("aria-pressed", "true");
});

test("standalone /login is noindex and shows the form", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByLabel("Email")).toBeVisible();
});
