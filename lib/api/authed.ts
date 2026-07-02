"use client";

/**
 * authed.ts — an authenticated fetch bound to the current session.
 *
 * `useAuthedFetch()` returns a `fetch` wrapper that attaches the Bearer token
 * from `useAuth().getToken()` (a real Firebase ID token, or a dev token in
 * non-prod). All client mutations to authorized route handlers go through it, so
 * `requireAuth(req)` on the server can verify every write (PRD §2).
 */

import { useCallback } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function useAuthedFetch() {
  const { getToken } = useAuth();
  return useCallback(
    async <T>(url: string, init: RequestInit = {}): Promise<T> => {
      const token = await getToken();
      const headers = new Headers(init.headers);
      if (token) headers.set("Authorization", `Bearer ${token}`);
      if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
      const res = await fetch(url, { ...init, headers });
      if (!res.ok) {
        let message = `Request failed (${res.status})`;
        try {
          const body = (await res.json()) as { error?: string };
          if (body?.error) message = body.error;
        } catch {
          /* non-JSON error body */
        }
        throw new ApiError(res.status, message);
      }
      // 204 / empty
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    },
    [getToken],
  );
}
