// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { SchedulePreview, estimatePreviewStats } from "@/components/roundrobin";
import type { RrConfig, Schedule, ValidationResult, Entrant, Match } from "@/lib/roundrobin/types";

const entrants: Entrant[] = [
  { id: "e0", name: "Ana" },
  { id: "e1", name: "Bo" },
  { id: "e2", name: "Cy" },
  { id: "e3", name: "Di" },
];

function match(round: number, index: number, court: number, a: string, b: string): Match {
  return { id: `r${round}m${index}`, round, index, court, sideA: [a], sideB: [b] };
}

function config(over: Partial<RrConfig> = {}): RrConfig {
  return {
    format: "roundRobin",
    mode: "singles",
    entrants,
    courts: 2,
    scoring: { pointsToWin: 11, winBy: 2 },
    rngSeed: 1,
    ...over,
  };
}

const staticSchedule: Schedule = {
  dynamic: false,
  rounds: [
    { round: 1, byes: [], matches: [match(1, 0, 1, "e0", "e1"), match(1, 1, 2, "e2", "e3")] },
    { round: 2, byes: [], matches: [match(2, 0, 1, "e0", "e2"), match(2, 1, 2, "e1", "e3")] },
    { round: 3, byes: [], matches: [match(3, 0, 1, "e0", "e3"), match(3, 1, 2, "e1", "e2")] },
  ],
};

const okValidation: ValidationResult = { ok: true, errors: [], warnings: [] };

describe("estimatePreviewStats", () => {
  it("counts rounds, matches, games-each, byes for a full static schedule", () => {
    const stats = estimatePreviewStats(config(), staticSchedule);
    expect(stats).not.toBeNull();
    expect(stats!.rounds).toBe(3);
    expect(stats!.matches).toBe(6);
    expect(stats!.gamesEach).toBe(3);
    expect(stats!.sitPerRound).toBe(0);
    expect(stats!.estMinutes).toBe(36); // 3 rounds × ~12 min
  });

  it("scales matches/games-each by the target rounds for a dynamic schedule", () => {
    const dynamic: Schedule = { dynamic: true, rounds: [staticSchedule.rounds[0]] };
    const stats = estimatePreviewStats(config({ rounds: 6 }), dynamic);
    expect(stats!.rounds).toBe(6);
    expect(stats!.matches).toBe(12); // 2 known × scale 6
    expect(stats!.gamesEach).toBe(6);
  });

  it("uses the time cap for the estimate when provided", () => {
    const stats = estimatePreviewStats(config(), staticSchedule, 15);
    expect(stats!.estMinutes).toBe(45); // 3 × 15
  });

  it("returns null for an empty schedule", () => {
    expect(estimatePreviewStats(config(), null)).toBeNull();
  });
});

describe("<SchedulePreview>", () => {
  it("renders the summary tiles and Round 1 matchups", () => {
    render(<SchedulePreview config={config()} schedule={staticSchedule} validation={okValidation} />);
    expect(screen.getByText("Rounds")).toBeInTheDocument();
    expect(screen.getByText("Matches")).toBeInTheDocument();
    expect(screen.getByText(/Round 1/)).toBeInTheDocument();
    // Round 1 matchup names are drawn from the config's entrants.
    expect(screen.getAllByText("Ana").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bo").length).toBeGreaterThan(0);
  });

  it("shows validation errors instead of a schedule when invalid", () => {
    const bad: ValidationResult = { ok: false, errors: ["Add at least 4 players."], warnings: [] };
    render(<SchedulePreview config={config()} schedule={null} validation={bad} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Add at least 4 players.");
    expect(screen.queryByText("Rounds")).not.toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <SchedulePreview config={config()} schedule={staticSchedule} validation={okValidation} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
