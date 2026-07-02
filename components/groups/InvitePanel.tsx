"use client";

/**
 * InvitePanel — generate a shareable invite link for a group (owner/admin, §6.9).
 *
 * Since groups are invite-only by default, this is the primary way to grow one.
 * Clicking "Create invite link" mints a TTL-expiring invite (`useCreateInvite`)
 * and reveals the URL with a one-tap Copy button (immediate feedback, UI §1).
 */

import { useState } from "react";
import type { JSX } from "react";
import { useCreateInvite } from "@/lib/api/groups";

export interface InvitePanelProps {
  groupId: string;
}

export function InvitePanel({ groupId }: InvitePanelProps): JSX.Element {
  const inviteMut = useCreateInvite(groupId);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = () => {
    setError(null);
    setCopied(false);
    inviteMut
      .mutateAsync()
      .then((res) => setUrl(res.url))
      .catch(() => setError("Couldn't create an invite link. Please try again."));
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy — select the link and copy it manually.");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={create}
        disabled={inviteMut.isPending}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
        {inviteMut.isPending ? "Creating…" : url ? "Create a new link" : "Create invite link"}
      </button>

      {url && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3">
          <label htmlFor="invite-url" className="text-xs font-semibold uppercase tracking-wide text-muted">
            Invite link
          </label>
          <div className="flex items-center gap-2">
            <input
              id="invite-url"
              type="text"
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-field px-3 text-sm text-field-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            />
            <button
              type="button"
              onClick={copy}
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-full border border-accent px-4 text-sm font-semibold text-accent transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-muted">Anyone with this link can join. It expires after a while.</p>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}

export default InvitePanel;
