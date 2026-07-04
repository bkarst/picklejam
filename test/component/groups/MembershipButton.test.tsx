// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { renderWithProviders as render } from "@/test/util/render";
import { MembershipButton } from "@/components/groups/MembershipButton";

/**
 * <MembershipButton> — the per-join-policy membership control (§6.9). Rendered
 * signed-out (dev auth): joining is gated, but the control still renders the right
 * state per policy + existing membership. States are text labels (never
 * color-alone). Uses providers because the join/leave hooks read auth + query.
 */
describe("<MembershipButton>", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("pl-auth-mode", "dev");
  });

  it("open policy → Join group", () => {
    render(<MembershipButton groupId="g1" joinPolicy="open" />);
    expect(screen.getByRole("button", { name: "Join group" })).toBeEnabled();
    expect(screen.getByText("Anyone can join instantly.")).toBeInTheDocument();
  });

  it("request policy → Request to join", () => {
    render(<MembershipButton groupId="g1" joinPolicy="request" />);
    expect(screen.getByRole("button", { name: "Request to join" })).toBeInTheDocument();
    expect(screen.getByText(/owner or admin approves/i)).toBeInTheDocument();
  });

  it("invite policy → Invite only (disabled)", () => {
    render(<MembershipButton groupId="g1" joinPolicy="invite" />);
    expect(screen.getByRole("button", { name: "Invite only" })).toBeDisabled();
    expect(screen.getByText(/invite link to join/i)).toBeInTheDocument();
  });

  it("active member → Leave group", () => {
    render(
      <MembershipButton groupId="g1" joinPolicy="open" membership={{ role: "member", status: "active" }} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("You're a member");
    expect(screen.getByRole("button", { name: "Leave group" })).toBeInTheDocument();
  });

  it("owner sees no leave button", () => {
    render(
      <MembershipButton groupId="g1" joinPolicy="open" membership={{ role: "owner", status: "active" }} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Owner");
    expect(screen.queryByRole("button", { name: "Leave group" })).not.toBeInTheDocument();
  });

  it("pending request → Request pending + Cancel", () => {
    render(
      <MembershipButton groupId="g1" joinPolicy="request" membership={{ role: "member", status: "pending" }} />,
    );
    expect(screen.getByText("Request pending approval")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel request" })).toBeInTheDocument();
  });

  it("invited → Accept invitation", () => {
    render(
      <MembershipButton groupId="g1" joinPolicy="invite" membership={{ role: "member", status: "invited" }} />,
    );
    expect(screen.getByRole("button", { name: "Accept invitation" })).toBeInTheDocument();
  });

  it("loading (overlay unresolved) → non-clickable placeholder, never an actionable Join", () => {
    const { container } = render(
      <MembershipButton groupId="g1" joinPolicy="open" membership={null} loading />,
    );
    // No enabled/clickable Join button while membership is unknown (prevents a member
    // from re-POSTing /join before their status resolves).
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it("keyed remount re-seeds membership when the overlay resolves (a member never sticks on Join)", () => {
    // Mirror GroupDetailClient: mount loading with membership=null under key "none"…
    const { rerender } = render(
      <MembershipButton key="none" groupId="g1" joinPolicy="open" membership={null} loading />,
    );
    expect(screen.queryByRole("button", { name: "Join group" })).not.toBeInTheDocument();

    // …then the overlay resolves to an active member → parent remounts under a new key.
    rerender(
      <MembershipButton
        key="member:active"
        groupId="g1"
        joinPolicy="open"
        membership={{ role: "member", status: "active" }}
        loading={false}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("You're a member");
    expect(screen.queryByRole("button", { name: "Join group" })).not.toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(<MembershipButton groupId="g1" joinPolicy="request" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
