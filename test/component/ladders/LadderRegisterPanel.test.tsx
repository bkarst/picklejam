// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { renderWithProviders as render } from "@/test/util/render";
import { LadderRegisterPanel } from "@/components/ladders/LadderRegisterPanel";
import type { FeeConfig } from "@/lib/money";
import { usd } from "./_fixtures";

/**
 * <LadderRegisterPanel> — join a ladder + checkout hand-off (§7.4 / §10). Rendered
 * with providers (uses useAuth + useRegisterLadder). Covers the optional self-rating
 * input, the fee total, and the Continue CTA. We don't click Continue (Stripe).
 */
const feeConfig: FeeConfig = { mode: "passThrough", percentBps: 500, fixed: 30 };

describe("<LadderRegisterPanel>", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("pl-auth-mode", "dev");
  });

  it("shows the self-rating input, membership total, and Continue CTA", () => {
    render(
      <LadderRegisterPanel
        lid="lad1"
        title="Monday Night Ladder"
        startDate="2026-07-06"
        playMode="singles"
        price={usd(1500)}
        feeConfig={feeConfig}
        challengeRange={3}
        responseWindowDays={3}
      />,
    );
    expect(screen.getByLabelText(/your rating/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue to payment" })).toBeInTheDocument();
    // $15.00 face + 5% ($0.75) + $0.30 = $16.05.
    expect(screen.getByText("$16.05")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <LadderRegisterPanel
        lid="lad1"
        title="Monday Night Ladder"
        startDate="2026-07-06"
        playMode="singles"
        price={usd(1500)}
        feeConfig={feeConfig}
        challengeRange={3}
        responseWindowDays={3}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
