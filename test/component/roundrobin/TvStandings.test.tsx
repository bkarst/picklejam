// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { TvStandings } from "@/components/roundrobin";
import type { Entrant, Standing } from "@/lib/roundrobin/types";

const entrants: Entrant[] = [
  { id: "e0", name: "Ana" },
  { id: "e1", name: "Bo" },
];

const standings: Standing[] = [
  { entrantId: "e1", rank: 1, wins: 4, losses: 0, ties: 0, pointsFor: 44, pointsAgainst: 20, pointDiff: 24, byes: 0, played: 4 },
  { entrantId: "e0", rank: 2, wins: 1, losses: 3, ties: 0, pointsFor: 30, pointsAgainst: 40, pointDiff: -10, byes: 0, played: 4 },
];

describe("<TvStandings>", () => {
  it("renders a big, glanceable board with the title and ranked players", () => {
    render(<TvStandings title="Saturday RR" standings={standings} entrants={entrants} championId="e1" />);
    expect(screen.getByRole("heading", { name: "Saturday RR" })).toBeInTheDocument();
    expect(screen.getByText("Bo")).toBeInTheDocument();
    expect(screen.getByLabelText("Rank 1")).toBeInTheDocument();
    expect(screen.getByText("Champion")).toBeInTheDocument();
  });

  it("does not use any looping animation classes (reduced-motion safe)", () => {
    const { container } = render(
      <TvStandings title="Board" standings={standings} entrants={entrants} />,
    );
    // Static board: no animate-* utilities that would loop on a venue screen.
    expect(container.querySelectorAll('[class*="animate-"]').length).toBe(0);
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <TvStandings title="Board" standings={standings} entrants={entrants} championId="e1" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
