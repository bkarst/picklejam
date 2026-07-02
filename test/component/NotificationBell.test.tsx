// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { renderWithProviders as render } from "@/test/util/render";
import { NotificationBell } from "@/components/community/NotificationBell";

/**
 * <NotificationBell> — the header notification rail (PRD §9.3). Rendered in DEV
 * auth mode (no Firebase config in tests), so with no dev session the user is
 * signed OUT: the bell renders nothing (signed-in only) and issues no network
 * request (the query is disabled without a user).
 */
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

describe("<NotificationBell>", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("pl-auth-mode", "dev");
  });

  it("renders nothing when signed out", () => {
    const { container } = render(<NotificationBell />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("button", { name: /notifications/i })).not.toBeInTheDocument();
  });

  it("has no axe violations when signed out", async () => {
    const { container } = render(<NotificationBell />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
