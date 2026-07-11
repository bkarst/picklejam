// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// Eligible route + no-op Script/Link so the tree renders without a Next router.
vi.mock("next/navigation", () => ({ usePathname: () => "/courts/us/kansas/lawrence" }));
vi.mock("next/script", () => ({ default: () => null }));

/**
 * The real-ad path depends on `NEXT_PUBLIC_ADSENSE_PUBLISHER_ID`, which
 * brand.config captures at module load — so we stub the env then re-import the
 * component graph fresh (AdSlot + ConsentProvider from the SAME reset graph, so
 * their context matches).
 */
describe("<AdSlot> — real ad (publisher configured)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_PUBLISHER_ID", "ca-pub-1234567890123456");
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    delete (window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle;
  });

  it("renders a real adsbygoogle unit and queues it once consent is granted", async () => {
    localStorage.setItem(
      "pl-consent",
      JSON.stringify({ analytics: true, ads: true, decided: true }),
    );
    const pushed: unknown[] = [];
    (window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle = pushed;

    const { AdSlot } = await import("@/components/ads/AdSlot");
    const { ConsentProvider } = await import("@/components/consent/ConsentProvider");
    const { AdsFlagProvider } = await import("@/components/ads/AdsFlagProvider");

    render(
      <AdsFlagProvider value={true}>
        <ConsentProvider>
          <AdSlot kind="in-feed" slot="1234567890" />
        </ConsentProvider>
      </AdsFlagProvider>,
    );

    const box = await screen.findByRole("complementary", { name: "Advertisement" });
    const ins = box.querySelector("ins.adsbygoogle");
    expect(ins).not.toBeNull();
    expect(ins).toHaveAttribute("data-ad-client", "ca-pub-1234567890123456");
    expect(ins).toHaveAttribute("data-ad-slot", "1234567890");
    // Queued exactly once (StrictMode-safe push).
    await waitFor(() => expect(pushed).toHaveLength(1));
  });

  it("still shows the house ad when publisher is set but consent is NOT granted", async () => {
    const { AdSlot } = await import("@/components/ads/AdSlot");
    const { ConsentProvider } = await import("@/components/consent/ConsentProvider");
    const { AdsFlagProvider } = await import("@/components/ads/AdsFlagProvider");

    const { container } = render(
      <AdsFlagProvider value={true}>
        <ConsentProvider>
          <AdSlot kind="in-feed" />
        </ConsentProvider>
      </AdsFlagProvider>,
    );

    expect(container.querySelector("ins.adsbygoogle")).toBeNull();
    expect(container.textContent).toContain("Run a free round robin");
  });
});
