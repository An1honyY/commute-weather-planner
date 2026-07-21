// Weather + climate classification — docs/06-weather-classification.md.
// Ported directly from the spec's working mockups.
import type { Journey, WarmthCalibration } from "../types";

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

export type RainIntensity = "none" | "low" | "med" | "high";

// §6, §9.5 — the hourly rain-intensity gauge's bucket, distinct from
// classifyWeather()'s severity: gated on precipProbability first (a 90%
// chance of a light shower reads differently from a 10% chance of the
// same amount), then precipMm within that.
export function rainIntensityBucket(precipMm: number, precipProbabilityPct: number): RainIntensity {
  if (precipProbabilityPct < 20) return "none";
  if (precipMm < 0.5) return "low";
  if (precipMm <= 4) return "med";
  return "high";
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

// §6.1 — Auckland is Southern Hemisphere, so seasons are shifted relative
// to the Intl/calendar defaults an agent might assume. Derived from the
// journey's departTime, not device locale.
export type Season = "summer" | "winter" | "shoulder";

const SUMMER_MONTHS = [12, 1, 2];
const WINTER_MONTHS = [6, 7, 8];

export function getSeason(isoDateTime: string): Season {
  const month = new Date(isoDateTime).getMonth() + 1;
  if (SUMMER_MONTHS.includes(month)) return "summer";
  if (WINTER_MONTHS.includes(month)) return "winter";
  return "shoulder";
}

// §6.1 — AC on buses/trains is only a cold-contrast factor in summer
// (actively refrigerating against a hot exterior); winter AC is typically
// idle/ambient, treated as neutral for layering purposes.
export function acFeelsCold(journey: Journey, season: Season, hasWarmOutdoor: boolean): boolean {
  const hasIndoorAC = journey.legs.some((l) => l.climate === "ac");
  return hasIndoorAC && season === "summer" && hasWarmOutdoor;
}

// §7.5.1 — what recommendGear() actually reads: prefer the current
// season's own offset once it has at least one sample, otherwise fall back
// to the global offsetLevels so a brand-new user (or a season with no
// feedback yet) still gets a sensible value instead of 0-with-no-history.
export function resolveWarmthOffset(calibration: WarmthCalibration, season: Season): number {
  const seasonalCount = calibration.seasonalSampleCounts?.[season] ?? 0;
  if (seasonalCount > 0 && calibration.seasonalOffsets) {
    return calibration.seasonalOffsets[season];
  }
  return calibration.offsetLevels;
}
