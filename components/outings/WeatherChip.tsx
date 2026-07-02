/**
 * WeatherChip — presentational weather summary for an outing (§6.7, design 10.2).
 *
 * Given a forecast it renders the temperature + condition with a matching icon.
 * Given `null`/`undefined` (forecast unavailable, or an indoor court) it renders
 * NOTHING — the caller passes `getForecast(...)` straight through, which returns
 * `null` on failure, so the chip simply disappears rather than showing a broken
 * state.
 */

import type { JSX } from "react";

/** Minimal forecast shape the chip renders (mirrors `lib/weather` getForecast). */
export interface WeatherForecast {
  /** Temperature in Fahrenheit. */
  tempF: number;
  /** Human-readable condition, e.g. "Partly cloudy". */
  condition: string;
}

type IconKind = "sun" | "partly" | "cloud" | "rain" | "snow" | "storm";

function iconFor(condition: string): IconKind {
  const c = condition.toLowerCase();
  if (/(thunder|storm|lightning)/.test(c)) return "storm";
  if (/(snow|sleet|flurr|ice)/.test(c)) return "snow";
  if (/(rain|shower|drizzle)/.test(c)) return "rain";
  if (/(partly|mostly sunny|few clouds)/.test(c)) return "partly";
  if (/(cloud|overcast|fog|haze)/.test(c)) return "cloud";
  return "sun";
}

function WeatherIcon({ kind }: { kind: IconKind }): JSX.Element {
  const stroke = "currentColor";
  const common = {
    fill: "none",
    stroke,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (kind) {
    case "sun":
      return (
        <svg viewBox="0 0 24 24" className="size-7 text-warning" {...common} aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      );
    case "rain":
      return (
        <svg viewBox="0 0 24 24" className="size-7 text-accent" {...common} aria-hidden="true">
          <path d="M17 14a4 4 0 0 0-1-7.87A5 5 0 0 0 7 8a4 4 0 0 0 0 8" />
          <path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2" />
        </svg>
      );
    case "snow":
      return (
        <svg viewBox="0 0 24 24" className="size-7 text-accent" {...common} aria-hidden="true">
          <path d="M17 14a4 4 0 0 0-1-7.87A5 5 0 0 0 7 8a4 4 0 0 0 0 8" />
          <path d="M8 19h.01M12 20h.01M16 19h.01" />
        </svg>
      );
    case "storm":
      return (
        <svg viewBox="0 0 24 24" className="size-7 text-warning" {...common} aria-hidden="true">
          <path d="M17 12a4 4 0 0 0-1-7.87A5 5 0 0 0 7 6a4 4 0 0 0 0 8" />
          <path d="M12 12l-2 4h4l-2 4" />
        </svg>
      );
    case "cloud":
      return (
        <svg viewBox="0 0 24 24" className="size-7 text-muted" {...common} aria-hidden="true">
          <path d="M17 18a4 4 0 0 0-1-7.87A5 5 0 0 0 7 12a4 4 0 0 0 0 8h10a3 3 0 0 0 0-6z" />
        </svg>
      );
    case "partly":
    default:
      return (
        <svg viewBox="0 0 24 24" className="size-7" {...common} aria-hidden="true">
          <circle cx="8" cy="8" r="3" className="text-warning" />
          <path d="M8 2v1M3 8H2M4.3 4.3l-.7-.7M12.3 4.3l.7-.7" className="text-warning" />
          <path d="M17.5 19a3.5 3.5 0 0 0-.9-6.88A4.5 4.5 0 0 0 8 13a3.5 3.5 0 0 0 .5 7h9z" className="text-muted" />
        </svg>
      );
  }
}

export function WeatherChip({
  forecast,
  className = "",
}: {
  forecast: WeatherForecast | null | undefined;
  className?: string;
}): JSX.Element | null {
  if (!forecast) return null;
  return (
    <div
      className={`inline-flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 ${className}`}
    >
      <WeatherIcon kind={iconFor(forecast.condition)} />
      <div className="flex flex-col">
        <span className="font-display text-2xl font-bold leading-none text-foreground">
          {Math.round(forecast.tempF)}°
        </span>
        <span className="mt-1 text-xs text-muted">{forecast.condition}</span>
      </div>
    </div>
  );
}
