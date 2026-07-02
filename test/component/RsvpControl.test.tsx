// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { renderWithProviders as render } from "@/test/util/render";
import { RsvpControl } from "@/components/outings/RsvpControl";

/**
 * <RsvpControl> — "Are you going?" (§6.7). Covers the open-game happy path, the
 * full → waitlist flip (with and without a waitlist), an existing waitlist RSVP
 * showing its position, and the guest stepper. Rendered signed-out (dev auth) —
 * committing an RSVP is a gated action, but the control still renders its states.
 */
describe("<RsvpControl>", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("pl-auth-mode", "dev");
  });

  it("renders the Going/Maybe/Can't choices on an open game", () => {
    render(<RsvpControl outingId="o1" capacity={8} goingCount={3} />);
    expect(screen.getByRole("heading", { name: "Are you going?" })).toBeInTheDocument();
    expect(screen.getByText("Going")).toBeInTheDocument();
    expect(screen.getByText("Maybe")).toBeInTheDocument();
    expect(screen.getByText("Can't")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "I'm Going!" })).toBeInTheDocument();
  });

  it("offers the waitlist when the game is full", () => {
    render(
      <RsvpControl outingId="o1" capacity={4} goingCount={4} waitlistEnabled waitlistCount={2} />,
    );
    expect(screen.getByRole("button", { name: "Join Waitlist" })).toBeInTheDocument();
    expect(screen.getByText(/full/i)).toBeInTheDocument();
  });

  it("disables joining when full with no waitlist", () => {
    render(<RsvpControl outingId="o1" capacity={4} goingCount={4} waitlistEnabled={false} />);
    expect(screen.getByRole("button", { name: "I'm Going!" })).toBeDisabled();
    expect(screen.getByText(/isn't taking a waitlist/i)).toBeInTheDocument();
  });

  it("shows an existing waitlist position", () => {
    render(
      <RsvpControl
        outingId="o1"
        capacity={4}
        goingCount={4}
        waitlistEnabled
        initialRsvp={{ status: "waitlist", waitlistPos: 3 }}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("You're on the waitlist — #3.");
  });

  it("shows the guest stepper when guests are allowed", () => {
    render(<RsvpControl outingId="o1" capacity={8} goingCount={1} guestPolicy="allowed" />);
    expect(screen.getByRole("button", { name: "More guests" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fewer guests" })).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <RsvpControl outingId="o1" capacity={8} goingCount={3} guestPolicy="allowed" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
