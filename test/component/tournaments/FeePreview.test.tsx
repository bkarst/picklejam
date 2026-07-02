// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { FeePreview } from "@/components/tournaments/FeePreview";
import type { FeeConfig, Money } from "@/lib/money";

/**
 * <FeePreview> — the exact money split (§10). Verifies absorb vs pass-through
 * numbers for both the registrant and organizer audiences. Fee = 5% + $0.30 on a
 * $30.00 face → applicationFee $1.80.
 */
const face: Money = { amount: 3000, currency: "usd" };
const fee = (mode: FeeConfig["mode"]): FeeConfig => ({ mode, percentBps: 500, fixed: 30 });

describe("<FeePreview>", () => {
  it("registrant / pass-through: entry + service fee = total", () => {
    render(<FeePreview face={face} feeConfig={fee("passThrough")} audience="registrant" />);
    expect(screen.getByText("Entry fee")).toBeInTheDocument();
    expect(screen.getByText("$30.00")).toBeInTheDocument();
    expect(screen.getByText("$1.80")).toBeInTheDocument(); // service fee
    expect(screen.getByText("$31.80")).toBeInTheDocument(); // total
  });

  it("registrant / absorb: total equals the face price and fee is included", () => {
    render(<FeePreview face={face} feeConfig={fee("absorb")} audience="registrant" />);
    expect(screen.getByText("Included")).toBeInTheDocument();
    // Both the entry fee and the total are the face price in absorb mode.
    expect(screen.getAllByText("$30.00").length).toBe(2);
    expect(screen.queryByText("$31.80")).not.toBeInTheDocument();
  });

  it("organizer / absorb: nets face minus the platform fee", () => {
    render(<FeePreview face={face} feeConfig={fee("absorb")} audience="organizer" />);
    expect(screen.getByText("You receive")).toBeInTheDocument();
    expect(screen.getByText("$28.20")).toBeInTheDocument(); // 30.00 - 1.80
    expect(screen.getByText("− $1.80")).toBeInTheDocument();
  });

  it("organizer / pass-through: nets the full face price", () => {
    render(<FeePreview face={face} feeConfig={fee("passThrough")} audience="organizer" />);
    expect(screen.getByText("You receive")).toBeInTheDocument();
    // List price and net are both $30.00 (registrant paid the fee).
    expect(screen.getAllByText("$30.00").length).toBe(2);
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <FeePreview face={face} feeConfig={fee("passThrough")} audience="registrant" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
