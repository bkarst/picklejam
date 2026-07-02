// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { MatchScoreRow } from "@/components/roundrobin";
import type { Match } from "@/lib/roundrobin/types";

const names = new Map<string, string>([
  ["e0", "Ana"],
  ["e1", "Bo"],
]);

function match(over: Partial<Match> = {}): Match {
  return { id: "r1m0", round: 1, index: 0, court: 1, sideA: ["e0"], sideB: ["e1"], ...over };
}

describe("<MatchScoreRow>", () => {
  it("exposes keyboard-accessible number inputs for each side", () => {
    render(<MatchScoreRow match={match()} names={names} editable onSave={vi.fn()} />);
    // Native number inputs → role "spinbutton", tabbable & labelled.
    expect(screen.getByRole("spinbutton", { name: "Score for Ana" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Score for Bo" })).toBeInTheDocument();
  });

  it("increments with the stepper and saves the entered scores", async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<MatchScoreRow match={match()} names={names} editable onSave={onSave} />);

    await user.click(screen.getByRole("button", { name: "Increase Score for Ana" }));
    expect(screen.getByRole("spinbutton", { name: "Score for Ana" })).toHaveValue(1);

    const bo = screen.getByRole("spinbutton", { name: "Score for Bo" });
    await user.clear(bo);
    await user.type(bo, "9");

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith(1, 9);
  });

  it("flags a conflicting match", () => {
    render(<MatchScoreRow match={match({ status: "conflict" })} names={names} editable onSave={vi.fn()} />);
    expect(screen.getByText("Conflict")).toBeInTheDocument();
  });

  it("renders read-only when not editable", () => {
    render(<MatchScoreRow match={match({ scoreA: 11, scoreB: 7, status: "scored" })} names={names} />);
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: "Score for Ana" })).not.toBeInTheDocument();
    expect(screen.getByText("Final")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    // The row is a <li> by design (rendered inside a <ul> in the console).
    const { container } = render(
      <ul>
        <MatchScoreRow match={match()} names={names} editable onSave={vi.fn()} />
      </ul>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
