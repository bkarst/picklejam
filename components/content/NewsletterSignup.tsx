"use client";

/**
 * NewsletterSignup — the "Stay in the loop" capture band (§6.5/§6.6, mockups
 * 8.1/9.1). The ONLY client-interactive island on the content surfaces.
 *
 * Posts `{ email, source }` to `POST /api/newsletter` (Resend-backed). Gives
 * IMMEDIATE feedback: the button shows a submitting state, success swaps in a
 * thank-you, and errors surface inline with a retry (UI rules — every action
 * gets an immediate response). The status is announced via an aria-live region.
 */

import type { JSX } from "react";
import { useState } from "react";

type Status = "idle" | "submitting" | "success" | "error";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function NewsletterSignup({
  source = "content",
  variant = "band",
  title = "Stay in the loop",
  description = "Get the latest guides, tips, and pickleball news — straight to your inbox.",
}: {
  source?: string;
  variant?: "band" | "inline";
  title?: string;
  description?: string;
}): JSX.Element {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "submitting") return;
    if (!EMAIL_RE.test(email)) {
      setStatus("error");
      setError("Please enter a valid email address.");
      return;
    }
    setStatus("submitting");
    setError("");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus("success");
      setEmail("");
    } catch {
      setStatus("error");
      setError("Something went wrong. Please try again.");
    }
  }

  const inputCls =
    "h-11 w-full rounded-full border border-border bg-field px-4 text-field-foreground placeholder:text-field-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
  const buttonCls =
    "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-secondary px-6 text-sm font-semibold text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60";

  const form =
    status === "success" ? (
      <p
        role="status"
        className="flex items-center gap-2 text-sm font-semibold text-foreground"
      >
        <svg viewBox="0 0 24 24" className="size-5 text-success" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6L9 17l-5-5" />
        </svg>
        Thanks! You&apos;re on the list.
      </p>
    ) : (
      <form onSubmit={onSubmit} noValidate className="w-full sm:w-auto">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor={`newsletter-email-${source}`} className="sr-only">
            Email address
          </label>
          <input
            id={`newsletter-email-${source}`}
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder="Enter your email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (status === "error") setStatus("idle");
            }}
            aria-invalid={status === "error"}
            aria-describedby={status === "error" ? `newsletter-err-${source}` : undefined}
            className={`${inputCls} sm:w-72`}
            disabled={status === "submitting"}
          />
          <button type="submit" className={buttonCls} disabled={status === "submitting"}>
            {status === "submitting" ? "Subscribing…" : "Subscribe"}
          </button>
        </div>
        <p id={`newsletter-err-${source}`} role="alert" aria-live="polite" className="mt-2 min-h-[1rem] text-xs text-danger">
          {status === "error" ? error : ""}
        </p>
      </form>
    );

  if (variant === "inline") {
    return (
      <div>
        {title && <p className="font-display text-lg font-bold text-foreground">{title}</p>}
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        <div className="mt-3">{form}</div>
      </div>
    );
  }

  return (
    <section className="flex flex-col items-start gap-5 rounded-3xl bg-brand-bubblegum/25 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
      <div className="flex items-center gap-4">
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M3 7l9 6 9-6" />
          </svg>
        </span>
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">{title}</h2>
          <p className="mt-1 max-w-md text-sm text-muted">{description}</p>
        </div>
      </div>
      {form}
    </section>
  );
}
