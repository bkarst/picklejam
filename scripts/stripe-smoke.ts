#!/usr/bin/env tsx
/**
 * stripe-smoke.ts — validate the configured Stripe TEST keys against the real
 * Stripe API (test mode only; creates a throwaway Connect account + onboarding
 * link — NO charges, no live money). Run with the key loaded from .env:
 *   env $(grep -E '^STRIPE_' .env | xargs) npx tsx scripts/stripe-smoke.ts
 * Prints only ids/status — never the secret.
 */

import { getGateway } from "@/lib/stripe";

async function main() {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!key.startsWith("sk_test")) {
    throw new Error(`Refusing to run: STRIPE_SECRET_KEY is not a test key (starts with '${key.slice(0, 7)}').`);
  }
  const g = getGateway();
  console.log("gateway.mode =", g.mode);

  const acct = await g.createConnectAccount({ email: "smoke@pickleloko.test", country: "US" });
  console.log("connect account:", acct.accountId.slice(0, 10) + "…", "status:", acct.status, "charges:", acct.chargesEnabled);

  const link = await g.createOnboardingLink(acct.accountId, {
    refreshUrl: "https://pickleloko.com/organize?refresh",
    returnUrl: "https://pickleloko.com/organize?done",
  });
  console.log("onboarding link:", link.url.startsWith("https://") ? "OK (hosted url returned)" : "MISSING");

  const fetched = await g.getConnectAccount(acct.accountId);
  console.log("re-fetched status:", fetched.status);

  console.log("✅ Stripe test-mode keys are valid and RealStripeGateway works.");
}

main().catch((e) => {
  console.error("❌ Stripe smoke failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
