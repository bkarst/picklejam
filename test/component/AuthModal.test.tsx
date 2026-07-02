// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
