import "server-only";

/**
 * weather.ts — a 7-day daily forecast for the outing/court "weather chip" (§6.7,
 * §14.6). Uses Open-Meteo (https://open-meteo.com) — a free, keyless forecast API.
 *
 * Design contract (§14.6 degraded-UI): weather is a NICE-TO-HAVE, never a hard
 * dependency. Any failure — a >~4s timeout, a non-2xx response, or an unparseable
 * body — resolves to `null`, and the caller simply HIDES the chip. We never throw,
 * so a flaky forecast provider can't break an outing page. Dependency-free (native
 * `fetch` + `AbortController`); the contract test stubs this module.
 */

/** One day's forecast, normalized from the Open-Meteo `daily` arrays. */
export interface DailyForecast {
  /** ISO date `YYYY-MM-DD` (provider-local day). */
  date: string;
  /** WMO weather-interpretation code (map to an icon in the UI). */
  weatherCode: number;
  /** Daily high, in the requested unit (°F). */
  tempMax: number;
  /** Daily low, in the requested unit (°F). */
  tempMin: number;
  /** Max probability of precipitation for the day (0–100), when available. */
  precipProbability?: number;
}

/** Shape of the slice of the Open-Meteo response we consume. */
interface OpenMeteoDaily {
  time?: unknown;
  weather_code?: unknown;
  temperature_2m_max?: unknown;
  temperature_2m_min?: unknown;
  precipitation_probability_max?: unknown;
}
interface OpenMeteoResponse {
  daily?: OpenMeteoDaily;
}

const REQUEST_TIMEOUT_MS = 4000;
const FORECAST_DAYS = 7;

/** True iff `v` is a finite number. */
function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * A 7-day daily forecast for a coordinate, or `null` on ANY failure (timeout /
 * non-2xx / parse error). Never throws — the caller hides the chip on `null`.
 */
export async function getForecast(lat: number, lng: number): Promise<DailyForecast[] | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${encodeURIComponent(lat)}` +
    `&longitude=${encodeURIComponent(lng)}` +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
    `&forecast_days=${FORECAST_DAYS}` +
    "&temperature_unit=fahrenheit" +
    "&timezone=auto";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const body = (await res.json()) as OpenMeteoResponse;
    return parseForecast(body);
  } catch {
    // AbortError (timeout), network error, or JSON parse error → degrade to null.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Normalize the Open-Meteo `daily` columns into `DailyForecast[]` (null if malformed). */
function parseForecast(body: OpenMeteoResponse): DailyForecast[] | null {
  const daily = body.daily;
  if (!daily) return null;
  const { time, weather_code, temperature_2m_max, temperature_2m_min, precipitation_probability_max } =
    daily;
  if (
    !Array.isArray(time) ||
    !Array.isArray(weather_code) ||
    !Array.isArray(temperature_2m_max) ||
    !Array.isArray(temperature_2m_min)
  ) {
    return null;
  }

  const out: DailyForecast[] = [];
  for (let i = 0; i < time.length; i++) {
    const date = time[i];
    const code = weather_code[i];
    const tMax = temperature_2m_max[i];
    const tMin = temperature_2m_min[i];
    if (typeof date !== "string" || !isFiniteNumber(code) || !isFiniteNumber(tMax) || !isFiniteNumber(tMin)) {
      continue;
    }
    const precip = Array.isArray(precipitation_probability_max)
      ? precipitation_probability_max[i]
      : undefined;
    out.push({
      date,
      weatherCode: code,
      tempMax: tMax,
      tempMin: tMin,
      ...(isFiniteNumber(precip) ? { precipProbability: precip } : {}),
    });
  }
  return out.length > 0 ? out : null;
}
