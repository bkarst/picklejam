// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { GroupCard } from "@/components/groups/GroupCard";

/**
 * <GroupCard> — the group finder / rail / "my groups" row. Presentational (a link
 * card), so it renders without providers. Covers the visibility badge (text label,
 * not color-alone), member count, place line, and the optional membership pill.
 */
describe("<GroupCard>", () => {
  it("renders name, member count, and a public visibility label", () => {
    render(
      <GroupCard
        href="/groups/g1"
        name="East Austin Dinkers"
        visibility="public"
        memberCount={12}
        cityLabel="Austin, TX"
        homeCourtName="Zilker Park"
      />,
    );
    expect(screen.getByRole("heading", { name: "East Austin Dinkers" })).toBeInTheDocument();
    expect(screen.getByText("Public")).toBeInTheDocument();
    expect(screen.getByText("12 members")).toBeInTheDocument();
    expect(screen.getByText("Zilker Park · Austin, TX")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/groups/g1");
  });

  it("shows a Private label (not color-alone) and a membership pill", () => {
    render(
      <GroupCard
        href="/groups/g2"
        name="Crew"
        visibility="private"
        memberCount={1}
        membershipLabel="Owner"
      />,
    );
    expect(screen.getByText("Private")).toBeInTheDocument();
    expect(screen.getByText("1 member")).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <GroupCard href="/groups/g1" name="Dinkers" visibility="public" memberCount={5} cityLabel="Austin, TX" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
