// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { AdSlot } from "@/components/ads/AdSlot";
import { ConsentProvider } from "@/components/consent/ConsentProvider";

// AdSlot reads the current path to apply the §2.2 ad-eligibility boundary.
vi.mock("next/navigation", () => ({ usePathname: () => "/courts/us/kansas/lawrence" }));

describe("<AdSlot>", () => {
  it("is suppressed by default (ads disabled until Stage 10) — renders nothing", () => {
    const { container } = render(
      <ConsentProvider>
        <AdSlot kind="in-feed" />
      </ConsentProvider>,
    );
    // brand.ads.enabled === false → AdSlot returns null even on an eligible route.
    expect(container.querySelector('[aria-label="Advertisement"]')).toBeNull();
  });
});
