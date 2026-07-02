import { describe, it, expect, afterEach, vi } from "vitest";

/**
 * ads.txt route (PRD §2.2). `publicEnv` captures the publisher id at module load,
 * so each case stubs the env then re-imports the route fresh.
 */
async function fetchAdsTxt(publisherId: string): Promise<{ res: Response; body: string }> {
  vi.stubEnv("NEXT_PUBLIC_ADSENSE_PUBLISHER_ID", publisherId);
  vi.resetModules();
  const mod = await import("@/app/ads.txt/route");
  const res = mod.GET();
  return { res, body: await res.text() };
}

describe("GET /ads.txt", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("authorizes Google AdSense (pub- form, ca- stripped) when the publisher id is set", async () => {
    const { res, body } = await fetchAdsTxt("ca-pub-1234567890123456");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(body).toBe("google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n");
    expect(body).not.toContain("ca-pub"); // ca- prefix stripped for ads.txt
  });

  it("serves a valid (comment-only) ads.txt when no publisher id is configured", async () => {
    const { res, body } = await fetchAdsTxt("");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(body).not.toContain("google.com");
    expect(body.trimStart().startsWith("#")).toBe(true);
  });
});
