"use client";

/** Handles the Firebase email-verification link (?oobCode). UI §13.4. */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { publicEnv } from "@/lib/env";

export function VerifyEmailStatus() {
  const oobCode = useSearchParams().get("oobCode");
  const [status, setStatus] = useState<"idle" | "verifying" | "done" | "error">("idle");

  useEffect(() => {
    if (!oobCode || !publicEnv.firebase.apiKey) return;
    let active = true;
    (async () => {
      setStatus("verifying");
      try {
        const { getFirebaseAuth } = await import("@/lib/firebase/client");
        const { applyActionCode } = await import("firebase/auth");
        await applyActionCode(getFirebaseAuth(), oobCode);
        if (active) setStatus("done");
      } catch {
        if (active) setStatus("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [oobCode]);

  if (!publicEnv.firebase.apiKey) return <p className="text-muted">Email verification isn&rsquo;t available in this environment.</p>;
  if (!oobCode) return <p className="text-muted">Check your inbox for a verification link.</p>;
  if (status === "verifying" || status === "idle") return <p className="text-muted">Verifying your email…</p>;
  if (status === "done")
    return (
      <p role="status" className="text-success">
        Your email is verified.{" "}
        <Link href="/account" className="font-semibold text-accent hover:underline">Go to your dashboard</Link>.
      </p>
    );
  return <p role="alert" className="text-danger">This verification link is invalid or has expired.</p>;
}
