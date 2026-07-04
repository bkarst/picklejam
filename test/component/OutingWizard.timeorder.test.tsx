// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders as render } from "@/test/util/render";

/**
 * L19 — the "When" step built startTs/endTs from two independent time selects with no ordering
 * check, so a game whose end is at/before its start could be submitted. The fix gates the step
 * (and shows an inline error) when the end time is not strictly after the start time.
 *
 * `?court=` prefills the court so we can advance off the "Where" step without a court search.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams("court=court-1"),
  usePathname: () => "/outings/new",
}));

const { OutingWizard } = await import("@/components/outings/OutingWizard");

describe("<OutingWizard> end-before-start guard (L19)", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("pl-auth-mode", "dev");
  });

  it("blocks advancing past 'When' when the end time is not after the start time", async () => {
    const user = userEvent.setup();
    render(<OutingWizard />);

    // Step 0 (Where): the court is prefilled via ?court= → Next is enabled.
    await user.click(screen.getByRole("button", { name: "Next" }));

    // Step 1 (When): defaults are 9:00–11:00 AM → valid, no error, Next enabled.
    expect(screen.getByRole("heading", { name: "When are you playing?" })).toBeInTheDocument();
    expect(screen.queryByText(/end time needs to be after/i)).toBeNull();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();

    // Set End time to 8:00 AM — before the 9:00 AM start.
    await user.click(screen.getByRole("button", { name: /End time/ }));
    await user.click(await screen.findByRole("option", { name: "8:00 AM" }));

    // The inline error appears and Next is now disabled (pre-fix: allowed → negative-duration game).
    expect(screen.getByText(/end time needs to be after the start time/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });
});
