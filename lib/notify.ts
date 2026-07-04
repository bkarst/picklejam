import "server-only";

/**
 * notify.ts — the notification rail's orchestration layer (PRD §9.3, §6.3 prefs).
 *
 * `notify(uid, template)` always writes the in-app notification, then MIRRORS it
 * to a branded Resend email when — and only when — the user's prefs allow the
 * email channel for that type, their address isn't suppressed (unsubscribed), and
 * we're outside their quiet hours. `fanOut` notifies many recipients (Stage 4's
 * "new game at a followed court" over a court's followers).
 *
 * Hard rule (§2): a Resend failure is swallowed + logged and NEVER fails the
 * caller — email is a best-effort mirror of the durable in-app row.
 *
 * The gating decision lives in the pure {@link resolveEmailAllowed} so it is
 * unit-tested without a database or mail client.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { getResend } from "@/lib/resend";
import { brand } from "@/brand.config";
import { APP_ENV } from "@/lib/env";
import {
  createNotification,
  type NotificationInput,
  type StoredNotification,
} from "@/lib/data/notifications";
import { getUserProfile } from "@/lib/data/users";
import { updateItem } from "@/lib/db/client";
import type { NotificationType, NotifPrefs, UserProfileItem } from "@/lib/db/types";

/** A single notification to deliver: in-app content + optional email mirror. */
export interface NotifyTemplate extends NotificationInput {
  /** Recipient email for the mirror. Omit → in-app only (profiles don't store email yet). */
  email?: string;
  /** CTA link for the email (falls back to `entityRef`, then the site URL). */
  url?: string;
}

// ── pure gating decision (unit-tested) ───────────────────────────────────────

/**
 * Decide whether the email mirror is allowed for `type`, given the recipient's
 * profile. Three independent gates, all must pass:
 *   1. prefs — the type's `email` channel isn't explicitly off (default ON).
 *   2. suppression — the recipient's address isn't in `unsubscribed`.
 *   3. quiet hours — `now` isn't inside the profile's quiet-hours window.
 *
 * Pure + side-effect-free. `opts.email` enables the suppression check; `opts.now`
 * makes the quiet-hours check deterministic in tests.
 */
export function resolveEmailAllowed(
  profile: Pick<UserProfileItem, "notifPrefs" | "unsubscribed">,
  type: NotificationType,
  opts?: { email?: string; now?: Date },
): boolean {
  // 1. Per-type email channel preference (opt-out model: default allowed).
  if (profile.notifPrefs?.channels?.[type]?.email === false) return false;

  // 2. Suppression list (one-click unsubscribe).
  const email = opts?.email?.toLowerCase();
  if (email && (profile.unsubscribed ?? []).some((e) => e.toLowerCase() === email)) {
    return false;
  }

  // 3. Quiet hours.
  const quiet = profile.notifPrefs?.quietHours;
  if (quiet && isWithinQuietHours(quiet, opts?.now ?? new Date())) return false;

  return true;
}

/**
 * Whether `now` falls inside a quiet-hours window (supports windows that wrap
 * midnight, e.g. 22:00–07:00). Compared in UTC for determinism.
 * TODO(tz): store the user's IANA time zone and evaluate in their local time.
 */
export function isWithinQuietHours(
  quiet: NonNullable<NotifPrefs["quietHours"]>,
  now: Date,
): boolean {
  const start = parseHHmm(quiet.start);
  const end = parseHHmm(quiet.end);
  if (start === null || end === null || start === end) return false;
  const n = now.getUTCHours() * 60 + now.getUTCMinutes();
  return start < end ? n >= start && n < end : n >= start || n < end;
}

function parseHHmm(s: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

// ── one-click unsubscribe tokens ─────────────────────────────────────────────

/**
 * HMAC key for unsubscribe tokens. REQUIRED in production (an unset secret would sign with
 * a public dev fallback → forgeable again); a fixed fallback in dev/test keeps them working.
 */
function unsubSecret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET;
  if (s) return s;
  if (APP_ENV === "Production") {
    throw new Error("UNSUBSCRIBE_SECRET is required in production to sign unsubscribe tokens");
  }
  return "dev-only-unsubscribe-secret";
}

/** base64url HMAC-SHA256 of the payload under the unsubscribe secret. */
function signUnsub(payload: string): string {
  return createHmac("sha256", unsubSecret()).update(payload).digest("base64url");
}

/**
 * Signed unsubscribe token: `base64url(uid:email).hmac`. The HMAC makes it TAMPER-PROOF —
 * knowing a victim's uid + email is no longer enough to forge a suppression (L1). (No
 * expiry: an unsubscribe link must keep working for the life of the email, RFC 8058.)
 */
export function makeUnsubToken(uid: string, email: string): string {
  const payload = `${uid}:${email}`;
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${signUnsub(payload)}`;
}

/** Parse + VERIFY an unsubscribe token → `{uid, email}`; null if malformed or the HMAC fails. */
export function parseUnsubToken(token: string): { uid: string; email: string } | null {
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null; // require both payload + signature
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let payload: string;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  // Constant-time signature check — a forged/tampered token is rejected.
  const provided = Buffer.from(sig);
  const expected = Buffer.from(signUnsub(payload));
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  const i = payload.indexOf(":");
  if (i <= 0 || i === payload.length - 1) return null;
  const uid = payload.slice(0, i);
  const email = payload.slice(i + 1);
  if (!uid || !email) return null;
  return { uid, email };
}

// ── delivery ─────────────────────────────────────────────────────────────────

/**
 * Deliver one notification: write the in-app row (always), then best-effort
 * mirror it to email when allowed. In-app write errors propagate (a real DB
 * failure); email errors are swallowed + logged.
 */
export async function notify(uid: string, template: NotifyTemplate): Promise<void> {
  const created = await createNotification(uid, {
    type: template.type,
    title: template.title,
    body: template.body,
    entityRef: template.entityRef,
  });

  try {
    await maybeSendEmail(uid, created, template);
  } catch (err) {
    console.error("[notify] email mirror failed (swallowed)", {
      uid,
      type: template.type,
      err: err instanceof Error ? err.message : err,
    });
  }
}

async function maybeSendEmail(
  uid: string,
  created: StoredNotification,
  template: NotifyTemplate,
): Promise<void> {
  const profile = await getUserProfile(uid);
  if (!profile) return;
  // Profiles don't store email yet; prefer the template, fall back to any stored one.
  const email = template.email ?? (profile as { email?: string }).email;
  if (!email) return;
  if (!resolveEmailAllowed(profile, template.type, { email })) return;

  const link = template.url ?? absoluteUrl(template.entityRef) ?? brand.siteUrl;
  const unsubscribeUrl = `${brand.siteUrl}/api/unsubscribe?token=${makeUnsubToken(uid, email)}`;

  await getResend().emails.send({
    from: `${brand.identity.name} <${brand.identity.supportEmail}>`,
    to: email,
    subject: template.title,
    html: renderNotificationEmail({
      title: template.title,
      body: template.body,
      link,
      unsubscribeUrl,
    }),
    headers: {
      // RFC 8058 one-click unsubscribe (mailbox-provider "unsubscribe" button).
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });

  // Record that the email channel fired (best-effort; failure is non-fatal).
  await updateItem({
    key: { pk: created.pk, sk: created.sk },
    update: "SET channelsSent = :c",
    values: { ":c": ["inapp", "email"] },
  }).catch(() => {});
}

/**
 * Notify many recipients (Stage 4 fan-out over a court's followers). Each
 * recipient's template comes from `templateFor(uid)`. One recipient failing
 * never stops the others (per-user isolation via `allSettled`).
 */
export async function fanOut(
  uids: string[],
  templateFor: (uid: string) => NotifyTemplate,
): Promise<void> {
  const results = await Promise.allSettled(uids.map((uid) => notify(uid, templateFor(uid))));
  for (const r of results) {
    if (r.status === "rejected") {
      console.error("[fanOut] recipient notify failed (swallowed)", r.reason);
    }
  }
}

// ── email rendering ──────────────────────────────────────────────────────────

/** Resolve a possibly-relative deep link to an absolute URL (or null). */
function absoluteUrl(ref?: string): string | null {
  if (!ref) return null;
  if (/^https?:\/\//i.test(ref)) return ref;
  return `${brand.siteUrl}${ref.startsWith("/") ? "" : "/"}${ref}`;
}

/**
 * A minimal, brand-styled HTML email. Email clients need inline hex (they don't
 * see the app's theme classes), so colors come straight from the brand palette.
 */
function renderNotificationEmail(opts: {
  title: string;
  body?: string;
  link: string;
  unsubscribeUrl: string;
}): string {
  const { palette, colors, identity, siteUrl } = brand;
  const { muted, border } = colors.light;
  const esc = escapeHtml;
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:${palette.cream};font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${palette.charcoal};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${palette.cream};padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:${palette.white};border-radius:16px;overflow:hidden;border:1px solid ${border};">
            <tr>
              <td style="background:${palette.forest};padding:20px 28px;">
                <span style="font-size:18px;font-weight:700;color:${palette.white};">${esc(identity.name)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:${palette.charcoal};">${esc(opts.title)}</h1>
                ${opts.body ? `<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${muted};">${esc(opts.body)}</p>` : ""}
                <a href="${esc(opts.link)}" style="display:inline-block;background:${palette.forest};color:${palette.white};text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:9999px;">View in ${esc(identity.name)}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px;border-top:1px solid ${border};font-size:12px;line-height:1.6;color:${muted};">
                You're receiving this because you have notifications turned on.
                <a href="${esc(opts.unsubscribeUrl)}" style="color:${palette.forest};">Unsubscribe</a>
                or <a href="${esc(siteUrl)}/account/alerts" style="color:${palette.forest};">manage alerts</a>.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
