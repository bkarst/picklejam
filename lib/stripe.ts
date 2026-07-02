import "server-only";

/**
 * lib/stripe.ts — server Stripe client singleton (PRD §10).
 *
 * Stage 0 "wire the stack" scaffolding: a lazily-initialized, cached Stripe
 * client for server code (route handlers / server actions). `import "server-only"`
 * keeps the secret key out of any client bundle. Importing this file never
 * throws; a missing `STRIPE_SECRET_KEY` only throws when `getStripe()` is called.
 *
 * Money convention (do NOT implement fee logic here): all amounts are integer
 * minor units (e.g. cents) paired with an ISO-4217 currency code — see PRD §10.
 */

import Stripe from "stripe";
import { stripeEnv } from "@/lib/env";

/*
 * Pin the API version the installed `stripe` package is generated against
 * (stripe@22.3.0 → `ApiVersion` = "2026-06-24.dahlia"). The typed `apiVersion`
 * config only accepts this exact literal (`LatestApiVersion = typeof ApiVersion`),
 * so a future SDK bump surfaces at the `new Stripe(...)` call below as a compile
 * error — a deliberate, reviewed change rather than a silent version drift.
 */
const STRIPE_API_VERSION = "2026-06-24.dahlia";

let cached: Stripe | null = null;

/** The server Stripe client (lazily created + cached). */
export function getStripe(): Stripe {
  if (cached) return cached;
  cached = new Stripe(stripeEnv.secretKey, { apiVersion: STRIPE_API_VERSION });
  return cached;
}
