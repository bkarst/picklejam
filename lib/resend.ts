import "server-only";

/**
 * lib/resend.ts — server Resend email client singleton.
 *
 * Stage 0 "wire the stack" scaffolding. Resend sends our transactional /
 * notification mail (PRD §2). Note the division of labor: auth mail (sign-in,
 * verification, password reset) is sent by Firebase, and payment receipts by
 * Stripe — Resend is for everything else (e.g. outing invites, reminders).
 *
 * Lazily initialized + cached; `import "server-only"` keeps the API key off the
 * client. Importing this file never throws; a missing `RESEND_API_KEY` only
 * throws when `getResend()` is actually called.
 */

import { Resend } from "resend";
import { resendEnv } from "@/lib/env";

let cached: Resend | null = null;

/** The server Resend client (lazily created + cached). */
export function getResend(): Resend {
  if (cached) return cached;
  cached = new Resend(resendEnv.apiKey);
  return cached;
}
