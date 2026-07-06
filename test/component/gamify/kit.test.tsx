// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { renderWithProviders as render } from "@/test/util/render";
import { RpDelta } from "@/components/gamify/RpDelta";
import { LevelChip } from "@/components/gamify/LevelChip";
import { LevelRing } from "@/components/gamify/LevelRing";
import { StreakChip } from "@/components/gamify/StreakChip";
import { QuestRow } from "@/components/gamify/QuestRow";
import { BadgeTile } from "@/components/gamify/BadgeTile";

afterEach(cleanup);

describe("RpDelta — sign via icon AND color, never color alone", () => {
  it("shows a + and ▲ for a gain", () => {
    render(<RpDelta points={25} />);
    expect(screen.getByText(/\+25 RP/)).toBeInTheDocument();
    expect(screen.getByText("▲")).toBeInTheDocument();
  });
  it("shows a − and ▼ for a loss", () => {
    render(<RpDelta points={-15} />);
    expect(screen.getByText(/−15 RP/)).toBeInTheDocument();
    expect(screen.getByText("▼")).toBeInTheDocument();
  });
});

describe("LevelChip", () => {
  it("renders the full label at md and number-only at sm", () => {
    const { rerender } = render(<LevelChip level={5} name="Spin Doctor" />);
    expect(screen.getByText("Lv 5")).toBeInTheDocument();
    expect(screen.getByText(/Spin Doctor/)).toBeInTheDocument();
    rerender(<LevelChip level={5} name="Spin Doctor" size="sm" />);
    expect(screen.queryByText(/Spin Doctor/)).toBeNull();
  });
});

describe("LevelRing", () => {
  it("exposes progress as an accessible label", () => {
    render(<LevelRing level={5} progress={0.25} />);
    expect(screen.getByRole("img", { name: /Level 5, 25% to the next level/ })).toBeInTheDocument();
  });
  it("reads as max at the top level", () => {
    render(<LevelRing level={10} progress={1} isMax />);
    expect(screen.getByRole("img", { name: /max level reached/ })).toBeInTheDocument();
  });
});

describe("QuestRow", () => {
  it("renders a progressbar with the right bounds and the reward", () => {
    render(<QuestRow title="Check in 3 times this week" count={2} target={3} rewardRp={30} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "2");
    expect(bar).toHaveAttribute("aria-valuemax", "3");
    expect(screen.getByText(/\+30 RP/)).toBeInTheDocument();
    expect(screen.getByText("2/3")).toBeInTheDocument();
  });
  it("marks a completed quest", () => {
    render(<QuestRow title="Done quest" count={3} target={3} rewardRp={30} />);
    expect(screen.getByLabelText("completed")).toBeInTheDocument();
  });
});

describe("BadgeTile", () => {
  it("earned shows the tier name", () => {
    render(<BadgeTile name="Scout" tier={1} tierName="Bronze" earned />);
    expect(screen.getByText("Scout")).toBeInTheDocument();
    expect(screen.getByText("Bronze")).toBeInTheDocument();
  });
  it("locked shows endowed-progress toward the next tier", () => {
    render(<BadgeTile name="Explorer" progress={{ count: 7, target: 10, unit: "courts" }} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "7");
    expect(screen.getByText(/7\/10 courts/)).toBeInTheDocument();
  });
  it("hidden badge never exposes criteria", () => {
    render(<BadgeTile name="Night Owl" hidden />);
    expect(screen.queryByText("Night Owl")).toBeNull();
    expect(screen.getByText("Hidden")).toBeInTheDocument();
  });
});

describe("axe — every kit component is clean in all states", () => {
  it("has no serious violations", async () => {
    const { container } = render(
      <div>
        <RpDelta points={25} />
        <RpDelta points={-15} />
        <LevelChip level={5} name="Spin Doctor" />
        <LevelRing level={5} progress={0.25} />
        <StreakChip weeks={7} best={9} rainChecks={1} />
        <QuestRow title="Check in 3 times this week" count={2} target={3} rewardRp={30} />
        <BadgeTile name="Scout" tier={2} tierName="Silver" earned />
        <BadgeTile name="Explorer" progress={{ count: 7, target: 10, unit: "courts" }} />
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
