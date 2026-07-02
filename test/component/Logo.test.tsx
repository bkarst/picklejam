// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { Logo } from "@/components/ui/Logo";
import { brand } from "@/brand.config";

describe("<Logo>", () => {
  it("renders the brand name as an accessible label", () => {
    render(<Logo />);
    expect(screen.getAllByLabelText(brand.identity.name).length).toBeGreaterThan(0);
  });

  it("has no axe violations in each variant", async () => {
    for (const variant of ["lockup", "wordmark", "mark"] as const) {
      const { container } = render(<Logo variant={variant} />);
      expect(await axe(container)).toHaveNoViolations();
    }
  });
});
