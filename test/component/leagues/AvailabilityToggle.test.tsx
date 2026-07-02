// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { renderWithProviders as render } from "@/test/util/render";
import { AvailabilityToggle } from "@/components/leagues/AvailabilityToggle";

/**
 * <AvailabilityToggle> — the optimistic weekly in/out/sub control (§7.3 sub-pool).
 * Uses TanStack, so it renders with providers. Covers the three labelled options.
 */
describe("<AvailabilityToggle>", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("pl-auth-mode", "dev");
  });

  it("renders the three availability options", () => {
    render(<AvailabilityToggle lid="l1" week={1} status="in" />);
    expect(screen.getByText("I'm in")).toBeInTheDocument();
    expect(screen.getByText("Out")).toBeInTheDocument();
    expect(screen.getByText("Need a sub")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(<AvailabilityToggle lid="l1" week={1} status="in" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
