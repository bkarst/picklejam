"use client";

/**
 * ContactForm — the only client-interactive island on the contact page (§16).
 *
 * Posts `{ name, email, message }` to `POST /api/contact` (best-effort Resend on
 * the server). Follows the UI rules: every action gets an immediate response —
 * the button shows a submitting state, success swaps in a thank-you, and errors
 * surface inline with a retry. Status is announced via an aria-live region, and
 * every field is labeled with a 44px-min tap target.
 */

import type { JSX } from "react";
import { useState } from "react";

type Status = "idle" | "submitting" | "success" | "error";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fieldCls =
  "w-full rounded-2xl border border-border bg-field px-4 py-3 text-field-foreground placeholder:text-field-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60";

export function ContactForm(): JSX.Element {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "submitting") return;

    if (!name.trim()) {
      setStatus("error");
      setError("Please enter your name.");
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setStatus("error");
      setError("Please enter a valid email address.");
      return;
    }
    if (message.trim().length < 10) {
      setStatus("error");
      setError("Please enter a message of at least 10 characters.");
      return;
    }

    setStatus("submitting");
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus("success");
      setName("");
      setEmail("");
      setMessage("");
    } catch {
      setStatus("error");
      setError("Something went wrong. Please try again, or email us directly.");
    }
  }

  if (status === "success") {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-2xl border border-success/40 bg-success/5 p-5"
      >
        <svg viewBox="0 0 24 24" className="mt-0.5 size-6 shrink-0 text-success" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6L9 17l-5-5" />
        </svg>
        <div>
          <p className="font-semibold text-foreground">Thanks — your message is on its way.</p>
          <p className="mt-1 text-sm text-muted">
            We&apos;ll get back to you by email as soon as we can.
          </p>
        </div>
      </div>
    );
  }

  const isSubmitting = status === "submitting";

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact-name" className="text-sm font-medium text-foreground">
          Name
        </label>
        <input
          id="contact-name"
          name="name"
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          placeholder="Your name"
          className={fieldCls}
          disabled={isSubmitting}
          aria-invalid={status === "error" && !name.trim()}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact-email" className="text-sm font-medium text-foreground">
          Email
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          placeholder="you@email.com"
          className={fieldCls}
          disabled={isSubmitting}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact-message" className="text-sm font-medium text-foreground">
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={6}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          placeholder="How can we help?"
          className={`${fieldCls} resize-y`}
          disabled={isSubmitting}
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="submit"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-secondary px-7 text-base font-semibold text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Sending…" : "Send message"}
        </button>
        <p
          id="contact-error"
          role="alert"
          aria-live="polite"
          className="min-h-[1.25rem] text-sm text-danger"
        >
          {status === "error" ? error : ""}
        </p>
      </div>
    </form>
  );
}
