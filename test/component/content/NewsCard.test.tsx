// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { renderWithProviders as render } from "@/test/util/render";
import { NewsCard } from "@/components/content/NewsCard";
import { newsArticlePath } from "@/lib/urls";
import { news } from "./_fixtures";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt } = props as { src: string; alt: string };
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} />;
  },
}));

describe("<NewsCard>", () => {
  it("links the title to the news article path", () => {
    render(<NewsCard news={news} />);
    const link = screen.getByRole("link", { name: news.title });
    expect(link).toHaveAttribute("href", newsArticlePath(news.slug));
    expect(newsArticlePath(news.slug)).toBe("/news/ben-johns-wins-ppa-texas-open");
  });

  it("shows the topic chip, source, and a machine-readable timestamp", () => {
    const { container } = render(<NewsCard news={news} />);
    expect(screen.getByText("Pro Tour")).toBeInTheDocument();
    expect(screen.getByText("Pickleball Central")).toBeInTheDocument();
    const time = container.querySelector("time");
    expect(time).toHaveAttribute("dateTime", news.publishedAt);
  });

  it("renders a compact (image-less) variant for the recent-stories rail", () => {
    const { container } = render(<NewsCard news={news} variant="compact" />);
    expect(screen.getByRole("link", { name: news.title })).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("has no axe violations (grid, row, compact)", async () => {
    for (const variant of ["grid", "row", "compact"] as const) {
      const { container } = render(<NewsCard news={news} variant={variant} featured={variant === "row"} />);
      expect(await axe(container)).toHaveNoViolations();
    }
  });
});
