// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { renderWithProviders as render } from "@/test/util/render";
import { CategoryTile } from "@/components/content/CategoryTile";
import { blogCategoryPath } from "@/lib/urls";

describe("<CategoryTile>", () => {
  it("links to the category with its label and count", () => {
    render(<CategoryTile label="Strategy" href={blogCategoryPath("strategy")} count={24} glyph="target" />);
    const link = screen.getByRole("link", { name: /Strategy/ });
    expect(link).toHaveAttribute("href", "/blog/strategy");
    expect(screen.getByText("24")).toBeInTheDocument();
  });

  it("omits the count when not provided", () => {
    render(<CategoryTile label="Gear" href={blogCategoryPath("gear")} glyph="bag" />);
    expect(screen.getByRole("link", { name: /Gear/ })).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <CategoryTile label="How to Play" href={blogCategoryPath("how-to-play")} count={18} glyph="paddle" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
