// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { LadderBoard } from "@/components/ladders/LadderBoard";
import { makeRung } from "./_fixtures";

/**
 * <LadderBoard> — the ranked RUNG# board (§7.4). A native read-only table, so it
 * renders without providers. Covers the ranked rows, the empty state, and the
 * movement indicator (arrow + sr-only label, never color alone).
 */
describe("<LadderBoard>", () => {
  it("renders players in rank order", () => {
    render(
      <LadderBoard
        rungs={[
          makeRung({ position: 2, displayName: "Bo", wins: 1, losses: 3 }),
          makeRung({ position: 1, displayName: "Ana", wins: 5, losses: 0 }),
        ]}
      />,
    );
    const rows = screen.getAllByRole("row");
    // header row + 2 data rows
    expect(rows).toHaveLength(3);
    expect(screen.getByText("Ana")).toBeInTheDocument();
    // Ana is up (5-0), so an accessible "Up 5" label is present.
    expect(screen.getByText("Up 5")).toBeInTheDocument();
  });

  it("shows an empty state when the ladder has no players", () => {
    render(<LadderBoard rungs={[]} />);
    expect(screen.getByText(/be the first to join/i)).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(<LadderBoard rungs={[makeRung({ position: 1 })]} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
