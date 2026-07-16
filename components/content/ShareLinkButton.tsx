/**
 * ShareLinkButton — "Copy link" at the top of a published guide or story, so a
 * reader can grab the canonical URL and share it.
 *
 * Client component. The PAGE passes the canonical absolute `url` (siteUrl +
 * path) rather than reading `location.href`, so what lands on the clipboard is
 * the indexable link — no dev host, no tracking params, no #anchor.
 */

"use client";

import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import { Button } from "@heroui/react";

type Status = "idle" | "copied" | "error";

/** Clipboard API needs a secure context; fall back to a throwaway textarea. */
async function writeToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.cssText = "position:absolute;left:-9999px;top:0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    el.remove();
    return ok;
  } catch {
    return false;
  }
}

const LABEL: Record<Status, string> = {
  idle: "Copy link",
  copied: "Link copied",
  error: "Couldn't copy",
};

export type ShareLinkButtonProps = {
  /** Canonical absolute URL of the article. */
  url: string;
  className?: string;
};

export function ShareLinkButton({ url, className }: ShareLinkButtonProps): JSX.Element {
  const [status, setStatus] = useState<Status>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Don't strand a setState on an unmounted button (fast route changes).
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const onPress = useCallback(async () => {
    const ok = await writeToClipboard(url);
    setStatus(ok ? "copied" : "error");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("idle"), ok ? 2000 : 4000);
  }, [url]);

  const copied = status === "copied";

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onPress={onPress}
        className={`h-11 gap-2 rounded-full px-4 text-sm font-semibold ${copied ? "text-secondary" : ""} ${className ?? ""}`}
      >
        <svg
          viewBox="0 0 24 24"
          className="size-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {copied ? (
            <path d="M20 6L9 17l-5-5" />
          ) : (
            <>
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </>
          )}
        </svg>
        {LABEL[status]}
      </Button>
      {/* Announce the result — the icon/label swap is visual only. */}
      <span role="status" aria-live="polite" className="sr-only">
        {status === "idle" ? "" : LABEL[status]}
      </span>
    </>
  );
}
