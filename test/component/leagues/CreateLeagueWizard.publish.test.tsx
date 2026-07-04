// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ReactNode } from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders as render } from "@/test/util/render";

/**
 * <CreateLeagueWizard> publish retry — regression for M21: `publish()` held the created
 * `lid` in a LOCAL variable, so a mid-flow failure (a division POST) discarded it and the
 * next Publish click recreated the draft from scratch, orphaning the partial one. The fix
 * remembers the created id + division progress and RESUMES on retry. This drives a first
 * attempt that fails on the division POST, then a retry, and asserts the draft is created
 * exactly ONCE.
 */
const H = vi.hoisted(() => {
  const createLeagueSpy = vi.fn().mockResolvedValue({ lid: "l1" });
  const pushSpy = vi.fn();
  let divisionCalls = 0;
  const authedSpy = vi.fn((url: string) => {
    if (typeof url === "string" && url.includes("/divisions")) {
      divisionCalls += 1;
      return divisionCalls === 1
        ? Promise.reject(new Error("Division create failed"))
        : Promise.resolve({});
    }
    return Promise.resolve({}); // publish
  });
  return { createLeagueSpy, pushSpy, authedSpy };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: H.pushSpy, replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/leagues/new",
}));
vi.mock("@/lib/api/leagues", () => ({
  useCreateLeague: () => ({ mutateAsync: H.createLeagueSpy, isPending: false }),
}));
vi.mock("@/lib/api/ladders", () => ({
  useCreateLadder: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/lib/api/authed", () => ({ useAuthedFetch: () => H.authedSpy }));
vi.mock("@/lib/api/connect", () => ({
  useConnectStatus: () => ({ data: { status: "complete" }, isLoading: false }),
  useStartConnect: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
  connectIsComplete: () => true,
}));
vi.mock("@/components/tournaments/ConnectGate", () => ({
  ConnectGate: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/leagues/CityPicker", () => ({
  CityPicker: ({ onSelect }: { onSelect: (c: unknown) => void }) => (
    <button
      type="button"
      aria-label="pick-city"
      onClick={() => onSelect({ cityKey: "us#ks#lawrence", city: "Lawrence", state: "KS", country: "us", label: "Lawrence, KS" })}
    >
      pick-city
    </button>
  ),
}));

const { CreateLeagueWizard } = await import("@/components/leagues/CreateLeagueWizard");

describe("<CreateLeagueWizard> publish retry (M21)", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("pl-auth-mode", "dev");
    H.createLeagueSpy.mockClear();
    H.pushSpy.mockClear();
  });

  it("a retry after a mid-flow failure REUSES the draft (no duplicate league)", async () => {
    const { container } = render(<CreateLeagueWizard />);

    // Step 0 (Format) → 1 (Details).
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    fireEvent.change(screen.getByPlaceholderText("e.g. Wednesday Night 3.5 Doubles"), {
      target: { value: "Wed Night 3.5" },
    });
    fireEvent.change(container.querySelector('input[type="date"]')!, { target: { value: "2099-07-08" } });
    fireEvent.change(screen.getByPlaceholderText("e.g. A Division"), { target: { value: "A Division" } });
    fireEvent.change(screen.getByPlaceholderText("80.00"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "pick-city" }));

    // Step 1 → 2 (Review).
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    // First publish: draft created, then the division POST fails → error surfaces.
    fireEvent.click(screen.getByRole("button", { name: "Publish league" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Division create failed");
    expect(H.createLeagueSpy).toHaveBeenCalledTimes(1);

    // Retry: must REUSE the existing draft (createLeague NOT called again) and succeed.
    fireEvent.click(screen.getByRole("button", { name: "Publish league" }));
    await waitFor(() => expect(H.pushSpy).toHaveBeenCalled());
    expect(H.createLeagueSpy).toHaveBeenCalledTimes(1); // pre-fix: 2 → a second orphan draft
  });
});
