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

export interface RainWindow {
  startIso: string;
  endIso: string;
}

// Plan screen's return-trip picker (§4.3.1) — scans hourly readings for the
// nearest contiguous run of med/high rain intensity within `lookAroundHours`
// of a candidate departure time, so the UI can suggest "leave a little
// earlier/later" to dodge a short shower rather than only ever reporting
// the reading at the exact chosen minute. Readings are hourly-resolution
// (Open-Meteo), so this can't resolve a shower narrower than about an hour,
// but it's enough to flag "rain expected 5–6pm" against a 5:30pm pick.
// Returns the single nearest run, not every rain window in range — one
// clear suggestion beats a list the user has to interpret themselves.
//
// Only ever returns a run that's a genuinely *isolated* shower — bounded
// by a dry (or unknown) reading immediately before its start and after its
// end. "Leave before X or after Y" is only correct advice if both sides
// are actually dry; a run that runs off either edge of the supplied
// readings might just be the visible slice of a longer rain spell, where
// shifting either direction still leaves the traveller wet. Callers should
// fetch a little padding beyond `lookAroundHours` on each side so a shower
// sitting right at the edge of the window still has a real dry reading to
// check against, rather than silently failing this test just because the
// data ran out.
export function findRainWindowNear(
  readings: { time: string; rainIntensity: RainIntensity }[],
  targetIso: string,
  lookAroundHours: number
): RainWindow | null {
  const targetMs = new Date(targetIso).getTime();
  const maxDistanceMs = lookAroundHours * 3_600_000;
  const isRainy = (r: RainIntensity) => r === "med" || r === "high";

  let best: (RainWindow & { distanceMs: number }) | null = null;
  let i = 0;
  while (i < readings.length) {
    if (!isRainy(readings[i].rainIntensity)) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < readings.length && isRainy(readings[j + 1].rainIntensity)) j++;

    const hasDryBefore = i > 0 && !isRainy(readings[i - 1].rainIntensity);
    const hasDryAfter = j + 1 < readings.length && !isRainy(readings[j + 1].rainIntensity);

    if (hasDryBefore && hasDryAfter) {
      const startMs = new Date(readings[i].time).getTime();
      const endMs = new Date(readings[j].time).getTime() + 3_600_000; // through the end of that hour
      const distanceMs = targetMs < startMs ? startMs - targetMs : targetMs > endMs ? targetMs - endMs : 0;

      if (distanceMs <= maxDistanceMs && (!best || distanceMs < best.distanceMs)) {
        best = { startIso: readings[i].time, endIso: new Date(endMs).toISOString(), distanceMs };
      }
    }
    i = j + 1;
  }

  return best ? { startIso: best.startIso, endIso: best.endIso } : null;
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

// §9.1 (2026-07-21 "Paua Pop" redesign) — the Today tab's screen tint
// reacts to current conditions: cool when it's cold and wet, the default
// mid palette otherwise, warm when it's genuinely warm and sunny. Read off
// the same apparentTempC/severity the recommendation engine already uses,
// not a new weather field.
export type WeatherMood = "cold" | "mild" | "warm";

export const COLD_MOOD_MAX_C = 8;
export const WARM_MOOD_MIN_C = 22;
// A warm-but-stormy reading should still read as "cold" mood (matches how
// classifyWeather()'s severity already treats heavy rain/storms as the
// dominant signal) — severity 3 (Heavy rain) and 4 (Stormy) both force cold.
const COLD_MOOD_MIN_SEVERITY = 3;
// Warm mood is reserved for genuinely clear/dry conditions — anything at or
// above severity 2 (Rain) stays mild even on a warm day, since "warm and
// sunny" is specifically what the gold/warm tint communicates.
const WARM_MOOD_MAX_SEVERITY = 1;

export function resolveWeatherMood(apparentTempC: number, severity: number): WeatherMood {
  if (apparentTempC <= COLD_MOOD_MAX_C || severity >= COLD_MOOD_MIN_SEVERITY) return "cold";
  if (apparentTempC >= WARM_MOOD_MIN_C && severity <= WARM_MOOD_MAX_SEVERITY) return "warm";
  return "mild";
}
