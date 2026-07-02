// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { MemberStatusList } from "@/components/groups/MemberStatusList";
import { makeMember } from "./_fixtures";

/**
 * <MemberStatusList> — group members with their live play status (§6.9). The
 * presence flags are visibility-respected server-side, so the component renders
 * them verbatim. Each status carries a text label (never color-alone).
 */
describe("<MemberStatusList>", () => {
  it("renders presence chips and a role badge", () => {
    render(
      <MemberStatusList
        members={[
          makeMember({ uid: "o", role: "owner", displayName: "Ana O.", checkedInToday: true }),
          makeMember({ uid: "m", displayName: "Bo M.", lookingToPlay: true }),
        ]}
      />,
    );
    expect(screen.getByText("Ana O.")).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.getByText("Checked in today")).toBeInTheDocument();
    expect(screen.getByText("Looking to play")).toBeInTheDocument();
  });

  it("only counts active members and shows an overflow summary", () => {
    render(
      <MemberStatusList
        limit={1}
        members={[
          makeMember({ uid: "a", displayName: "A" }),
          makeMember({ uid: "b", displayName: "B" }),
          makeMember({ uid: "p", status: "pending", displayName: "Pending Pete" }),
        ]}
      />,
    );
    // Pending members are excluded; 2 active, limit 1 → "+1 more member".
    expect(screen.queryByText("Pending Pete")).not.toBeInTheDocument();
    expect(screen.getByText("+1 more member")).toBeInTheDocument();
  });

  it("shows an empty state when there are no active members", () => {
    render(<MemberStatusList members={[makeMember({ status: "pending" })]} />);
    expect(screen.getByText("No active members yet.")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <MemberStatusList members={[makeMember({ checkedInToday: true, lookingToPlay: true })]} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
