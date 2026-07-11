"use client";

/**
 * AuthForm — shared credential form used by the Auth modal AND the standalone
 * /login·/signup·/forgot-password pages (UI §13.4). Email/password + Google
 * + forgot-password. Signup collects only email + name + password. On success it
 * calls `onSuccess` (the modal resumes the pending intent; pages redirect).
 */

import { useState } from "react";
import { Button } from "@heroui/react";
import { useAuth, type AuthTab } from "./AuthProvider";

type Mode = AuthTab | "forgot";

/** Official multi-color Google "G" mark, per Google's brand guidelines. */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function friendlyError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  if (code.includes("wrong-password") || code.includes("invalid-credential")) return "Wrong email or password.";
  if (code.includes("email-already-in-use")) return "That email already has an account — try logging in.";
  if (code.includes("weak-password")) return "Password should be at least 6 characters.";
  if (code.includes("user-not-found")) return "No account found for that email.";
  if (code.includes("popup-closed")) return "Sign-in was cancelled.";
  if (code.includes("operation-not-allowed")) return "That sign-in method isn't enabled yet.";
  return (e as Error)?.message || "Something went wrong. Please try again.";
}

export function AuthForm({
  mode,
  onMode,
  onSuccess,
}: {
  mode: Mode;
  onMode: (m: Mode) => void;
  onSuccess?: () => void;
}) {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "login") await auth.signInWithEmail(email, password);
      else if (mode === "signup") await auth.signUpWithEmail(email, password, name);
      else {
        await auth.sendPasswordReset(email);
        setNotice("If an account exists for that email, a reset link is on its way.");
        setBusy(false);
        return;
      }
      onSuccess?.();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const oauth = async (fn: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
      onSuccess?.();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "h-11 w-full rounded-xl border border-border bg-field px-4 text-field-foreground placeholder:text-field-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

  return (
    <div className="flex flex-col gap-4">
      {mode !== "forgot" && (
        <div className="flex flex-col gap-2">
          <Button type="button" variant="outline" size="lg" fullWidth onPress={() => oauth(auth.signInWithGoogle)} isDisabled={busy}>
            <span className="inline-flex items-center justify-center gap-2.5">
              <GoogleIcon className="size-5 shrink-0" />
              Continue with Google
            </span>
          </Button>
          <div className="my-1 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>
        </div>
      )}

      <form className="flex flex-col gap-3" onSubmit={submit}>
        {mode === "signup" && (
          <div>
            <label htmlFor="auth-name" className="mb-1 block text-sm font-medium text-foreground">Name</label>
            <input id="auth-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
          </div>
        )}
        <div>
          <label htmlFor="auth-email" className="mb-1 block text-sm font-medium text-foreground">Email</label>
          <input id="auth-email" type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        {mode !== "forgot" && (
          <div>
            <label htmlFor="auth-password" className="mb-1 block text-sm font-medium text-foreground">Password</label>
            <input id="auth-password" type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
          </div>
        )}

        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {notice && <p role="status" className="text-sm text-success">{notice}</p>}

        <Button type="submit" variant="primary" size="lg" fullWidth isDisabled={busy}>
          {busy ? "Please wait…" : mode === "login" ? "Log in" : mode === "signup" ? "Create account" : "Send reset link"}
        </Button>
      </form>

      <div className="flex flex-col gap-1 text-center text-sm text-muted">
        {mode === "login" && (
          <>
            <button type="button" className="hover:text-foreground hover:underline" onClick={() => onMode("forgot")}>Forgot password?</button>
            <span>New here? <button type="button" className="font-semibold text-accent hover:underline" onClick={() => onMode("signup")}>Create an account</button></span>
          </>
        )}
        {mode === "signup" && (
          <span>Already have an account? <button type="button" className="font-semibold text-accent hover:underline" onClick={() => onMode("login")}>Log in</button></span>
        )}
        {mode === "forgot" && (
          <button type="button" className="font-semibold text-accent hover:underline" onClick={() => onMode("login")}>Back to log in</button>
        )}
      </div>
    </div>
  );
}
