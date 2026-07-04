// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { renderWithProviders as render } from "@/test/util/render";
import { ChallengeRow } from "@/components/ladders/ChallengeRow";
import { makeChallenge } from "./_fixtures";

/**
 * <ChallengeRow> — one challenge through its lifecycle (§7.4). Uses TanStack, so it
 * renders with providers. Covers the challenged-player accept/decline state and the
 * confirm state when the opponent has reported. We don't submit (that hits /api).
 */
const nameFor = (uid: string) => (uid === "u1" ? "Ana" : uid === "u3" ? "Cy" : uid);

describe("<ChallengeRow>", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("pl-auth-mode", "dev");
  });

  it("offers accept/decline to the challenged player on an open challenge", () => {
    render(
      <ChallengeRow lid="lad1" challenge={makeChallenge({ status: "open" })} myUid="u1" nameFor={nameFor} />,
    );
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument();
    // Response-window countdown is shown.
    expect(screen.getByText(/to respond/)).toBeInTheDocument();
  });

  it("offers confirm when the opponent has reported the result", () => {
    render(
      <ChallengeRow
        lid="lad1"
        challenge={makeChallenge({ status: "reported", reportedBy: "u3", scoreChallenger: 11, scoreChallenged: 7 })}
        myUid="u1"
        nameFor={nameFor}
      />,
    );
    expect(screen.getByRole("button", { name: "Confirm result" })).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <ChallengeRow lid="lad1" challenge={makeChallenge({ status: "open" })} myUid="u1" nameFor={nameFor} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("L21: resyncs status when the server challenge changes underneath a mounted row", () => {
    // Same instance survives a refetch (stable cid). Start with the opponent's reported result.
    const { rerender } = render(
      <ChallengeRow
        lid="lad1"
        challenge={makeChallenge({ status: "reported", reportedBy: "u3", scoreChallenger: 11, scoreChallenged: 7 })}
        myUid="u1"
        nameFor={nameFor}
      />,
    );
    expect(screen.getByRole("button", { name: "Confirm result" })).toBeInTheDocument();

    // A refetch delivers the confirmed challenge (e.g. confirmed on another device). Pre-fix the
    // row kept its mount-time "reported" status → the stale "Confirm result" button lingered.
    rerender(
      <ChallengeRow
        lid="lad1"
        challenge={makeChallenge({ status: "confirmed", reportedBy: "u3", scoreChallenger: 11, scoreChallenged: 7, winnerUid: "u3" })}
        myUid="u1"
        nameFor={nameFor}
      />,
    );
    expect(screen.queryByRole("button", { name: "Confirm result" })).toBeNull();
    expect(screen.getByText(/board updated/i)).toBeInTheDocument();
  });
});
