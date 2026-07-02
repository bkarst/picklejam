// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { renderWithProviders as render } from "@/test/util/render";
import { RegisterPanel } from "@/components/tournaments/RegisterPanel";
import type { FeeConfig } from "@/lib/money";
import { makeDivision, usd } from "./_fixtures";

/**
 * <RegisterPanel> — the checkout confirm surface (design 12.2.3, §10). Rendered
 * with providers (uses useAuth + useRegister). Covers the confirm state, the
 * doubles partner field, the DUPR-gate messaging, and the fee summary total. We
 * don't click "Continue" (that redirects the browser to Stripe).
 */
const feeConfig: FeeConfig = { mode: "passThrough", percentBps: 500, fixed: 30 };

const doublesDupr = makeDivision({
  did: "d1",
  name: "Men's Doubles 3.5",
  playMode: "doubles",
  gender: "mens",
  duprMin: 3.0,
  duprMax: 3.5,
  price: usd(3000),
});
const singles = makeDivision({
  did: "d2",
  name: "Men's Singles",
  playMode: "singles",
  gender: "mens",
  price: usd(2500),
});

describe("<RegisterPanel>", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("pl-auth-mode", "dev");
  });

  it("confirms the division and offers a secure Continue to payment", () => {
    render(
      <RegisterPanel tid="t1" title="Summer Slam" startDate="2026-07-18" divisions={[doublesDupr]} feeConfig={feeConfig} initialDid="d1" />,
    );
    expect(screen.getByRole("heading", { name: "Confirm your entry" })).toBeInTheDocument();
    expect(screen.getByText("Men's Doubles 3.5")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue to payment" })).toBeInTheDocument();
    expect(screen.getByText(/Secure checkout powered by Stripe/i)).toBeInTheDocument();
    // Pass-through total: $30.00 + $1.80 = $31.80.
    expect(screen.getByText("$31.80")).toBeInTheDocument();
  });

  it("shows a partner field for doubles and DUPR gate messaging", () => {
    render(
      <RegisterPanel tid="t1" title="Summer Slam" startDate="2026-07-18" divisions={[doublesDupr]} feeConfig={feeConfig} initialDid="d1" />,
    );
    expect(screen.getByLabelText(/partner/i)).toBeInTheDocument();
    expect(screen.getByText("DUPR 3.0–3.5")).toBeInTheDocument();
  });

  it("omits the partner field for a singles division", () => {
    render(
      <RegisterPanel tid="t1" title="Summer Slam" startDate="2026-07-18" divisions={[singles]} feeConfig={feeConfig} initialDid="d2" />,
    );
    expect(screen.queryByLabelText(/partner/i)).not.toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <RegisterPanel tid="t1" title="Summer Slam" startDate="2026-07-18" divisions={[doublesDupr]} feeConfig={feeConfig} initialDid="d1" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
