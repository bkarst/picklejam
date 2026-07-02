import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/ui/Logo";
import { VerifyEmailStatus } from "@/components/auth/VerifyEmailStatus";

export const metadata: Metadata = {
  title: "Verify your email",
  robots: { index: false, follow: false },
};

export default function VerifyEmailPage() {
  return (
    <main id="main" className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-center shadow-surface">
        <div className="mb-4 flex justify-center"><Logo /></div>
        <h1 className="mb-4 font-display text-2xl font-bold text-foreground">Email verification</h1>
        <Suspense>
          <VerifyEmailStatus />
        </Suspense>
      </div>
    </main>
  );
}
