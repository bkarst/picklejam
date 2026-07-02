/**
 * dev.ts — dev-auth token codec (shared client + server).
 *
 * When Firebase isn't configured (or a test forces dev mode), the dev provider
 * issues an UNSIGNED token so the full write path + J8 resume + automated tests
 * run without a live Firebase. The server accepts these ONLY when
 * `ALLOW_DEV_AUTH=1` and never in Production (see lib/auth/verify.ts) — they are
 * NOT a security mechanism, just a deterministic local/CI stand-in for real
 * Firebase ID tokens (which are always verified via Google's JWKS).
 */

export const DEV_TOKEN_PREFIX = "dev.";

export interface DevTokenPayload {
  uid: string;
  email: string;
  name?: string;
}

/** Deterministic dev uid from an email (stable across sessions). */
export function devUid(email: string): string {
  return "dev_" + email.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

// Base64url over UTF-8, prefering the Web `btoa`/`atob` (present in browsers AND
// Node 18+). Buffer is only a last-resort fallback — and we NEVER use its
// "base64url" encoding, because Next's client bundle can inject a `buffer` shim
// whose base64url support is missing/broken (which would throw here and break
// every authed request). See §2 auth.
function b64urlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = typeof btoa !== "undefined" ? btoa(bin) : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  if (typeof atob !== "undefined") {
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(b64, "base64").toString("utf8");
}

export function encodeDevToken(payload: DevTokenPayload): string {
  return DEV_TOKEN_PREFIX + b64urlEncode(JSON.stringify(payload));
}

export function isDevToken(token: string): boolean {
  return token.startsWith(DEV_TOKEN_PREFIX);
}

export function decodeDevToken(token: string): DevTokenPayload | null {
  if (!isDevToken(token)) return null;
  try {
    const parsed = JSON.parse(b64urlDecode(token.slice(DEV_TOKEN_PREFIX.length))) as DevTokenPayload;
    if (!parsed?.uid || !parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}
