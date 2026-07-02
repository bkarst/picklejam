// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import PricingPage, { generateMetadata } from "@/app/pricing/page";
import { brand } from "@/brand.config";

describe("<PricingPage>", () => {
  it("renders the free vs paid content in crawlable HTML", () => {
    render(<PricingPage />);
    // Exactly one h1.
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 2, name: /always free/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /paid events/i })).toBeInTheDocument();
    // The platform-fee explanation is present in plain language.
    expect(screen.getByRole("heading", { name: /how the platform fee works/i })).toBeInTheDocument();
    // FAQ answers are in the DOM (JS-off) so they match the FAQPage JSON-LD.
    expect(screen.getByText(/you set your own registration price/i)).toBeInTheDocument();
  });

  it("emits Organization + FAQPage JSON-LD", () => {
    const { container } = render(<PricingPage />);
    const scripts = container.querySelectorAll('script[type="application/ld+json"]');
    const types = Array.from(scripts).flatMap((s) => {
      const parsed = JSON.parse(s.textContent ?? "[]");
      return (Array.isArray(parsed) ? parsed : [parsed]).map((d) => d["@type"]);
    });
    expect(types).toContain("Organization");
    expect(types).toContain("FAQPage");
    expect(types).toContain("BreadcrumbList");
  });

  it("builds indexable metadata pointing at /pricing", () => {
    const meta = generateMetadata();
    expect(meta.alternates?.canonical).toBe("/pricing");
    expect(meta.robots).toBeUndefined(); // indexable (no noindex override)
    expect(String(meta.title)).toMatch(/pricing/i);
    expect(String(meta.description)).toMatch(new RegExp(brand.identity.name, "i"));
  });

  it("has no axe violations", async () => {
    const { container } = render(<PricingPage />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
