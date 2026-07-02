"use client";

/** Handles the Firebase password-reset email link (?oobCode). UI §13.4. */

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@heroui/react";
import { publicEnv } from "@/lib/env";

export function ResetPasswordForm() {
  const oobCode = useSearchParams().get("oobCode");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!publicEnv.firebase.apiKey) {
    return <p className="text-muted">Password reset isn&rsquo;t available in this environment.</p>;
  }
  if (!oobCode) {
    return (
      <p className="text-muted">
        This link is invalid or expired.{" "}
        <Link href="/forgot-password" className="font-semibold text-accent hover:underline">Request a new one</Link>.
      </p>
    );
  }
  if (status === "done") {
    return (
      <p role="status" className="text-success">
        Your password has been updated.{" "}
        <Link href="/login" className="font-semibold text-accent hover:underline">Log in</Link>.
      </p>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("busy");
    setError(null);
    try {
      const { getFirebaseAuth } = await import("@/lib/firebase/client");
      const { confirmPasswordReset } = await import("firebase/auth");
      await confirmPasswordReset(getFirebaseAuth(), oobCode, password);
      setStatus("done");
    } catch {
      setStatus("error");
      setError("Couldn't reset your password. The link may have expired.");
    }
  };

  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <label htmlFor="new-password" className="text-sm font-medium text-foreground">New password</label>
      <input
        id="new-password"
        type="password"
        required
        minLength={6}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="h-11 rounded-xl border border-border bg-field px-4 text-field-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      />
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="submit" variant="primary" size="lg" isDisabled={status === "busy"}>
        {status === "busy" ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
