"use client";

/**
 * Client providers wrapping the whole app.
 * - QueryClientProvider: TanStack Query for all client → /api/* calls (caching,
 *   dedup, abort, loading/error states). One client per request on the server; a
 *   browser singleton on the client (App Router SSR pattern).
 * - I18nProvider: locale for React Aria date/number formatting.
 * - RouterProvider: routes HeroUI/React-Aria navigation through the Next router.
 * Theme (light/dark/system) is handled by HeroUI's `useTheme` + the no-FOUC head
 * script in `layout.tsx` (localStorage key "heroui-theme").
 */

import { I18nProvider, RouterProvider } from "@heroui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { GamifyToaster } from "@/components/gamify/GamifyToaster";

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Directory data is slow-changing; avoid refetch churn on the CWV path.
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient(): QueryClient {
  // Server: always a fresh client so requests never share cache.
  if (typeof window === "undefined") return makeQueryClient();
  // Browser: a singleton so navigations reuse the cache.
  return (browserQueryClient ??= makeQueryClient());
}

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [queryClient] = useState(getQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="en-US">
        <RouterProvider navigate={(href: string) => router.push(href)}>
          <AuthProvider>
            {children}
            <GamifyToaster />
          </AuthProvider>
        </RouterProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
