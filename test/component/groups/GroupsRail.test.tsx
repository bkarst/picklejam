// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { GroupsRail } from "@/components/groups/GroupsRail";
import { makeGroup } from "./_fixtures";

/**
 * <GroupsRail> — the titled grid of public groups (court page "Groups that play
 * here", city cross-links). Presentational. Covers the heading + "see all" link,
 * one card per group, and the self-hide when empty.
 */
describe("<GroupsRail>", () => {
  it("renders a titled grid of group cards with a see-all link", () => {
    render(
      <GroupsRail
        title="Groups that play here"
        groups={[makeGroup(), makeGroup({ groupId: "g2", name: "Sunset Slammers" })]}
        cityLabel="Austin, TX"
        seeAllHref="/groups/in/us/tx/austin"
        seeAllLabel="All groups in Austin"
      />,
    );
    expect(screen.getByRole("heading", { name: "Groups that play here" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "East Austin Dinkers" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sunset Slammers" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "All groups in Austin" })).toHaveAttribute(
      "href",
      "/groups/in/us/tx/austin",
    );
  });

  it("renders nothing when there are no groups", () => {
    const { container } = render(<GroupsRail title="Groups that play here" groups={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <GroupsRail title="Groups that play here" groups={[makeGroup()]} cityLabel="Austin, TX" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
