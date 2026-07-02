// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { StandingsTable } from "@/components/roundrobin";
import type { Entrant, Standing } from "@/lib/roundrobin/types";

// react-aria's Table/overlays reach for these APIs jsdom doesn't ship.
beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = (q: string) => ({
      matches: false,
      media: q,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    });
  }
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

const entrants: Entrant[] = [
  { id: "e0", name: "Ana" },
  { id: "e1", name: "Bo" },
  { id: "e2", name: "Cy" },
];

function standing(entrantId: string, rank: number, wins: number, losses: number, diff: number): Standing {
  return {
    entrantId,
    rank,
    wins,
    losses,
    ties: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    pointDiff: diff,
    byes: 0,
    played: wins + losses,
  };
}

const standings: Standing[] = [
  standing("e1", 1, 3, 0, 12),
  standing("e0", 2, 1, 2, -3),
  standing("e2", 3, 0, 2, -9),
];

describe("<StandingsTable>", () => {
  it("renders every entrant with its rank and record", () => {
    render(<StandingsTable standings={standings} entrants={entrants} championId="e1" />);
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("Bo")).toBeInTheDocument();
    expect(screen.getByText("Cy")).toBeInTheDocument();
    // Signed point diff is shown for the leader.
    expect(screen.getByText("+12")).toBeInTheDocument();
    // The leader carries an explicit label (not color alone).
    expect(screen.getByLabelText("Leader")).toBeInTheDocument();
  });

  it("shows an empty state before any scores", () => {
    render(<StandingsTable standings={[]} entrants={entrants} />);
    expect(screen.getByText(/Standings will appear/i)).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <StandingsTable standings={standings} entrants={entrants} championId="e1" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
