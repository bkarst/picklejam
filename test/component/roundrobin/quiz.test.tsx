// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { recommendFormat, QuizClient } from "@/app/round-robin/quiz/QuizClient";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
}));

describe("recommendFormat", () => {
  it("recommends a mixer for social play", () => {
    expect(recommendFormat({ goal: "social" })).toBe("mixer");
  });
  it("recommends pools → bracket to crown a champion", () => {
    expect(recommendFormat({ goal: "champion" })).toBe("poolsBracket");
  });
  it("recommends movement for fast competitive play", () => {
    expect(recommendFormat({ goal: "competitive", pace: "fast" })).toBe("movement");
  });
  it("recommends Swiss for a big competitive group", () => {
    expect(recommendFormat({ goal: "competitive", pace: "chill", players: "large" })).toBe("swiss");
  });
  it("recommends a plain round robin for a small competitive group", () => {
    expect(recommendFormat({ goal: "competitive", pace: "chill", players: "small" })).toBe("roundRobin");
  });
});

describe("<QuizClient>", () => {
  it("walks through the questions and shows a recommendation", async () => {
    const user = userEvent.setup();
    render(<QuizClient />);
    expect(screen.getByRole("heading", { name: /How many are playing/ })).toBeInTheDocument();

    await user.click(screen.getByText("8–12 players")); // players
    await user.click(screen.getByText("Doubles")); // mode
    await user.click(screen.getByText("Social")); // goal
    await user.click(screen.getByText("Relaxed")); // pace → done

    expect(await screen.findByText(/We recommend/)).toBeInTheDocument();
    // "Popcorn Mixer" appears in both the heading and the result card.
    expect(screen.getAllByText(/Popcorn Mixer/).length).toBeGreaterThan(0);
  });
});
