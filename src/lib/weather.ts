// Weather + climate classification — docs/06-weather-classification.md.
// Ported directly from the spec's working mockups.
export interface WeatherCondition {
  label: string;
  icon: string;
  severity: 0 | 1 | 2 | 3 | 4;
}

export function classifyWeather(code: number, mm: number, windKph: number): WeatherCondition {
  if (code >= 95) return { label: "Stormy", icon: "⛈", severity: 4 };
  if (code >= 61) return mm > 4 ? { label: "Heavy rain", icon: "🌧", severity: 3 } : { label: "Rain", icon: "🌧", severity: 2 };
  if (code >= 51) return { label: "Light rain", icon: "🌦", severity: 1 };
  if (code === 45 || code === 48) return { label: "Foggy", icon: "🌫", severity: 1 };
  if (code === 3) return { label: "Overcast", icon: "☁", severity: 0 };
  if (windKph > 25) return { label: "Windy", icon: "💨", severity: 1 };
  return { label: "Dry", icon: "☀", severity: 0 };
}

// Default indoor climate per mode — refine later if AT exposes vehicle data.
// `null` means "no default guess to apply" (walk/cycle are outdoor, and
// drive is treated as unaffected by outside weather either way) — only
// bus/train/indoor legs actually read this as a JourneyLeg.climate value.
export const CLIMATE_BY_MODE = {
  walk: null,
  cycle: null,
  drive: null,
  hike: null,
  bus: "ac",
  train: "ac",
  indoor: "ac",
} as const;

// docs/05-data-wiring.md §5.3 — forecast reliability drops the further out
// the requested time is; stamped onto WeatherSnapshot.forecastConfidence at
// fetch time.
export function forecastConfidence(departTime: string, fetchedAt: string): "high" | "medium" | "low" {
  const leadHours = (new Date(departTime).getTime() - new Date(fetchedAt).getTime()) / 3_600_000;
  if (leadHours <= 48) return "high";
  if (leadHours <= 120) return "medium";
  return "low";
}
