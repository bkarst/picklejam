import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { palette } from "@/brand.config";

/**
 * Drift guard (PRD §2.3): the Tailwind/HeroUI theme in globals.css MUST mirror the
 * brand.config palette. CSS can't import TS, so this asserts they stay in sync.
 */
describe("brand.config ↔ globals.css sync (§2.3)", () => {
  const css = readFileSync(
    path.resolve(import.meta.dirname, "../../app/globals.css"),
    "utf8",
  ).toLowerCase();

  it("every brand swatch appears in the theme CSS", () => {
    for (const [name, hex] of Object.entries(palette)) {
      expect(css, `palette.${name} (${hex}) missing from globals.css`).toContain(
        hex.toLowerCase(),
      );
    }
  });
});
