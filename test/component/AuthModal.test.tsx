// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { axe } from "jest-axe";
import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";

/**
 * AuthModal (via AuthProvider) — the intent-resume auth dialog (UI §13.4).
 * Rendered in DEV mode (localStorage `pl-auth-mode=dev`), so AuthProvider uses
 * its dev auth provider — no Firebase config, no network. A tiny consumer opens
 * the modal via `openAuth("login")`; we assert the tabs + email field and axe.
 */
function OpenTrigger() {
  const { openAuth } = useAuth();
  return (
    <button type="button" onClick={() => openAuth("login")}>
      open-auth
    </button>
  );
}

function renderModal() {
  const utils = render(
    <AuthProvider>
      <OpenTrigger />
    </AuthProvider>,
  );
  fireEvent.click(screen.getByText("open-auth"));
  return utils;
}

describe("<AuthModal> via AuthProvider (dev mode)", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("pl-auth-mode", "dev");
  });

  it("opens with Log in / Sign up tabs and an email field", () => {
    renderModal();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Sign up" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("switches to the Sign up tab, revealing the name field", () => {
    renderModal();
    fireEvent.click(screen.getByRole("tab", { name: "Sign up" }));
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
  });

  it("has no axe violations when open", async () => {
    const { container } = renderModal();
    expect(await axe(container)).toHaveNoViolations();
  });
});

/** Consumer exposing both intent-carrying (`requireAuth`) and bare (`openAuth`) sign-in. */
function IntentTrigger({ intent }: { intent: () => void }) {
  const { requireAuth, openAuth } = useAuth();
  return (
    <>
      <button type="button" onClick={() => requireAuth(intent)}>require-auth</button>
      <button type="button" onClick={() => openAuth("login")}>open-auth</button>
    </>
  );
}

function completeSignIn() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "u@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } });
  fireEvent.click(screen.getByRole("button", { name: "Log in" }));
}

describe("AuthProvider intent resume (H12)", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("pl-auth-mode", "dev");
  });

  it("a FRESH intent resumes on sign-in (positive control)", async () => {
    const intent = vi.fn();
    render(
      <AuthProvider>
        <IntentTrigger intent={intent} />
      </AuthProvider>,
    );
    fireEvent.click(screen.getByText("require-auth"));
    completeSignIn();
    await waitFor(() => expect(intent).toHaveBeenCalledTimes(1));
  });

  it("a DISMISSED intent does NOT fire on a later, unrelated sign-in", async () => {
    const intent = vi.fn();
    render(
      <AuthProvider>
        <IntentTrigger intent={intent} />
      </AuthProvider>,
    );
    // Stash an intent (e.g. "continue to payment"), then dismiss without signing in.
    fireEvent.click(screen.getByText("require-auth"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    // Later: open via the bare header "Sign in" and complete an unrelated sign-in.
    fireEvent.click(screen.getByText("open-auth"));
    completeSignIn();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(intent).not.toHaveBeenCalled();
  });
});
