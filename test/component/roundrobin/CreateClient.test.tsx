// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders as render } from "@/test/util/render";
import { CreateClient } from "@/app/round-robin/new/CreateClient";

/**
 * <CreateClient> — the no-login create flow. The LIVE PREVIEW runs the REAL
 * engine (validateConfig + generateSchedule) in-browser, and submit stores the
 * creator token locally before routing to the run console. Only the network
 * (useCreateRrEvent) and the router are mocked.
 */

const { createSpy, pushSpy } = vi.hoisted(() => ({ createSpy: vi.fn(), pushSpy: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushSpy, back: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/round-robin/new",
}));

vi.mock("@/lib/api/roundrobin", () => ({
  useCreateRrEvent: () => ({ mutateAsync: createSpy, isPending: false }),
}));

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = (q: string) => ({
      matches: false,
      media: q,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    });
  }
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("pl-auth-mode", "dev");
  createSpy.mockReset().mockResolvedValue({ eventId: "ev1", creatorToken: "tok1" });
  pushSpy.mockReset();
});

async function addSinglesRoster(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText("Singles"));
  const input = screen.getByLabelText("Add a player");
  for (const name of ["Ana", "Bo", "Cy", "Di"]) {
    await user.type(input, `${name}{Enter}`);
  }
}

describe("<CreateClient>", () => {
  it("renders the builder with an empty live preview", () => {
    render(<CreateClient />);
    expect(screen.getByRole("heading", { name: "New Round Robin" })).toBeInTheDocument();
    expect(screen.getByText("Live preview")).toBeInTheDocument();
    expect(screen.getByText(/Add at least/)).toBeInTheDocument();
    // No computed stats yet.
    expect(screen.queryByText("Matches")).not.toBeInTheDocument();
  });

  it("recomputes the preview from the real engine as players are added", async () => {
    const user = userEvent.setup();
    render(<CreateClient />);
    await addSinglesRoster(user);

    // The placeholder is replaced by engine-computed stats + Round 1.
    expect(screen.queryByText(/Add at least/)).not.toBeInTheDocument();
    expect(screen.getByText("Matches")).toBeInTheDocument();
    expect(screen.getByText(/Round 1/)).toBeInTheDocument();
  });

  it("creates anonymously, stores the token locally, and routes to the console", async () => {
    const user = userEvent.setup();
    render(<CreateClient />);
    await addSinglesRoster(user);

    await user.click(screen.getByRole("button", { name: /Generate round robin/ }));

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
    const input = createSpy.mock.calls[0][0] as { title: string; config: { format: string; mode: string; entrants: unknown[] } };
    expect(input.config.format).toBe("roundRobin");
    expect(input.config.mode).toBe("singles");
    expect(input.config.entrants).toHaveLength(4);

    await waitFor(() => expect(localStorage.getItem("rr-token-ev1")).toBe("tok1"));
    expect(pushSpy).toHaveBeenCalledWith("/round-robin/ev1/live");
  });
});
