/**
 * /api/unsubscribe — one-click email suppression (PRD §6.3, §9.3).
 *
 * GET `?token=` adds the token's email to the profile's `unsubscribed` list so
 * future notification mail is suppressed for that address. Intentionally NOT
 * authed — it's reached from an email link (and RFC 8058 one-click POST), so the
 * opaque token IS the authorization. Always responds with a friendly HTML page.
 *
 * Token security is a v1 base64 of `uid:email` — see the signing TODO in
 * `lib/notify.ts#makeUnsubToken`.
 */

import type { NextRequest } from "next/server";
import { parseUnsubToken } from "@/lib/notify";
import { addUnsubscribe } from "@/lib/data/notifications";
import { brand } from "@/brand.config";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  return handle(req.nextUrl.searchParams.get("token"));
}

// RFC 8058 one-click unsubscribe delivers a POST with the token as a query param.
export async function POST(req: NextRequest): Promise<Response> {
  return handle(req.nextUrl.searchParams.get("token"));
}

async function handle(token: string | null): Promise<Response> {
  const parsed = token ? parseUnsubToken(token) : null;
  if (!parsed) {
    return htmlPage(
      "Invalid unsubscribe link",
      "This unsubscribe link is invalid or has expired. You can manage your email preferences from your account settings.",
      400,
    );
  }

  try {
    await addUnsubscribe(parsed.uid, parsed.email);
  } catch (err) {
    console.error("[unsubscribe] failed to suppress", {
      uid: parsed.uid,
      err: err instanceof Error ? err.message : err,
    });
    return htmlPage(
      "Something went wrong",
      "We couldn't update your preferences right now. Please try again, or manage your alerts from your account settings.",
      500,
    );
  }

  return htmlPage(
    "You're unsubscribed",
    `${parsed.email} will no longer receive notification emails from ${brand.identity.name}. You can turn them back on anytime from your account alerts.`,
    200,
  );
}

/** A tiny brand-styled confirmation page (inline hex — no app theme in raw HTML). */
function htmlPage(heading: string, message: string, status: number): Response {
  const { palette, colors, identity, siteUrl } = brand;
  const { muted, border } = colors.light;
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${esc(heading)} · ${esc(identity.name)}</title>
  </head>
  <body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:${palette.cream};font-family:Montserrat,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${palette.ink};">
    <main style="max-width:440px;margin:24px;padding:32px;background:${palette.white};border:1px solid ${border};border-radius:16px;text-align:center;">
      <div style="font-size:18px;font-weight:700;color:${palette.courtGreen};margin-bottom:16px;">${esc(identity.name)}</div>
      <h1 style="font-size:22px;margin:0 0 12px;">${esc(heading)}</h1>
      <p style="font-size:15px;line-height:1.6;color:${muted};margin:0 0 24px;">${esc(message)}</p>
      <a href="${esc(siteUrl)}/account/alerts" style="display:inline-block;background:${palette.courtGreen};color:${palette.white};text-decoration:none;font-weight:600;padding:12px 22px;border-radius:9999px;">Manage alerts</a>
    </main>
  </body>
</html>`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
