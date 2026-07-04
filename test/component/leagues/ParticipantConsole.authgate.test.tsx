// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { screen } from "@testing-library/react";
import { renderWithProviders as render } from "@/test/util/render";

/**
 * L20 — the console gated on `if (!user)` and ignored `useAuth().loading`. With real Firebase
 * `user` is null for the first few hundred ms, so a signed-in member briefly saw the clickable
 * "Sign in to view your team" gate. The fix shows the loading skeleton while auth resolves and
 * only falls to the sign-in gate once auth has settled with no user.
 */
let authState: { user: { uid: string } | null; loading: boolean };
const requireAuth = vi.fn();

vi.mock("@/components/auth/AuthProvider", () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({ ...authState, requireAuth }),
}));

vi.mock("@/lib/api/leagues", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/leagues")>()),
  useLeague: () => ({ data: undefined, isLoading: false }),
}));

const { ParticipantConsole } = await import("@/components/leagues/ParticipantConsole");

describe("<ParticipantConsole> auth-loading gate (L20)", () => {
  beforeEach(() => requireAuth.mockClear());

  it("does NOT flash the Sign in gate while auth is still resolving", () => {
    authState = { user: null, loading: true };
    render(<ParticipantConsole lid="l1" />);
    // Pre-fix: the clickable "Sign in" gate rendered here (a signed-in member's flash).
    expect(screen.queryByText(/Sign in to view your team/i)).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
  });

  it("shows the Sign in gate once auth has resolved with no user", () => {
    authState = { user: null, loading: false };
    render(<ParticipantConsole lid="l1" />);
    expect(screen.getByText(/Sign in to view your team/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });
});
