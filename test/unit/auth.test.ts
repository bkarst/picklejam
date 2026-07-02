import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encodeDevToken, decodeDevToken, devUid, isDevToken } from "@/lib/auth/dev";
import { verifyToken, verifyRequest, requireAuth, AuthError } from "@/lib/auth/verify";

describe("dev-token codec (§2 auth)", () => {
  it("round-trips a payload", () => {
    const token = encodeDevToken({ uid: "u1", email: "a@b.com", name: "A B" });
    expect(isDevToken(token)).toBe(true);
    expect(decodeDevToken(token)).toEqual({ uid: "u1", email: "a@b.com", name: "A B" });
  });
  it("devUid is deterministic + slug-safe", () => {
    expect(devUid("Ben.Karst@Gmail.com")).toBe(devUid("ben.karst@gmail.com"));
    expect(devUid("a@b.com")).toMatch(/^dev_[a-z0-9_]+$/);
  });
  it("rejects malformed dev tokens", () => {
    expect(decodeDevToken("dev.not-base64!!")).toBeNull();
    expect(decodeDevToken("notdev.abc")).toBeNull();
  });
});

describe("token verification gate (§2)", () => {
  const ORIG = process.env.ALLOW_DEV_AUTH;
  beforeEach(() => {
    process.env.ALLOW_DEV_AUTH = "1"; // non-prod dev auth enabled (APP_ENV=Test under vitest)
  });
  afterEach(() => {
    if (ORIG === undefined) delete process.env.ALLOW_DEV_AUTH;
    else process.env.ALLOW_DEV_AUTH = ORIG;
  });

  it("accepts a dev token when ALLOW_DEV_AUTH=1", async () => {
    const token = encodeDevToken({ uid: "u9", email: "x@y.com" });
    await expect(verifyToken(token)).resolves.toMatchObject({ uid: "u9", email: "x@y.com" });
  });

  it("rejects dev tokens when ALLOW_DEV_AUTH is off", async () => {
    delete process.env.ALLOW_DEV_AUTH;
    const token = encodeDevToken({ uid: "u9", email: "x@y.com" });
    await expect(verifyToken(token)).rejects.toBeInstanceOf(AuthError);
  });

  it("verifyRequest throws AuthError without an Authorization header", async () => {
    await expect(verifyRequest(new Request("http://x/"))).rejects.toBeInstanceOf(AuthError);
  });

  it("verifyRequest reads the Bearer token", async () => {
    const token = encodeDevToken({ uid: "u3", email: "e@e.com" });
    const req = new Request("http://x/", { headers: { Authorization: `Bearer ${token}` } });
    await expect(verifyRequest(req)).resolves.toMatchObject({ uid: "u3" });
  });

  it("requireAuth throws a 401 Response on failure", async () => {
    try {
      await requireAuth(new Request("http://x/"));
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(Response);
      expect((e as Response).status).toBe(401);
    }
  });
});
