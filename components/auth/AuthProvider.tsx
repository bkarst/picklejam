"use client";

/**
 * AuthProvider — the client auth context (PRD §2, UI §2.11 intent-resume).
 *
 * Uses REAL Firebase when configured (public web config in env); falls back to a
 * DEV provider when Firebase isn't configured OR a test forces it via
 * localStorage `pl-auth-mode=dev`. Exposes `requireAuth(intent)` which either
 * runs the intent immediately (already signed in) or opens the Auth modal and
 * resumes the intent on success (J8). All server writes send `getToken()` as a
 * Bearer (see lib/api/authed.ts).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { publicEnv } from "@/lib/env";
import { encodeDevToken, devUid } from "@/lib/auth/dev";
import { AuthModal } from "./AuthModal";

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export type AuthTab = "login" | "signup";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isDev: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
  /** Run `intent` if signed in, else open the modal and resume on success. */
  requireAuth: (intent?: () => void, tab?: AuthTab) => void;
  openAuth: (tab?: AuthTab) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const DEV_SESSION_KEY = "pl-dev-auth";

function useDevMode(): boolean {
  if (typeof window === "undefined") return !publicEnv.firebase.apiKey;
  try {
    if (localStorage.getItem("pl-auth-mode") === "dev") return true;
  } catch {
    /* ignore */
  }
  return !publicEnv.firebase.apiKey;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDev] = useState<boolean>(useDevMode);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<AuthTab>("login");
  const pendingIntent = useRef<(() => void) | null>(null);
  // Firebase auth instance (real mode) is loaded lazily.
  const fbAuthRef = useRef<import("firebase/auth").Auth | null>(null);

  // ── session bootstrap ──
  useEffect(() => {
    let unsub = () => {};
    if (isDev) {
      try {
        const raw = localStorage.getItem(DEV_SESSION_KEY);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setUser(raw ? (JSON.parse(raw) as AuthUser) : null);
      } catch {
        /* ignore */
      }
      setLoading(false);
    } else {
      (async () => {
        const { getFirebaseAuth } = await import("@/lib/firebase/client");
        const { onAuthStateChanged } = await import("firebase/auth");
        const auth = getFirebaseAuth();
        fbAuthRef.current = auth;
        unsub = onAuthStateChanged(auth, (fb) => {
          setUser(
            fb
              ? { uid: fb.uid, email: fb.email, displayName: fb.displayName, photoURL: fb.photoURL }
              : null,
          );
          setLoading(false);
        });
      })();
    }
    return () => unsub();
  }, [isDev]);

  // ── dev impl ──
  const devSignIn = useCallback((email: string, name?: string) => {
    const u: AuthUser = {
      uid: devUid(email),
      email,
      displayName: name ?? email.split("@")[0],
      photoURL: null,
    };
    localStorage.setItem(DEV_SESSION_KEY, JSON.stringify(u));
    setUser(u);
  }, []);

  // ── actions ──
  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      if (isDev) return devSignIn(email);
      const { signInWithEmailAndPassword } = await import("firebase/auth");
      await signInWithEmailAndPassword(fbAuthRef.current!, email, password);
    },
    [isDev, devSignIn],
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string, name: string) => {
      if (isDev) return devSignIn(email, name);
      const { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } = await import(
        "firebase/auth"
      );
      const cred = await createUserWithEmailAndPassword(fbAuthRef.current!, email, password);
      if (name) await updateProfile(cred.user, { displayName: name });
      await sendEmailVerification(cred.user).catch(() => {});
    },
    [isDev, devSignIn],
  );

  const signInWithGoogle = useCallback(async () => {
    if (isDev) return devSignIn("google.user@dev.local", "Google User");
    const { signInWithPopup, GoogleAuthProvider } = await import("firebase/auth");
    await signInWithPopup(fbAuthRef.current!, new GoogleAuthProvider());
  }, [isDev, devSignIn]);

  const sendPasswordReset = useCallback(
    async (email: string) => {
      if (isDev) return;
      const { sendPasswordResetEmail } = await import("firebase/auth");
      await sendPasswordResetEmail(fbAuthRef.current!, email);
    },
    [isDev],
  );

  const signOut = useCallback(async () => {
    if (isDev) {
      localStorage.removeItem(DEV_SESSION_KEY);
      setUser(null);
      return;
    }
    const { signOut: fbSignOut } = await import("firebase/auth");
    await fbSignOut(fbAuthRef.current!);
  }, [isDev]);

  const getToken = useCallback(async () => {
    if (isDev) {
      if (!user?.email) return null;
      return encodeDevToken({ uid: user.uid, email: user.email, name: user.displayName ?? undefined });
    }
    return fbAuthRef.current?.currentUser?.getIdToken() ?? null;
  }, [isDev, user]);

  // ── modal + intent resume ──
  const openAuth = useCallback((tab: AuthTab = "login") => {
    // A bare "Sign in" (Header / AccountMenu) carries NO intent — drop any intent left
    // over from a previously dismissed requireAuth() so it can't fire on THIS sign-in
    // (e.g. auto-launching Stripe Checkout for an event the user already abandoned).
    pendingIntent.current = null;
    setModalTab(tab);
    setModalOpen(true);
  }, []);

  const requireAuth = useCallback(
    (intent?: () => void, tab: AuthTab = "login") => {
      if (user) {
        intent?.();
        return;
      }
      // openAuth clears any stale intent first; set THIS one AFTER so it resumes.
      openAuth(tab);
      pendingIntent.current = intent ?? null;
    },
    [user, openAuth],
  );

  // AuthModal reports a close here ONLY on an explicit dismiss (Esc / backdrop / ×) —
  // a successful sign-in is closed by the resume effect below, which consumes the
  // intent. So a dismiss means "cancelled": drop the pending intent so it can never
  // fire on a later, unrelated sign-in.
  const handleModalOpenChange = useCallback((open: boolean) => {
    if (!open) pendingIntent.current = null;
    setModalOpen(open);
  }, []);

  // Resume the pending intent once a user appears while the modal is open.
  useEffect(() => {
    if (user && modalOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModalOpen(false);
      const intent = pendingIntent.current;
      pendingIntent.current = null;
      intent?.();
    }
  }, [user, modalOpen]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isDev,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      sendPasswordReset,
      signOut,
      getToken,
      requireAuth,
      openAuth,
    }),
    [user, loading, isDev, signInWithEmail, signUpWithEmail, signInWithGoogle, sendPasswordReset, signOut, getToken, requireAuth, openAuth],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthModal open={modalOpen} tab={modalTab} onOpenChange={handleModalOpenChange} onTab={setModalTab} />
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
