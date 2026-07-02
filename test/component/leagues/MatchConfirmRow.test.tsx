// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { renderWithProviders as render } from "@/test/util/render";
import { MatchConfirmRow } from "@/components/leagues/MatchConfirmRow";
import { makeScheduleMatch } from "./_fixtures";

/**
 * <MatchConfirmRow> — the §7.3 two-party score handshake. Uses TanStack + Auth, so
 * it renders with providers. Covers the report state (score entry) and the confirm
 * state (opponent reported → I confirm/dispute). We don't submit (that hits /api).
 */
describe("<MatchConfirmRow>", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("pl-auth-mode", "dev");
  });

  it("offers score entry when the fixture is scheduled", () => {
    render(
      <MatchConfirmRow lid="l1" match={makeScheduleMatch({ confirmStatus: "scheduled" })} mySide="A" nameA="Pickle Pros" nameB="Net Ninjas" />,
    );
    expect(screen.getByRole("button", { name: "Submit score" })).toBeInTheDocument();
    expect(screen.getByLabelText("Score for Pickle Pros")).toBeInTheDocument();
  });

  it("offers confirm/dispute when the opponent has reported", () => {
    render(
      <MatchConfirmRow
        lid="l1"
        match={makeScheduleMatch({ confirmStatus: "reported", reportedBy: "A", scoreA: 11, scoreB: 8 })}
        mySide="B"
        nameA="Pickle Pros"
        nameB="Net Ninjas"
      />,
    );
    expect(screen.getByRole("button", { name: "Confirm score" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dispute" })).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <MatchConfirmRow lid="l1" match={makeScheduleMatch({ confirmStatus: "scheduled" })} mySide="A" nameA="Pickle Pros" nameB="Net Ninjas" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
