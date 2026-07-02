// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { renderWithProviders as render } from "@/test/util/render";
import { ArticleCard } from "@/components/content/ArticleCard";
import { articlePath } from "@/lib/urls";
import { article } from "./_fixtures";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt } = props as { src: string; alt: string };
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} />;
  },
}));

describe("<ArticleCard>", () => {
  it("links the title to the canonical article path", () => {
    render(<ArticleCard content={article} />);
    const link = screen.getByRole("link", { name: article.title });
    expect(link).toHaveAttribute("href", articlePath(article.category, article.slug));
    expect(articlePath(article.category, article.slug)).toBe(
      "/learn/how-to-play/complete-guide-to-getting-started",
    );
  });

  it("shows the category label, excerpt, byline, and read-time", () => {
    render(<ArticleCard content={article} />);
    expect(screen.getByText("How to Play")).toBeInTheDocument();
    expect(screen.getByText(/step on the court with confidence/i)).toBeInTheDocument();
    expect(screen.getByText("Matt H.")).toBeInTheDocument();
    expect(screen.getByText("8 min read")).toBeInTheDocument();
  });

  it("renders a Featured badge only when flagged", () => {
    const { rerender } = render(<ArticleCard content={article} />);
    expect(screen.queryByText("Featured")).not.toBeInTheDocument();
    rerender(<ArticleCard content={article} featured />);
    expect(screen.getByText("Featured")).toBeInTheDocument();
  });

  it("has no axe violations (grid + row variants)", async () => {
    const grid = render(<ArticleCard content={article} variant="grid" featured />);
    expect(await axe(grid.container)).toHaveNoViolations();
    const row = render(<ArticleCard content={article} variant="row" />);
    expect(await axe(row.container)).toHaveNoViolations();
  });
});
