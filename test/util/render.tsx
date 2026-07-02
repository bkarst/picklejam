import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { AuthProvider } from "@/components/auth/AuthProvider";

/**
 * renderWithProviders — wrap a component under test in the client providers it
 * may rely on (AuthProvider in dev mode — no Firebase config in tests — and a
 * fresh QueryClient with retries off). Use for any component that calls
 * `useAuth()` or a TanStack hook.
 */
export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );
  }
  return render(ui, { wrapper: Wrapper, ...options });
}
