/**
 * POST /api/contact — the marketing contact form (PRD §16).
 *
 * NO auth: the contact form is public. Body is `{ name, email, message }`, all
 * validated here. On success we make a BEST-EFFORT attempt to email the inbound
 * message to `brand.identity.supportEmail` via Resend (mirroring `lib/notify.ts`
 * / `lib/resend.ts`), with the sender's address as `reply_to` so a reply goes
 * straight back to them. Per the §2 hard rule, a Resend failure (or a missing
 * RESEND_API_KEY) is swallowed + logged and NEVER fails the request — the user
 * still gets an OK so the form isn't a dead end.
 */

import type { NextRequest } from "next/server";
import { guarded, bad, jsonBody } from "@/app/api/_util";
import { getResend } from "@/lib/resend";
import { brand } from "@/brand.config";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LEN = 5000;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const body = await jsonBody(req);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!name) bad("A name is required");
    if (!EMAIL_RE.test(email)) bad("A valid email address is required");
    if (message.length < 10) bad("A message of at least 10 characters is required");
    if (name.length > 200 || email.length > 200 || message.length > MAX_LEN) {
      bad("One of the fields is too long");
    }

    // Best-effort email mirror — never blocks or fails the OK response (§2).
    try {
      await getResend().emails.send({
        from: `${brand.identity.name} Contact <${brand.identity.supportEmail}>`,
        to: brand.identity.supportEmail,
        replyTo: email,
        subject: `New contact message from ${name}`,
        html: `<h2>New contact message</h2>
<p><strong>Name:</strong> ${escapeHtml(name)}</p>
<p><strong>Email:</strong> ${escapeHtml(email)}</p>
<p><strong>Message:</strong></p>
<p style="white-space:pre-wrap">${escapeHtml(message)}</p>`,
      });
    } catch (err) {
      console.error("[contact] Resend send failed (swallowed)", {
        err: err instanceof Error ? err.message : err,
      });
    }

    return Response.json({ ok: true });
  });
}
