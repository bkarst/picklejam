// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { LeagueCard } from "@/components/leagues/LeagueCard";
import { usd } from "./_fixtures";

/**
 * <LeagueCard> — the league/ladder finder row (design 12.3.1). A presentational
 * link card, so it renders without providers. Covers the status label (text, not
 * color alone), the ladder variant CTA, and the optional price via formatMoney.
 */
describe("<LeagueCard>", () => {
  it("renders a league card with status label and view CTA", () => {
    render(
      <LeagueCard
        href="/leagues/l1"
        title="Wednesday Night 3.5 Doubles"
        status="published"
        kind="league"
        dateLabel="Starts Jul 8"
        meta="8 weeks · Doubles"
        place="Lenexa CC · Lenexa, KS"
      />,
    );
    expect(screen.getByRole("heading", { name: "Wednesday Night 3.5 Doubles" })).toBeInTheDocument();
    expect(screen.getByText("Registering")).toBeInTheDocument();
    expect(screen.getByText("View league")).toBeInTheDocument();
    expect(screen.getByText("Lenexa CC · Lenexa, KS")).toBeInTheDocument();
  });

  it("renders a ladder card with a price via formatMoney and ladder CTA", () => {
    render(
      <LeagueCard
        href="/ladders/lad1"
        title="Monday Night Ladder"
        status="published"
        kind="ladder"
        dateLabel="Starts Jul 6 · Ongoing"
        priceFrom={usd(1500)}
      />,
    );
    expect(screen.getByText("View ladder")).toBeInTheDocument();
    expect(screen.getByText("$15.00")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <LeagueCard href="/leagues/l1" title="Spring League" status="published" kind="league" dateLabel="Starts Jul 8" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
