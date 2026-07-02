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

  it("has no axe violations", async () => {
    const { container } = render(<MembershipButton groupId="g1" joinPolicy="request" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
