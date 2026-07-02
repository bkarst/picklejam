"use client";

/**
 * AuthModal — focus-trapped dialog wrapping AuthForm (UI §13.4). Esc + backdrop
 * close; Log in / Sign up tabs. On success the AuthProvider's resume effect
 * closes it and runs the pending intent (J8), so `onSuccess` is a no-op here.
 */

import { useEffect, useId, useRef, useState } from "react";
import { Logo } from "@/components/ui/Logo";
import { AuthForm } from "./AuthForm";
import type { AuthTab } from "./AuthProvider";

type Mode = AuthTab | "forgot";

export function AuthModal({
  open,
  tab,
  onOpenChange,
  onTab,
}: {
  open: boolean;
  tab: AuthTab;
  onOpenChange: (open: boolean) => void;
  onTab: (tab: AuthTab) => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // The modal owns login/signup/forgot; `tab` seeds it when the modal opens.
  const [mode, setMode] = useState<Mode>(tab);

  useEffect(() => {
    // Seed the sub-mode from the requested tab whenever the modal opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setMode(tab);
  }, [open, tab]);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    // Focus the first field.
    const t = setTimeout(() => panelRef.current?.querySelector<HTMLElement>("input")?.focus(), 20);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div className="absolute inset-0 bg-backdrop" aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-overlay p-6 shadow-overlay"
      >
        <div className="mb-4 flex items-center justify-between">
          <Logo />
          <button
            type="button"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <h2 id={titleId} className="font-display text-xl font-bold text-foreground">
          {mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Welcome back"}
        </h2>

        {mode !== "forgot" && (
          <div className="mt-3 mb-4 grid grid-cols-2 rounded-full bg-surface-secondary p-1" role="tablist" aria-label="Authentication">
            {(["login", "signup"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={mode === t}
                onClick={() => {
                  setMode(t);
                  onTab(t);
                }}
                className={`h-9 rounded-full text-sm font-semibold transition-colors ${mode === t ? "bg-accent text-accent-foreground" : "text-foreground"}`}
              >
                {t === "login" ? "Log in" : "Sign up"}
              </button>
            ))}
          </div>
        )}

        <AuthForm
          mode={mode}
          onMode={(m) => {
            setMode(m);
            if (m !== "forgot") onTab(m);
          }}
        />
      </div>
    </div>
  );
}
