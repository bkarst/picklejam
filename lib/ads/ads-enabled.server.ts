import "server-only";

/**
 * ads-enabled.server.ts — server-side read of the remote `ads_enabled` flag
 * (Firebase Remote Config, default FALSE; see remoteconfig.template.json).
 *
 * Read in the root layout and handed to client <AdSlot>s via <AdsFlagProvider>,
 * so ads are gated at SSR — no client-side fetch, no layout shift.
 *
 * This app authenticates with JWKS (not the Firebase Admin SDK) and provisions
 * NO service-account credentials, so we read Remote Config the same way the web
 * SDK does: a Firebase Installations auth token + the client `:fetch` endpoint,
 * using only the public Firebase config. Fully fail-safe — any error, timeout, or
 * missing config resolves to FALSE (ads off). Cached ~5 min via the Next data
 * cache (`unstable_cache`) so it never deopts static/ISR pages.
 */

import { randomBytes } from "node:crypto";
import { unstable_cache } from "next/cache";
import { publicEnv } from "@/lib/env";

const FLAG_KEY = "ads_enabled";
const TIMEOUT_MS = 2500;
const INSTALLATION_TTL_MS = 12 * 60 * 60_000; // FIS auth tokens live ~1 week; refresh well before.
const TRUTHY = /^(true|1|t|yes|y|on)$/i;

/** A single Firebase installation (FID + auth token), cached per server instance. */
let installation: { fid: string; token: string; at: number } | null = null;

/** A valid Firebase Installation ID: 17 random bytes, base64url, version nibble `0111`. */
function makeFid(): string {
  const buf = randomBytes(17);
  buf[0] = 0b01110000 + (buf[0] % 0b00010000);
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "").slice(0, 22);
}

async function getInstallation(
  apiKey: string,
  appId: string,
  projectId: string,
): Promise<{ fid: string; token: string }> {
  if (installation && Date.now() - installation.at < INSTALLATION_TTL_MS) return installation;
  const res = await fetch(
    `https://firebaseinstallations.googleapis.com/v1/projects/${projectId}/installations`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ fid: makeFid(), appId, authVersion: "FIS_v2", sdkVersion: "w:0.6.4" }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  );
  if (!res.ok) throw new Error(`installations ${res.status}`);
  const data = (await res.json()) as { fid: string; authToken: { token: string } };
  installation = { fid: data.fid, token: data.authToken.token, at: Date.now() };
  return installation;
}

async function readFlag(): Promise<boolean> {
  const { apiKey, appId, projectId } = publicEnv.firebase;
  if (!apiKey || !appId || !projectId) return false; // unconfigured → off
  try {
    const inst = await getInstallation(apiKey, appId, projectId);
    const res = await fetch(
      `https://firebaseremoteconfig.googleapis.com/v1/projects/${projectId}/namespaces/firebase:fetch?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_id: appId,
          app_instance_id: inst.fid,
          app_instance_id_token: inst.token,
          sdk_version: "0.6.4",
          language_code: "en-US",
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    if (!res.ok) throw new Error(`remoteconfig ${res.status}`);
    const data = (await res.json()) as { entries?: Record<string, string> };
    const raw = data.entries?.[FLAG_KEY];
    return raw !== undefined && TRUTHY.test(raw);
  } catch {
    return false; // fail-safe: ads off
  }
}

/** Cached (~5 min) server-side value of the remote `ads_enabled` flag. */
export const getAdsEnabled = unstable_cache(readFlag, ["ads-enabled-flag"], {
  revalidate: 300,
  tags: ["ads-enabled"],
});
