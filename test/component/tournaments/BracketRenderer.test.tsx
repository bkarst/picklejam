// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import {
  BracketRenderer,
  bracketFromItems,
  defaultRoundLabels,
  type BracketMatch,
} from "@/components/brackets/BracketRenderer";
import { makeBracketMatch } from "./_fixtures";

describe("bracketFromItems / defaultRoundLabels", () => {
  it("derives the winner from scores and resolves names", () => {
    const names = new Map([["u1", "Alice"], ["u2", "Bob"]]);
    const [m] = bracketFromItems(
      [makeBracketMatch({ round: 1, index: 0, sideA: ["u1"], sideB: ["u2"], scoreA: 11, scoreB: 6 })],
      names,
    );
    expect(m.sideA?.name).toBe("Alice");
    expect(m.sideA?.isWinner).toBe(true);
    expect(m.sideB?.isWinner).toBe(false);
    expect(m.status).toBe("complete");
  });

  it("labels rounds backwards from the final", () => {
    const labels = defaultRoundLabels(3);
    expect(labels[3].title).toBe("Finals");
    expect(labels[2].title).toBe("Semifinals");
    expect(labels[1].title).toBe("Quarterfinals");
  });

  it("shows TBD for empty sides", () => {
    const [m] = bracketFromItems([makeBracketMatch({ round: 2, index: 0 })]);
    expect(m.sideA?.name).toBe("TBD");
  });
});

const twoRound: BracketMatch[] = [
  { round: 1, index: 0, sideA: { name: "Waters / Johns", score: 11, isWinner: true }, sideB: { name: "Garcia / Patel", score: 6 }, status: "complete" },
  { round: 1, index: 1, sideA: { name: "Smith / Brown", score: 11, isWinner: true }, sideB: { name: "Davis / Wilson", score: 9 }, status: "complete" },
  { round: 2, index: 0, sideA: { name: "Waters / Johns" }, sideB: { name: "Smith / Brown" }, status: "pending" },
];

describe("<BracketRenderer>", () => {
  it("renders round columns and both sides", () => {
    render(<BracketRenderer matches={twoRound} roundLabels={defaultRoundLabels(2)} />);
    expect(screen.getByText("Semifinals")).toBeInTheDocument();
    expect(screen.getByText("Finals")).toBeInTheDocument();
    expect(screen.getAllByText("Waters / Johns").length).toBeGreaterThanOrEqual(2);
  });

  it("marks winners without relying on color alone", () => {
    render(<BracketRenderer matches={twoRound} />);
    expect(screen.getAllByLabelText("Winner").length).toBe(2);
  });

  it("renders a champion column when requested", () => {
    render(<BracketRenderer matches={twoRound} championLabel="TBD" />);
    expect(screen.getByRole("heading", { name: "Champion" })).toBeInTheDocument();
    expect(screen.getByText("TBD")).toBeInTheDocument();
  });

  it("shows an empty state with no matches", () => {
    render(<BracketRenderer matches={[]} />);
    expect(screen.getByText(/bracket will appear here/i)).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <BracketRenderer matches={twoRound} roundLabels={defaultRoundLabels(2)} championLabel="TBD" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
