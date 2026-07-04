import { describe, it, expect, vi, afterEach } from "vitest";
import { getForecast } from "@/lib/weather";

/**
 * L17 — the outing page picks the forecast day that matches the game's date, computed in
 * `outing.tz`. Open-Meteo buckets `daily.time[]` in the zone named by its `timezone` param,
 * so `getForecast` must request that same zone or the `date === dayStr` match misses and the
 * page shows the wrong day. It must also opt the fetch into the ISR data cache explicitly
 * (this Next does not cache `fetch` by default).
 */
const OPEN_METEO_BODY = {
  daily: {
    time: ["2099-06-15", "2099-06-16"],
    weather_code: [1, 3],
    temperature_2m_max: [81, 79],
    temperature_2m_min: [61, 60],
    precipitation_probability_max: [10, 20],
  },
};

function stubFetch(): { calls: Array<{ url: string; init?: RequestInit }> } {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return { ok: true, json: async () => OPEN_METEO_BODY } as unknown as Response;
    }),
  );
  return { calls };
}

afterEach(() => vi.unstubAllGlobals());

describe("getForecast (L17 — timezone alignment + explicit ISR cache)", () => {
  it("requests the CALLER's timezone so the provider's day buckets match dayStr", async () => {
    const { calls } = stubFetch();
    const out = await getForecast(41.88, -87.63, { tz: "America/Chicago" });

    expect(calls).toHaveLength(1);
    // Pre-fix `getForecast` ignored the tz and always sent `timezone=auto`.
    expect(calls[0].url).toContain("timezone=America%2FChicago");
    expect(calls[0].url).not.toContain("timezone=auto");
    // Sanity: the body parses into the normalized shape, keyed by provider-local day.
    expect(out?.map((d) => d.date)).toEqual(["2099-06-15", "2099-06-16"]);
  });

  it("opts the forecast fetch into the ISR data cache (revalidate), not a bare uncached call", async () => {
    const { calls } = stubFetch();
    await getForecast(41.88, -87.63, { tz: "America/Chicago" });

    const nextOpt = (calls[0].init as { next?: { revalidate?: number } } | undefined)?.next;
    expect(nextOpt?.revalidate).toBeGreaterThan(0); // pre-fix: no `next` option at all
  });

  it("falls back to timezone=auto when no tz is supplied (unchanged legacy behavior)", async () => {
    const { calls } = stubFetch();
    await getForecast(41.88, -87.63);
    expect(calls[0].url).toContain("timezone=auto");
  });
});
