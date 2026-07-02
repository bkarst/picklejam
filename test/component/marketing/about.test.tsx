// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import AboutPage, { generateMetadata } from "@/app/about/page";
import { brand } from "@/brand.config";

describe("<AboutPage>", () => {
  it("renders the mission + story with a single h1", () => {
    render(<AboutPage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { name: /our story/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /what we care about/i })).toBeInTheDocument();
  });

  it("emits AboutPage + Organization JSON-LD", () => {
    const { container } = render(<AboutPage />);
    const scripts = container.querySelectorAll('script[type="application/ld+json"]');
    const types = Array.from(scripts).flatMap((s) => {
      const parsed = JSON.parse(s.textContent ?? "[]");
      return (Array.isArray(parsed) ? parsed : [parsed]).map((d) => d["@type"]);
    });
    expect(types).toContain("AboutPage");
    expect(types).toContain("Organization");
    expect(types).toContain("BreadcrumbList");
  });

  it("builds indexable metadata pointing at /about", () => {
    const meta = generateMetadata();
    expect(meta.alternates?.canonical).toBe("/about");
    expect(meta.robots).toBeUndefined();
    expect(String(meta.title)).toMatch(new RegExp(brand.identity.name, "i"));
  });

  it("has no axe violations", async () => {
    const { container } = render(<AboutPage />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
