// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GamifyToaster } from "@/components/gamify/GamifyToaster";
import { publishGamify } from "@/lib/gamify/bus";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("GamifyToaster (§G12.18)", () => {
  it("coalesces all awards from one block into a single toast", () => {
    render(<GamifyToaster />);
    act(() => {
      publishGamify({
        awards: [
          { rule: "E1", points: 10, label: "Check-in at Riverside" },
          { rule: "E3", points: 15, label: "First time at this court" },
        ],
        total: 25,
      });
    });
    // One toast: the total + the FIRST label + "+1 more" (coalesced). The visible
    // "+25 RP" is split across spans by the count-up animation, so assert the
    // contiguous sr-only line the component renders for the same total.
    expect(screen.getByText(/\+25 Rally Points/)).toBeInTheDocument();
    // The coalesced label appears twice by design — visible (aria-hidden) + sr-only.
    expect(screen.getAllByText(/Check-in at Riverside \+1 more/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/First time at this court/)).toBeNull();
  });

  it("shows the cap-honesty toast when capped", () => {
    render(<GamifyToaster />);
    act(() => publishGamify({ awards: [], total: 0, capped: true }));
    expect(screen.getByText(/Daily Rally Point limit reached/)).toBeInTheDocument();
  });

  it("queues the level-up modal, focuses the dismiss button, and closes on Escape", async () => {
    vi.useFakeTimers();
    render(<GamifyToaster />);
    act(() => publishGamify({ awards: [], total: 0, levelUp: { level: 2, name: "Dinker" } }));

    // The modal is queued behind any open dialog — not shown immediately.
    expect(screen.queryByRole("dialog")).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    // celebrate() renders the level as a "Level N" title + "{name}!" subtitle (separate nodes).
    expect(screen.getByText("Level 2")).toBeInTheDocument();
    expect(screen.getByText("Dinker!")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /keep playing/i })).toHaveFocus();

    act(() => fireEvent.keyDown(document, { key: "Escape" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the level-up modal at most once per session", async () => {
    vi.useFakeTimers();
    render(<GamifyToaster />);
    act(() => publishGamify({ awards: [], total: 0, levelUp: { level: 2, name: "Dinker" } }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    act(() => fireEvent.keyDown(document, { key: "Escape" }));
    // A SECOND level-up in the same session ⇒ no modal.
    act(() => publishGamify({ awards: [], total: 0, levelUp: { level: 3, name: "Rally Regular" } }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
