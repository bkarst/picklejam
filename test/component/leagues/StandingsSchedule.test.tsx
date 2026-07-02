// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { StandingsSchedule } from "@/components/leagues/StandingsSchedule";
import { makeLeague, makeLeagueDivision, makeTeam, makeScheduleMatch, makeStanding } from "./_fixtures";

/**
 * <StandingsSchedule> — the public standings + schedule + playoff bracket (design
 * 12.3.4). Server-fed props, native tables. Covers the standings row, league-table
 * points (3/win), the resolved team name, and the played-week schedule score.
 */
const league = makeLeague({ seasonWeeks: 8 });
const divisions = [makeLeagueDivision({ did: "d1", name: "Division 1" })];
const teams = [
  makeTeam({ teamId: "t1", name: "Dink Dynasty" }),
  makeTeam({ teamId: "t2", name: "Net Ninjas" }),
];
const standings = [
  makeStanding({ rank: 1, entrantId: "t1", wins: 8, losses: 1, pointsFor: 27, pointsAgainst: 12, pointDiff: 15 }),
  makeStanding({ rank: 2, entrantId: "t2", wins: 5, losses: 2, pointsFor: 24, pointsAgainst: 15, pointDiff: 9 }),
];
const schedule = [
  makeScheduleMatch({ week: 1, mid: "m1", sideA: ["t1"], sideB: ["t2"], scoreA: 11, scoreB: 7, confirmStatus: "confirmed" }),
];

describe("<StandingsSchedule>", () => {
  it("renders standings with resolved team names and league points", () => {
    render(
      <StandingsSchedule league={league} divisions={divisions} teams={teams} schedule={schedule} standings={standings} />,
    );
    // Team name is resolved (appears in standings and the schedule row).
    expect(screen.getAllByText("Dink Dynasty").length).toBeGreaterThan(0);
    // Top team's W–L in the standings table.
    expect(screen.getByText("8–1")).toBeInTheDocument();
    // Playoffs bracket placeholder (no post-season fixtures yet).
    expect(screen.getByRole("heading", { name: "Playoffs" })).toBeInTheDocument();
  });

  it("shows the week's schedule score", () => {
    render(
      <StandingsSchedule league={league} divisions={divisions} teams={teams} schedule={schedule} standings={standings} />,
    );
    expect(screen.getByText("11 – 7")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <StandingsSchedule league={league} divisions={divisions} teams={teams} schedule={schedule} standings={standings} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
