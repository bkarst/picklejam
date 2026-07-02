// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders as render } from "@/test/util/render";
import { CreateClient } from "@/app/round-robin/new/CreateClient";
import { trackEvent } from "@/lib/analytics/client";

/**
 * Client analytics wiring for the no-login create flow (§2.1): on a successful
 * create, <CreateClient> fires `round_robin_created` carrying the anon-organizer
 * `rrCreatorToken` (§2.1 N2). Only the network, router, and analytics client are
 * mocked; `trackEvent` itself is consent-gated (no-op until init) so call sites
 * never guard — here we assert the call is made with the right event + props.
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

vi.mock("@/lib/analytics/client", () => ({ trackEvent: vi.fn() }));

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
  vi.mocked(trackEvent).mockReset();
});

async function addSinglesRoster(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText("Singles"));
  const input = screen.getByLabelText("Add a player");
  for (const name of ["Ana", "Bo", "Cy", "Di"]) {
    await user.type(input, `${name}{Enter}`);
  }
}

describe("<CreateClient> analytics", () => {
  it("fires round_robin_created with the creator token on a successful create", async () => {
    const user = userEvent.setup();
    render(<CreateClient />);
    await addSinglesRoster(user);

    await user.click(screen.getByRole("button", { name: /Generate round robin/ }));

    await waitFor(() => expect(trackEvent).toHaveBeenCalledWith("round_robin_created", expect.anything()));
    const call = vi.mocked(trackEvent).mock.calls.find((c) => c[0] === "round_robin_created");
    expect(call?.[1]).toMatchObject({
      eventId: "ev1",
      rrCreatorToken: "tok1",
      format: "roundRobin",
      entrantCount: 4,
    });
  });
});
