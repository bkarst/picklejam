// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { renderWithProviders as render } from "@/test/util/render";
import { RosterManager } from "@/components/groups/RosterManager";
import { makeMember } from "./_fixtures";

/**
 * <RosterManager> — the owner/admin roster + pending-approval queue (§6.9). Uses
 * providers (the approve/decline mutation reads auth + query). Covers the pending
 * queue with Approve/Decline actions, the active roster (native table), and the
 * empty-pending state. Approve/decline is optimistic — asserting the controls
 * render is enough (no network in jsdom).
 */
describe("<RosterManager>", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("pl-auth-mode", "dev");
  });

  it("lists pending requests with Approve / Decline", () => {
    render(
      <RosterManager
        groupId="g1"
        members={[
          makeMember({ uid: "owner", role: "owner", status: "active", displayName: "Ana O." }),
          makeMember({ uid: "p1", status: "pending", displayName: "Pat Pending" }),
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: /Pending requests \(1\)/ })).toBeInTheDocument();
    expect(screen.getByText("Pat Pending")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument();
  });

  it("renders the active roster in a table", () => {
    render(
      <RosterManager
        groupId="g1"
        members={[makeMember({ uid: "owner", role: "owner", status: "active", displayName: "Ana O." })]}
      />,
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Members (1)" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Ana O." })).toBeInTheDocument();
  });

  it("shows the empty-pending state", () => {
    render(
      <RosterManager
        groupId="g1"
        members={[makeMember({ uid: "owner", role: "owner", status: "active" })]}
      />,
    );
    expect(screen.getByText("No requests waiting for approval.")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <RosterManager
        groupId="g1"
        members={[
          makeMember({ uid: "owner", role: "owner", status: "active", displayName: "Ana O." }),
          makeMember({ uid: "p1", status: "pending", displayName: "Pat Pending" }),
        ]}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
