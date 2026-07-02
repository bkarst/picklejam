// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { DivisionsTable } from "@/components/tournaments/DivisionsTable";
import { makeDivision, usd } from "./_fixtures";

/**
 * <DivisionsTable> — the read-only divisions grid (design 12.2.2). A native
 * <table>, so it renders without providers. Covers price formatting, spots-left /
 * Full states, the DUPR gate badge, and the register vs closed CTA.
 */
describe("<DivisionsTable>", () => {
  it("formats prices via formatMoney", () => {
    render(
      <DivisionsTable
        tid="t1"
        divisions={[makeDivision({ did: "d1", price: usd(3000), capacity: 16, registeredCount: 12 })]}
      />,
    );
    expect(screen.getByText("$30.00")).toBeInTheDocument();
  });

  it("shows spots left and a Full state", () => {
    render(
      <DivisionsTable
        tid="t1"
        divisions={[
          makeDivision({ did: "d1", name: "Open", capacity: 16, registeredCount: 12 }),
          makeDivision({ did: "d2", name: "Womens", capacity: 16, registeredCount: 16 }),
        ]}
      />,
    );
    expect(screen.getByText("4 / 16")).toBeInTheDocument();
    // The full division shows "Full" (text, not color alone) in place of Register.
    expect(screen.getAllByText("Full").length).toBeGreaterThan(0);
  });

  it("badges the DUPR gate and renders its range", () => {
    render(
      <DivisionsTable
        tid="t1"
        divisions={[makeDivision({ did: "d1", duprMin: 3.5, duprMax: 5.0 })]}
      />,
    );
    expect(screen.getByText("DUPR")).toBeInTheDocument();
    expect(screen.getByText("3.5–5.0")).toBeInTheDocument();
  });

  it("links Register when open and shows Closed when not registerable", () => {
    const { rerender } = render(
      <DivisionsTable tid="t1" divisions={[makeDivision({ did: "d1", capacity: 16, registeredCount: 1 })]} />,
    );
    const link = screen.getByRole("link", { name: "Register" });
    expect(link).toHaveAttribute("href", "/tournaments/t1/register?division=d1");

    rerender(
      <DivisionsTable
        tid="t1"
        registerable={false}
        divisions={[makeDivision({ did: "d1", capacity: 16, registeredCount: 1 })]}
      />,
    );
    expect(screen.queryByRole("link", { name: "Register" })).not.toBeInTheDocument();
    expect(screen.getByText("Closed")).toBeInTheDocument();
  });

  it("uses a native table with a row header per division", () => {
    render(<DivisionsTable tid="t1" divisions={[makeDivision({ did: "d1", name: "Men's Doubles 3.5" })]} />);
    const table = screen.getByRole("table");
    expect(within(table).getByRole("rowheader", { name: "Men's Doubles 3.5" })).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <DivisionsTable
        tid="t1"
        divisions={[
          makeDivision({ did: "d1", capacity: 16, registeredCount: 4 }),
          makeDivision({ did: "d2", name: "Mixed", gender: "mixed", duprMin: 3.0, duprMax: 3.5 }),
        ]}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
