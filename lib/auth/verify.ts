/**
 * verify.ts — server-side request authorization (PRD §2). Every route-handler
 * WRITE calls `requireAuth(req)` first; an unauthenticated/invalid token is
 * rejected with 401.
 *
 * Real Firebase ID tokens are verified against Google's public JWKS with `jose`
 * (no service account needed — verification only checks the signature + iss/aud/
 * exp against the project id). Dev tokens (lib/auth/dev.ts) are accepted ONLY
 * when `ALLOW_DEV_AUTH=1` and never in Production — a deterministic local/CI
 * stand-in, never a security bypass.
 */

import { jwtVerify, createRemoteJWKSet, type JWTPayload } from "jose";
import { publicEnv, APP_ENV } from "@/lib/env";
import { decodeDevToken, isDevToken } from "./dev";

export interface AuthedUser {
  uid: string;
  email?: string;
  name?: string;
}

/** Thrown on auth failure; `requireAuth` converts it to a 401 Response. */
export class AuthError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "AuthError";
  }
}

const PROJECT_ID = publicEnv.firebase.projectId;
const ISSUER = `https://securetoken.google.com/${PROJECT_ID}`;
const JWKS_URL = new URL(
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
);

// Cache the remote JWK set across requests (jose refreshes + caches internally).
let _jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
function jwks() {
  return (_jwks ??= createRemoteJWKSet(JWKS_URL));
}

const devAuthAllowed = () => process.env.ALLOW_DEV_AUTH === "1" && APP_ENV !== "Production";

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (h?.startsWith("Bearer ")) return h.slice(7).trim();
  return null;
}

/** Verify a raw token string → AuthedUser (throws AuthError on failure). */
export async function verifyToken(token: string): Promise<AuthedUser> {
  if (isDevToken(token)) {
    if (!devAuthAllowed()) throw new AuthError("Dev tokens are not accepted here");
    const dev = decodeDevToken(token);
    if (!dev) throw new AuthError("Malformed dev token");
    return { uid: dev.uid, email: dev.email, name: dev.name };
  }

  if (!PROJECT_ID) throw new AuthError("Firebase project not configured");
  try {
    const { payload } = await jwtVerify(token, jwks(), {
      issuer: ISSUER,
      audience: PROJECT_ID,
    });
    return userFromFirebasePayload(payload);
  } catch {
    throw new AuthError("Invalid ID token");
  }
}

function userFromFirebasePayload(p: JWTPayload): AuthedUser {
  if (!p.sub) throw new AuthError("Token missing subject");
  return {
    uid: p.sub,
    email: typeof p.email === "string" ? p.email : undefined,
    name: typeof p.name === "string" ? p.name : undefined,
  };
}

/** Verify the request's Bearer token, or throw AuthError. */
export async function verifyRequest(req: Request): Promise<AuthedUser> {
  const token = bearer(req);
  if (!token) throw new AuthError("Missing Authorization header");
  return verifyToken(token);
}

/**
 * Authorize a route handler. Returns the user, or throws a `Response` (401) that
 * the handler can let propagate. Usage:
 *   const user = await requireAuth(req);  // 401s if unauthenticated
 */
export async function requireAuth(req: Request): Promise<AuthedUser> {
  try {
    return await verifyRequest(req);
  } catch (err) {
    const message = err instanceof AuthError ? err.message : "Unauthorized";
    throw Response.json({ error: message }, { status: 401 });
  }
}
