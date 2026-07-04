// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * useFollowCourt invalidation — regression for M20: follow/unfollow only invalidated
 * `["court", id, "following"]` (a key NOTHING queries) and never
 * `accountListKeys.followedCourts`, so the /account/courts "Saved courts" list stayed
 * stale for the 60s global staleTime after following/unfollowing a court on its page.
 */
vi.mock("@/lib/api/authed", () => ({
  useAuthedFetch: () => vi.fn().mockResolvedValue({ following: true }),
}));

const { useFollowCourt } = await import("@/lib/api/community");
const { accountListKeys } = await import("@/lib/api/account-lists");

describe("useFollowCourt invalidation (M20)", () => {
  it("invalidates the account 'followed courts' list on success", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const spy = vi.spyOn(qc, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useFollowCourt("court-1"), { wrapper });
    await result.current.mutateAsync(true);

    await waitFor(() => {
      const invalidated = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
      // Pre-fix this key was never invalidated → the saved-courts list didn't refresh.
      expect(invalidated).toContain(JSON.stringify(accountListKeys.followedCourts));
    });
  });
});
