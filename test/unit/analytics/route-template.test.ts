import { describe, it, expect } from "vitest";
import { pathTemplate } from "@/lib/analytics/route-template";

describe("pathTemplate — page_view cardinality guard (§2.1)", () => {
  it("collapses dynamic segments to the route pattern", () => {
    expect(pathTemplate("/courts/us/kansas/lawrence/rock-chalk-park")).toBe(
      "/courts/[country]/[state]/[city]/[court]",
    );
    expect(pathTemplate("/courts/us/kansas/lawrence")).toBe("/courts/[country]/[state]/[city]");
    expect(pathTemplate("/tournaments/abc123")).toBe("/tournaments/[id]");
    expect(pathTemplate("/tournaments/abc123/register")).toBe("/tournaments/[id]/register");
    expect(pathTemplate("/groups/xyz")).toBe("/groups/[id]");
    expect(pathTemplate("/news/how-to-dink")).toBe("/news/[slug]");
    expect(pathTemplate("/round-robin/r1/live")).toBe("/round-robin/[id]/live");
  });

  it("keeps static routes verbatim and matches by depth", () => {
    expect(pathTemplate("/")).toBe("/");
    expect(pathTemplate("/pricing")).toBe("/pricing");
    expect(pathTemplate("/account/payments")).toBe("/account/payments");
    // Same prefix, different depth must not collide.
    expect(pathTemplate("/courts/us")).toBe("/courts/[country]");
    expect(pathTemplate("/courts")).toBe("/courts");
  });

  it("strips query/hash and a trailing slash before matching", () => {
    expect(pathTemplate("/tournaments/abc123/?ref=x")).toBe("/tournaments/[id]");
    expect(pathTemplate("/groups/xyz#roster")).toBe("/groups/[id]");
  });

  it("falls back to the concrete path when nothing matches", () => {
    expect(pathTemplate("/nope/unknown/deep")).toBe("/nope/unknown/deep");
  });
});
