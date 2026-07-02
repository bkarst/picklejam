"use client";

/**
 * NewsletterSignup — footer email capture (PRD §6.5/§6.6, Resend).
 * Stage 0: an accessible, optimistic form shell; the Resend subscribe endpoint
 * lands in Stage 9 (Content Hub). Submitting shows immediate feedback.
 */

import { useState } from "react";
import { Button } from "@heroui/react";

export function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "done">("idle");

  return (
    <form
      className="mt-4 max-w-xs"
      onSubmit={(e) => {
        e.preventDefault();
        // TODO(Stage 9): POST to the Resend subscribe route.
        setStatus("done");
      }}
    >
      <label htmlFor="newsletter-email" className="block text-sm font-medium text-foreground">
        Get the pickleball newsletter
      </label>
      {status === "done" ? (
        <p role="status" className="mt-2 text-sm text-success">
          Thanks — you&rsquo;re on the list.
        </p>
      ) : (
        <div className="mt-2 flex gap-2">
          <input
            id="newsletter-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="h-11 min-w-0 flex-1 rounded-full border border-border bg-field px-4 text-sm text-field-foreground placeholder:text-field-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
          <Button type="submit" variant="primary" size="md">
            Join
          </Button>
        </div>
      )}
    </form>
  );
}
