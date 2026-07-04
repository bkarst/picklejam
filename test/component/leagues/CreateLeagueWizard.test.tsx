// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders as render } from "@/test/util/render";
import { CreateLeagueWizard } from "@/components/leagues/CreateLeagueWizard";

/**
 * <CreateLeagueWizard> — regression for H11: a non-numeric keystroke in the fee field
 * used to throw inside the `previewFace` useMemo (moneyFromMajor rejects unparseable /
 * negative input), which tripped the error boundary and dropped ALL wizard state.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/leagues/new",
}));

describe("<CreateLeagueWizard> fee field", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("pl-auth-mode", "dev");
  });

  it("does not crash on non-numeric fee input, and preserves entered state", () => {
    render(<CreateLeagueWizard />);
    // Advance from the format step (0) to the basics/fee step (1).
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    // Enter a title, then a would-be-crashing fee value.
    const title = screen.getByPlaceholderText("e.g. Wednesday Night 3.5 Doubles");
    fireEvent.change(title, { target: { value: "Wednesday Night 3.5" } });

    const fee = screen.getByPlaceholderText("80.00");
    for (const v of ["$", "$8", "$80", "80,50", "-"]) {
      fireEvent.change(fee, { target: { value: v } });
    }

    // Still rendered (no error boundary), and no state was lost.
    expect(screen.getByPlaceholderText("80.00")).toHaveValue("-");
    expect(screen.getByPlaceholderText("e.g. Wednesday Night 3.5 Doubles")).toHaveValue(
      "Wednesday Night 3.5",
    );
    // An invalid fee blocks advancing to review/publish.
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });
});
