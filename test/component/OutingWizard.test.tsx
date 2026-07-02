// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { renderWithProviders as render } from "@/test/util/render";
import { OutingWizard, buildRrule } from "@/components/outings/OutingWizard";

/**
 * <OutingWizard> — the create-a-game flow (§6.7). Rendered at step 1 ("Where"):
 * the stepper shows every step, and the recurrence helper builds the RRULE string
 * the wizard sends to `useCreateOuting`.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/outings/new",
}));

describe("buildRrule", () => {
  it("returns null for a one-off game", () => {
    expect(buildRrule("once")).toBeNull();
    expect(buildRrule("once", "2025-06-21")).toBeNull();
  });

  it("builds a weekly rule", () => {
    expect(buildRrule("weekly")).toBe("FREQ=WEEKLY;INTERVAL=1");
  });

  it("builds a biweekly rule", () => {
    expect(buildRrule("biweekly")).toBe("FREQ=WEEKLY;INTERVAL=2");
  });

  it("appends an UNTIL when an end date is set", () => {
    expect(buildRrule("weekly", "2025-06-21")).toBe("FREQ=WEEKLY;INTERVAL=1;UNTIL=20250621T235959Z");
    expect(buildRrule("biweekly", "2025-12-31")).toBe(
      "FREQ=WEEKLY;INTERVAL=2;UNTIL=20251231T235959Z",
    );
  });
});

describe("<OutingWizard>", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("pl-auth-mode", "dev");
  });

  it("renders the step progress with every step", () => {
    render(<OutingWizard />);
    for (const label of ["Where", "When", "Details", "Visibility & invites", "Review"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("starts on the Where step with a court search", () => {
    render(<OutingWizard />);
    expect(screen.getByRole("heading", { name: "Where are you playing?" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Search for a court" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(<OutingWizard />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
