import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { palette } from "@/brand.config";

/**
 * §2.3 hard requirement: a hardcoded brand color anywhere outside the config is a
 * BUG. This is the enforcement (a build-fail check) — it scans source for brand
 * hex literals; the only allowed homes are brand.config.ts (the source) and
 * app/globals.css (the theme mirror, itself guarded by brand-theme-sync).
 */
const ROOT = path.resolve(import.meta.dirname, "../..");
const SCAN_DIRS = ["app", "components", "lib"];
const ALLOW = new Set([path.join(ROOT, "brand.config.ts")]);
const brandHexes = Object.values(palette).map((h) => h.toLowerCase());

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|css)$/.test(name)) out.push(full);
  }
  return out;
}

describe("no hardcoded brand values (§2.3)", () => {
  it("no brand hex literal appears outside brand.config.ts / globals.css", () => {
    const offenders: string[] = [];
    for (const d of SCAN_DIRS) {
      for (const file of walk(path.join(ROOT, d))) {
        if (ALLOW.has(file) || file.endsWith(path.join("app", "globals.css"))) continue;
        const text = readFileSync(file, "utf8").toLowerCase();
        for (const hex of brandHexes) {
          if (text.includes(hex)) offenders.push(`${path.relative(ROOT, file)} → ${hex}`);
        }
      }
    }
    expect(offenders, `Hardcoded brand hex found:\n${offenders.join("\n")}`).toEqual([]);
  });
});
