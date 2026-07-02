/**
 * POST /api/newsletter — newsletter subscribe (PRD §6.5/§6.6).
 *
 * NO auth: the Content Hub / News capture forms are public. The body is `{ email,
 * source? }`; the email is validated + normalized in the data layer and stored
 * idempotently, so a rapid double-submit (or a bot re-post) is a harmless no-op —
 * rate-limit-friendly. A best-effort Resend welcome fires without blocking the OK.
 */

import type { NextRequest } from "next/server";
import { guarded, bad, jsonBody } from "@/app/api/_util";
import { subscribeNewsletter } from "@/lib/data/subscribers";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const body = await jsonBody(req);
    const email = typeof body.email === "string" ? body.email : "";
    const source = typeof body.source === "string" ? body.source : undefined;
    if (!email.trim()) bad("An email address is required");

    const result = await subscribeNewsletter(email, source);
    if (!result.ok) bad(result.error ?? "Could not subscribe");

    return Response.json({
      ok: true,
      alreadySubscribed: result.alreadySubscribed ?? false,
    });
  });
}
