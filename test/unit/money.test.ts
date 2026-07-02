/**
 * money.test.ts — exact-money primitives (PRD §10, §14.5). Money is ALWAYS integer
 * minor units; these tests pin the fee split, zero-decimal currencies, half-up
 * rounding, currency-mismatch guards, and display formatting so a float can never
 * sneak into the money path.
 */

import { describe, it, expect } from "vitest";
import {
  money,
  moneyFromMajor,
  addMoney,
  subMoney,
  formatMoney,
  computeFees,
  minorUnitDigits,
  type FeeConfig,
} from "@/lib/money";

// A typical platform fee: 2.9% + $0.30 (Stripe-style), in basis points + minor units.
const FEE_29_30 = { percentBps: 290, fixed: 30 } as const;

describe("money() construction", () => {
  it("wraps integer minor units + lower-cases the currency", () => {
    expect(money(1250, "USD")).toEqual({ amount: 1250, currency: "usd" });
  });

  it("throws on a non-integer amount (money is never a float)", () => {
    expect(() => money(12.5)).toThrow();
  });

  it("moneyFromMajor rounds a major-unit string half-up to minor units", () => {
    expect(moneyFromMajor("12.50")).toEqual({ amount: 1250, currency: "usd" });
    expect(moneyFromMajor(0)).toEqual({ amount: 0, currency: "usd" });
    // Zero-decimal currency stays in the major unit.
    expect(moneyFromMajor(1000, "jpy")).toEqual({ amount: 1000, currency: "jpy" });
  });
});

describe("addMoney / subMoney", () => {
  it("adds and subtracts within a currency", () => {
    expect(addMoney(money(1000), money(59))).toEqual(money(1059));
    expect(subMoney(money(1000), money(59))).toEqual(money(941));
  });

  it("throws on a currency mismatch (never silently mixes currencies)", () => {
    expect(() => addMoney(money(100, "usd"), money(100, "eur"))).toThrow(/currency mismatch/);
    expect(() => subMoney(money(100, "usd"), money(100, "gbp"))).toThrow(/currency mismatch/);
  });
});

describe("computeFees — absorb vs passThrough (exact minor units)", () => {
  const face = money(1000, "usd"); // $10.00

  it("absorb: registrant pays face, organizer eats the fee", () => {
    const cfg: FeeConfig = { mode: "absorb", ...FEE_29_30 };
    const b = computeFees(face, cfg);
    // fee = round(1000 * 290 / 10000) + 30 = 29 + 30 = 59
    expect(b.applicationFee).toEqual(money(59, "usd"));
    expect(b.total).toEqual(money(1000, "usd")); // registrant pays face exactly
    expect(b.organizerNet).toEqual(money(941, "usd")); // face - fee
    expect(b.face).toEqual(face);
    // Conservation: total === organizerNet + applicationFee.
    expect(b.total.amount).toBe(b.organizerNet.amount + b.applicationFee.amount);
  });

  it("passThrough: registrant pays face + fee, organizer nets the full face", () => {
    const cfg: FeeConfig = { mode: "passThrough", ...FEE_29_30 };
    const b = computeFees(face, cfg);
    expect(b.applicationFee).toEqual(money(59, "usd"));
    expect(b.total).toEqual(money(1059, "usd")); // face + fee
    expect(b.organizerNet).toEqual(money(1000, "usd")); // full face
    // Conservation still holds.
    expect(b.total.amount).toBe(b.organizerNet.amount + b.applicationFee.amount);
  });

  it("throws on a negative face price", () => {
    expect(() => computeFees(money(-1, "usd"), { mode: "absorb", ...FEE_29_30 })).toThrow();
  });
});

describe("computeFees — half-up rounding of the bps product", () => {
  it("rounds a .5 minor-unit fee up", () => {
    // 50 * 100 / 10000 = 0.5 → rounds up to 1
    const b = computeFees(money(50, "usd"), { mode: "absorb", percentBps: 100, fixed: 0 });
    expect(b.applicationFee).toEqual(money(1, "usd"));
  });

  it("rounds a .49 fee down and a .51 fee up (exact, no float drift)", () => {
    // 149 * 100 / 10000 = 1.49 → 1
    expect(
      computeFees(money(149, "usd"), { mode: "absorb", percentBps: 100, fixed: 0 }).applicationFee,
    ).toEqual(money(1, "usd"));
    // 151 * 100 / 10000 = 1.51 → 2
    expect(
      computeFees(money(151, "usd"), { mode: "absorb", percentBps: 100, fixed: 0 }).applicationFee,
    ).toEqual(money(2, "usd"));
  });
});

describe("zero-decimal currencies", () => {
  it("charges in the major unit (no cents) for JPY", () => {
    expect(minorUnitDigits("jpy")).toBe(0);
    expect(minorUnitDigits("usd")).toBe(2);
    const b = computeFees(money(1000, "jpy"), { mode: "absorb", ...FEE_29_30 });
    // fee = round(1000 * 290 / 10000) + 30 = 29 + 30 = 59 (still integer minor units)
    expect(b.applicationFee).toEqual(money(59, "jpy"));
    expect(b.total).toEqual(money(1000, "jpy"));
    expect(b.organizerNet).toEqual(money(941, "jpy"));
  });
});

describe("formatMoney", () => {
  it("formats USD minor units as a major-unit currency string", () => {
    expect(formatMoney(money(1250, "usd"))).toBe("$12.50");
    expect(formatMoney(money(0, "usd"))).toBe("$0.00");
  });

  it("formats a zero-decimal currency without cents", () => {
    expect(formatMoney(money(1000, "jpy"))).toBe("¥1,000");
  });
});
