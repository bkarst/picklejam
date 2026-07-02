"use client";

/**
 * lib/firebase/client.ts — Firebase client app + Auth singleton (browser).
 *
 * Stage 0 "wire the stack" scaffolding: a lazily-initialized Firebase client
 * app and its Auth service for use in Client Components. Firebase is the
 * source of user identity + auth mail (PRD §2); this module owns only the
 * browser SDK — server-side ID-token verification lives in `lib/firebase/admin.ts`.
 *
 * The app is created on first use (guarded against Fast Refresh / double-init
 * via `getApps()`) and cached at module scope. Importing this file never throws;
 * a missing `NEXT_PUBLIC_FIREBASE_API_KEY` only throws when `getFirebaseAuth()`
 * is actually called.
 */

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { publicEnv } from "@/lib/env";

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;

function getFirebaseApp(): FirebaseApp {
  if (cachedApp) return cachedApp;

  if (!publicEnv.firebase.apiKey) {
    throw new Error(
      "Firebase client is not configured: NEXT_PUBLIC_FIREBASE_API_KEY is empty. " +
        "Set the NEXT_PUBLIC_FIREBASE_* env vars (see .env.example).",
    );
  }

  cachedApp = getApps().length
    ? getApp()
    : initializeApp({
        apiKey: publicEnv.firebase.apiKey,
        authDomain: publicEnv.firebase.authDomain,
        projectId: publicEnv.firebase.projectId,
        appId: publicEnv.firebase.appId,
        storageBucket: publicEnv.firebase.storageBucket,
        messagingSenderId: publicEnv.firebase.messagingSenderId,
      });

  return cachedApp;
}

/** The browser Firebase Auth instance (lazily created + cached). */
export function getFirebaseAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  cachedAuth = getAuth(getFirebaseApp());
  return cachedAuth;
}
