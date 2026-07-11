/**
 * money.ts — exact money (PRD §10). Money is ALWAYS integer **minor units**
 * (cents) + an ISO-4217 currency code; there are NO floats in the money path
 * (float cents silently lose precision and money must be exact — §14.5).
 *
 * The platform fee model has two modes (§10):
 *   - "absorb"      the organizer eats the platform fee: the registrant pays the
 *                   face price, and the fee is taken from the organizer's payout
 *                   as a Stripe `application_fee_amount`.
 *   - "passThrough" the registrant pays face + fee on top; the organizer nets the
 *                   full face price (the fee is still the `application_fee_amount`).
 */

/** An amount in integer minor units (e.g. cents) + its ISO-4217 currency. */
export interface Money {
  /** Integer minor units. Non-integers throw — money is never a float. */
  amount: number;
  /** Lower-case ISO-4217 code (Stripe's convention), e.g. "usd". */
  currency: string;
}

/** Zero-decimal currencies charge in the major unit (no cents). */
const ZERO_DECIMAL = new Set(["bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf"]);

export function minorUnitDigits(currency: string): number {
  return ZERO_DECIMAL.has(currency.toLowerCase()) ? 0 : 2;
}

/** Construct Money from integer minor units. Throws on a non-integer amount. */
export function money(amount: number, currency = "usd"): Money {
  if (!Number.isInteger(amount)) {
    throw new Error(`money() requires integer minor units, got ${amount}`);
  }
  return { amount, currency: currency.toLowerCase() };
}

/** Parse a human major-unit string/number (e.g. "12.50") into Money (minor units). */
export function moneyFromMajor(major: number | string, currency = "usd"): Money {
  const digits = minorUnitDigits(currency);
  const n = typeof major === "string" ? Number(major) : major;
  if (!Number.isFinite(n) || n < 0) throw new Error(`invalid major amount: ${major}`);
  // Round half-up in minor units to avoid float drift (e.g. 12.50*100 = 1249.999…).
  return { amount: Math.round(n * 10 ** digits), currency: currency.toLowerCase() };
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) throw new Error(`currency mismatch: ${a.currency} vs ${b.currency}`);
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount: a.amount + b.amount, currency: a.currency };
}

export function subMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount: a.amount - b.amount, currency: a.currency };
}

/** Format Money for display via Intl (major units), e.g. {1250,"usd"} → "$12.50". */
export function formatMoney(m: Money, locale = "en-US"): string {
  const digits = minorUnitDigits(m.currency);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: m.currency.toUpperCase(),
  }).format(m.amount / 10 ** digits);
}

// ── platform fee model ────────────────────────────────────────────────────────

export type FeeMode = "absorb" | "passThrough";

export interface FeeConfig {
  mode: FeeMode;
  /** Platform percentage in BASIS POINTS (100 bps = 1%). Integer. */
  percentBps: number;
  /** Fixed platform fee in minor units (e.g. 30 = $0.30). Integer. */
  fixed: number;
}

/**
 * The canonical platform fee applied to every paid registration (§10): 7% + $0.30.
 * This is the single source of truth — the create data-layer functions default to
 * it and the create wizards preview it, so what's shown always matches what's
 * charged. The fee is NOT organizer-configurable (only `feeMode` — absorb vs
 * pass-through — is); the create API deliberately ignores any client-supplied
 * percent/fixed so an organizer can't zero out the platform's cut.
 */
export const PLATFORM_FEE: Omit<FeeConfig, "mode"> = { percentBps: 700, fixed: 30 };

export interface FeeBreakdown {
  /** The organizer's list price for the division. */
  face: Money;
  /** The platform's cut (the Stripe `application_fee_amount`). */
  applicationFee: Money;
  /** What the REGISTRANT is charged (the Checkout total). */
  total: Money;
  /** What the ORGANIZER nets after the platform fee. */
  organizerNet: Money;
}

/** Round half-up; inputs are integers so this only matters for the bps product. */
function feeOf(face: Money, cfg: FeeConfig): Money {
  const pct = Math.round((face.amount * cfg.percentBps) / 10_000);
  return { amount: pct + cfg.fixed, currency: face.currency };
}

/**
 * Compute the exact fee split for a registration (§10). Integer math throughout.
 *   absorb:      total = face;         organizerNet = face - fee
 *   passThrough: total = face + fee;   organizerNet = face
 * The `applicationFee` is what the platform collects in BOTH modes.
 */
export function computeFees(face: Money, cfg: FeeConfig): FeeBreakdown {
  if (face.amount < 0) throw new Error("face price cannot be negative");
  const applicationFee = feeOf(face, cfg);
  if (cfg.mode === "passThrough") {
    return {
      face,
      applicationFee,
      total: addMoney(face, applicationFee),
      organizerNet: face,
    };
  }
  // absorb
  return {
    face,
    applicationFee,
    total: face,
    organizerNet: subMoney(face, applicationFee),
  };
}
