/**
 * subscribers.ts — newsletter capture (PRD §6.5/§6.6).
 *
 * The Content Hub + News surfaces capture emails with NO auth. A subscriber row is
 * keyed by lower-cased email (`subscriberKeys.byEmail`) so a repeat signup is
 * naturally idempotent — a create-only `putNew` (conditional on the key not
 * existing) means the second submit reports `alreadySubscribed` instead of
 * clobbering the original `createdAt`/`source`.
 *
 * The welcome email is BEST-EFFORT via Resend (the repo's shared client): a send
 * failure — or a missing `RESEND_API_KEY` in dev/test — is swallowed + logged and
 * never fails the subscribe (§2 hard rule: Resend failures never break a request).
 */

import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { putNew } from "@/lib/db/client";
import { subscriberKeys } from "@/lib/db/keys";
import { brand } from "@/brand.config";
import type { SubscriberItem } from "@/lib/db/types";

/** Pragmatic RFC-5322-lite email check (a full grammar isn't worth it here). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Normalize + validate an email; returns the canonical lower-cased form or null. */
export function normalizeEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  if (normalized.length > 254 || !EMAIL_RE.test(normalized)) return null;
  return normalized;
}

export interface SubscribeResult {
  ok: boolean;
  /** True when the email was already on the list (idempotent no-op write). */
  alreadySubscribed?: boolean;
  /** Present when the email failed validation. */
  error?: string;
}

/**
 * Subscribe an email to the newsletter. Validates + normalizes the address, does an
 * idempotent create-only write of a {@link SubscriberItem}, and fires a best-effort
 * Resend welcome (swallowed on failure). Returns `{ ok }` (+ `alreadySubscribed`).
 */
export async function subscribeNewsletter(
  email: string,
  source?: string,
): Promise<SubscribeResult> {
  const normalized = normalizeEmail(email);
  if (!normalized) return { ok: false, error: "Invalid email address" };

  const now = new Date().toISOString();
  const item: SubscriberItem = {
    ...subscriberKeys.byEmail(normalized),
    entity: "SUBSCRIBER",
    email: normalized,
    ...(source ? { source } : {}),
    createdAt: now,
  };

  try {
    await putNew(item as unknown as Record<string, unknown>);
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      return { ok: true, alreadySubscribed: true };
    }
    throw err;
  }

  await sendWelcomeEmail(normalized);
  return { ok: true };
}

/** Best-effort welcome email. Never throws — a failure is swallowed + logged. */
async function sendWelcomeEmail(email: string): Promise<void> {
  // Skip cleanly when Resend isn't configured (dev/test) — no noisy error logs.
  if (!process.env.RESEND_API_KEY) return;
  try {
    const { getResend } = await import("@/lib/resend");
    await getResend().emails.send({
      from: `${brand.identity.name} <${brand.identity.supportEmail}>`,
      to: email,
      subject: `You're on the ${brand.identity.name} list`,
      html:
        `<p>Thanks for subscribing to ${brand.identity.name} — pickleball courts, games, ` +
        `and news near you.</p><p>We'll be in touch. See you on the courts! 🥒</p>`,
    });
  } catch (err) {
    console.error("[subscribers] welcome email failed (swallowed)", {
      err: err instanceof Error ? err.message : err,
    });
  }
}
