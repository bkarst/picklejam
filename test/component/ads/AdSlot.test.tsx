// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { AdSlot } from "@/components/ads/AdSlot";
import { ConsentProvider } from "@/components/consent/ConsentProvider";
import { AdsFlagProvider } from "@/components/ads/AdsFlagProvider";

// AdSlot reads the current path (via useAdsAllowed) to apply the §2.2 boundary.
const nav = vi.hoisted(() => ({ path: "/courts/us/kansas/lawrence" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.path }));

// The remote `ads_enabled` flag gates every AdSlot; enable it (default is off) so
// eligibility/consent — not the master switch — is what these tests exercise.
function renderSlot(ui: React.ReactNode) {
  return render(
    <AdsFlagProvider value={true}>
      <ConsentProvider>{ui}</ConsentProvider>
    </AdsFlagProvider>,
  );
}

describe("<AdSlot>", () => {
  beforeEach(() => {
    nav.path = "/courts/us/kansas/lawrence"; // eligible by default
    localStorage.clear();
  });

  it("shows the house-ad fallback (no publisher, no consent) in a reserved box — no real ad", () => {
    const { container, getByRole } = renderSlot(<AdSlot kind="in-feed" />);
    // House ad renders in the reserved box (never collapses → no CLS).
    const box = getByRole("complementary");
    expect(box).toHaveStyle({ minHeight: "280px" });
    expect(box.textContent).toContain("Run a free round robin");
    expect(box.querySelector("a")).toHaveAttribute("href", "/round-robin/new");
    // No real ad + it is NOT labelled "Advertisement" (first-party promo).
    expect(container.querySelector("ins.adsbygoogle")).toBeNull();
    expect(container.querySelector('[aria-label="Advertisement"]')).toBeNull();
  });

  it("reserves the correct height per kind (CLS ≈ 0)", () => {
    const { getByRole } = renderSlot(<AdSlot kind="footer" />);
    expect(getByRole("complementary")).toHaveStyle({ minHeight: "120px" });
  });

  it("renders NOTHING on an ad-ineligible route (checkout) — not even reserved space", () => {
    nav.path = "/tournaments/abc-open/register";
    const { container } = renderSlot(<AdSlot kind="in-feed" />);
    expect(container.querySelector("aside")).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("renders NOTHING on the homepage and account routes", () => {
    for (const path of ["/", "/account/settings", "/organize"]) {
      nav.path = path;
      const { container } = renderSlot(<AdSlot kind="in-feed" />);
      expect(container.querySelector("aside")).toBeNull();
    }
  });

  it("has no axe violations (house-ad state)", async () => {
    const { container } = renderSlot(<AdSlot kind="in-feed" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
