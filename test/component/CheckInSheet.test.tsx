// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { axe } from "jest-axe";
import { renderWithProviders as render } from "@/test/util/render";
import { CheckInSheet } from "@/components/community/CheckInSheet";

/**
 * CheckInSheet — the court check-in action (§6.2). Rendered signed-out (dev
 * AuthProvider, no session), so opening the sheet must offer the ANONYMOUS
 * "check in without an account" path plus the create-a-profile upsell.
 */
describe("<CheckInSheet>", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("pl-auth-mode", "dev");
  });

  it("renders a Check In trigger", () => {
    render(<CheckInSheet courtId="c1" courtName="Test Court" />);
    expect(screen.getByRole("button", { name: "Check In" })).toBeInTheDocument();
  });

  it("offers the anonymous check-in path when signed out", () => {
    render(<CheckInSheet courtId="c1" courtName="Test Court" />);
    fireEvent.click(screen.getByRole("button", { name: "Check In" }));
    expect(
      screen.getByRole("button", { name: "Check in without an account" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(<CheckInSheet courtId="c1" courtName="Test Court" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
