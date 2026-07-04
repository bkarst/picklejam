import { describe, it, expect } from "vitest";
import type { NextRequest } from "next/server";
import { GET } from "@/app/near/route";

/**
 * L16 — `/near` resolves the visitor's nearest city from geo-IP headers and redirects.
 * That result is per-visitor, so the response must forbid shared-cache storage or a CDN
 * keyed on `/near` could pin one visitor's city for everyone else.
 */
describe("GET /near (L16 — per-visitor redirect is not shareable-cacheable)", () => {
  it("marks the geo-IP redirect no-store so a shared cache can't pin one city for all", async () => {
    // No geo headers → falls back to the court hub, but the cache guard must be present regardless.
    const res = await GET(new Request("http://localhost/near") as unknown as NextRequest);

    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400); // a redirect
    const cc = res.headers.get("Cache-Control") ?? "";
    expect(cc).toContain("no-store"); // pre-fix: header absent → shared-cacheable
    expect(res.headers.get("Location")).toContain("/courts");
  });
});
