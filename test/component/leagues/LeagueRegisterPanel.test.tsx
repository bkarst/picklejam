// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { renderWithProviders as render } from "@/test/util/render";
import { LeagueRegisterPanel } from "@/components/leagues/LeagueRegisterPanel";
import type { FeeConfig } from "@/lib/money";
import { makeLeagueDivision, usd } from "./_fixtures";

/**
 * <LeagueRegisterPanel> — the register confirm surface (design 12.3.3, §10).
 * Rendered with providers (uses useAuth + useRegisterLeague). Covers the flight
 * choice, the partner / free-agent choice, the DUPR gate, and the fee total. We
 * don't click Continue (that redirects the browser to Stripe).
 */
const feeConfig: FeeConfig = { mode: "passThrough", percentBps: 500, fixed: 30 };

const flight = makeLeagueDivision({ did: "d1", name: "A Division", price: usd(8000), duprMin: 3.0, duprMax: 3.5 });

describe("<LeagueRegisterPanel>", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("pl-auth-mode", "dev");
  });

  it("shows the flight, partner/free-agent choice and DUPR gate", () => {
    render(
      <LeagueRegisterPanel
        lid="l1"
        title="Wednesday Night 3.5"
        startDate="2026-07-08"
        seasonWeeks={8}
        playMode="doubles"
        divisions={[flight]}
        feeConfig={feeConfig}
        initialDid="d1"
      />,
    );
    expect(screen.getByText("Register with a partner")).toBeInTheDocument();
    expect(screen.getByText("Join the free-agent pool")).toBeInTheDocument();
    expect(screen.getAllByText(/DUPR 3.0–3.5/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Continue to payment" })).toBeInTheDocument();
  });

  it("computes the pass-through total via formatMoney", () => {
    render(
      <LeagueRegisterPanel
        lid="l1"
        title="Wednesday Night 3.5"
        startDate="2026-07-08"
        seasonWeeks={8}
        playMode="doubles"
        divisions={[flight]}
        feeConfig={feeConfig}
        initialDid="d1"
      />,
    );
    // $80.00 face + 5% + $0.30 = $84.30.
    expect(screen.getByText("$84.30")).toBeInTheDocument();
  });

  it("hides the partner choice for a singles flight", () => {
    render(
      <LeagueRegisterPanel
        lid="l1"
        title="Singles League"
        startDate="2026-07-08"
        seasonWeeks={8}
        playMode="singles"
        divisions={[makeLeagueDivision({ did: "d1", playMode: "singles" })]}
        feeConfig={feeConfig}
        initialDid="d1"
      />,
    );
    expect(screen.queryByText("Join the free-agent pool")).not.toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <LeagueRegisterPanel
        lid="l1"
        title="Wednesday Night 3.5"
        startDate="2026-07-08"
        seasonWeeks={8}
        playMode="doubles"
        divisions={[flight]}
        feeConfig={feeConfig}
        initialDid="d1"
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
