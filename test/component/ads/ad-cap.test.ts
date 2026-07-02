import { describe, it, expect, vi } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// eligibility.ts imports usePathname (client hook); stub for this node test.
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
import { MAX_ADS_PER_PAGE } from "@/lib/ads/eligibility";

/**
 * §2.2 "≤3 units/page" cap. Rather than a runtime counter (which can't be both
 * pure and SSR-safe), we statically guarantee the invariant: no source file may
 * place more than MAX_ADS_PER_PAGE <AdSlot/> units. AdSlots are placed directly
 * in page/layout files, so a per-file count is an accurate per-page bound.
 */
function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsxFiles(full));
    else if (full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("ad cap (§2.2 ≤3 units/page)", () => {
  const appDir = path.resolve(import.meta.dirname, "../../../app");

  it("no source file places more than MAX_ADS_PER_PAGE <AdSlot/> units", () => {
    const offenders: Array<{ file: string; count: number }> = [];
    for (const file of tsxFiles(appDir)) {
      const count = (readFileSync(file, "utf8").match(/<AdSlot[\s/>]/g) ?? []).length;
      if (count > MAX_ADS_PER_PAGE) {
        offenders.push({ file: path.relative(appDir, file), count });
      }
    }
    expect(offenders).toEqual([]);
  });
});
