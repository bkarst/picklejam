// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

/**
 * <AuthPage> post-auth redirect — regression for L5: `?next=` was followed via
 * `router.replace(next)` with no same-origin check, so `/login?next=https://evil…` bounced
 * a just-signed-in user off-site (open redirect). The fix sanitizes `next` to a same-origin
 * path.
 */
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams("next=https://evil.com/pwn"),
}));
vi.mock("@/components/auth/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "u1" }, loading: false }),
}));
vi.mock("@/components/auth/AuthForm", () => ({ AuthForm: () => <div data-testid="auth-form" /> }));
vi.mock("@/components/ui/Logo", () => ({ Logo: () => <div /> }));

const { AuthPage } = await import("@/components/auth/AuthPage");

describe("<AuthPage> post-auth redirect (L5)", () => {
  it("bounces a signed-in visitor with an off-site ?next to /account, not off-site", () => {
    render(<AuthPage initialMode="login" />);
    expect(replace).toHaveBeenCalledWith("/account"); // pre-fix: "https://evil.com/pwn"
    expect(replace).not.toHaveBeenCalledWith("https://evil.com/pwn");
  });
});
