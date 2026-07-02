import "server-only";

/**
 * lib/firebase/admin.ts — Firebase Admin SDK singleton (server-only).
 *
 * Stage 0 "wire the stack" scaffolding. Server-side ID-token verification is
 * what authorizes every route-handler write (PRD §2): a client sends its
 * Firebase ID token, and `verifyIdToken` here confirms the caller's identity.
 *
 * Initialized lazily from a service-account credential (see `firebaseAdminEnv`)
 * and guarded against re-init via `getApps()`. The `import "server-only"` above
 * makes this a hard build error if it is ever pulled into a client bundle.
 * Importing this file never throws; missing credentials only throw when
 * `getAdminAuth()` / `verifyIdToken()` is actually called.
 */

import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth, type DecodedIdToken } from "firebase-admin/auth";
import { firebaseAdminEnv } from "@/lib/env";

let cachedApp: App | null = null;
let cachedAuth: Auth | null = null;

function getAdminApp(): App {
  if (cachedApp) return cachedApp;

  cachedApp = getApps().length
    ? getApp()
    : initializeApp({
        credential: cert({
          projectId: firebaseAdminEnv.projectId,
          clientEmail: firebaseAdminEnv.clientEmail,
          privateKey: firebaseAdminEnv.privateKey,
        }),
      });

  return cachedApp;
}

/** The Admin Auth service (lazily created + cached). */
export function getAdminAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  cachedAuth = getAuth(getAdminApp());
  return cachedAuth;
}

/**
 * Verify a client-supplied Firebase ID token and return its decoded claims.
 * This is the server-side authorization check for route-handler writes (PRD §2).
 * Rejects if the token is missing, malformed, expired, or revoked.
 */
export function verifyIdToken(idToken: string): Promise<DecodedIdToken> {
  return getAdminAuth().verifyIdToken(idToken);
}
