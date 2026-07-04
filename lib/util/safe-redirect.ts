/**
 * safe-redirect.ts — sanitize a post-auth `?next=` redirect target.
 *
 * Returns a SAME-ORIGIN path (default `/account`). Prevents an open redirect — a phishing
 * `?next=https://evil…` bouncing a just-signed-in user off-site (L5). Only a genuine
 * path-absolute URL survives: absolute URLs (`https://…`, `javascript:…` — no leading `/`),
 * protocol-relative (`//host`), and backslash variants that browsers normalize toward `//`
 * (`/\host`) are all rejected. Pure (no `window`) so it is safe to call during SSR.
 */
export function safeNextPath(raw: string | null | undefined, fallback = "/account"): string {
  if (!raw || !raw.startsWith("/") || /^\/[/\\]/.test(raw)) return fallback;
  return raw;
}
