// Open-Meteo (api.open-meteo.com/v1/forecast) — docs/02-external-apis.md §2.
// Free, keyless. Requests apparent_temperature, wind_gusts_10m,
// relative_humidity_2m, uv_index, is_day per §2/§6.2, plus `past_days=1`
// for recentPrecipMm6h (docs/05-data-wiring.md §5.5, Phase 6).
import { forecastConfidence, rainIntensityBucket, type RainIntensity } from "../lib/weather";
import { getDevOverrides } from "../lib/devOverrides";
import type { WeatherSnapshot } from "../types";
import type { ServiceResult } from "./types";

export interface ForecastPoint {
  lat: number;
  lng: number;
  time: string; // ISO — the point's ETA, used both to pick the nearest hourly reading and to stamp forecastConfidence
}

const HOURLY_VARS = [
  "temperature_2m",
  "weather_code",
  "precipitation",
  "precipitation_probability",
  "apparent_temperature",
  "wind_speed_10m",
  "wind_gusts_10m",
  "relative_humidity_2m",
  "uv_index",
  "is_day",
].join(",");

interface OpenMeteoHourly {
  time: string[];
  temperature_2m: number[];
  weather_code: number[];
  precipitation: number[];
  precipitation_probability: number[];
  apparent_temperature: number[];
  wind_speed_10m: number[];
  wind_gusts_10m: number[];
  relative_humidity_2m: number[];
  uv_index: number[];
  is_day: number[];
}

interface OpenMeteoLocationResponse {
  hourly: OpenMeteoHourly;
}

// Open-Meteo returns local (no-offset) timestamps even under timezone=UTC —
// appending "Z" is what makes `new Date(...)` parse them as UTC instead of
// (per the JS date-time-string spec quirk) the runtime's local time.
function nearestHourlyIndex(times: string[], targetIso: string): number {
  const targetMs = new Date(targetIso).getTime();
  let bestIndex = 0;
  let bestDiffMs = Infinity;
  for (let i = 0; i < times.length; i++) {
    const diffMs = Math.abs(new Date(`${times[i]}Z`).getTime() - targetMs);
    if (diffMs < bestDiffMs) {
      bestDiffMs = diffMs;
      bestIndex = i;
    }
  }
  return bestIndex;
}

// §5.5 — cumulative precipitation over the 6 hours immediately before
// "now" (fetch time, NOT the journey's future departure — puddle risk is
// about current ground conditions). Computed once from the first location
// and reused across every point: a deliberately citywide-ish single value,
// since legs within one journey are rarely far enough apart for recent
// rain history to differ meaningfully between them.
function sumRecentPrecipMm6h(hourly: OpenMeteoHourly, nowMs: number): number {
  const sixHoursAgoMs = nowMs - 6 * 3_600_000;
  let sum = 0;
  for (let i = 0; i < hourly.time.length; i++) {
    const hourMs = new Date(`${hourly.time[i]}Z`).getTime();
    if (hourMs > sixHoursAgoMs && hourMs <= nowMs) sum += hourly.precipitation[i];
  }
  return sum;
}

// Shared by getForecast() and getHourlyForecast() — both read the same
// Open-Meteo hourly response shape, just extract different slices of it.
async function fetchOpenMeteoHourly(latitude: string, longitude: string): Promise<ServiceResult<OpenMeteoLocationResponse[]>> {
  // §12.2 — dev-menu "force this service to error" toggle. One seam here
  // covers both getForecast() and getHourlyForecast(), since both funnel
  // through this shared fetch.
  if (__DEV__ && getDevOverrides().weatherError) {
    return { error: getDevOverrides().weatherError! };
  }

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&hourly=${HOURLY_VARS}&timezone=UTC&forecast_days=16&past_days=1`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    return { error: "network" };
  }

  if (!response.ok) {
    return { error: response.status === 429 ? "rate-limited" : "unreachable" };
  }

  let payload: OpenMeteoLocationResponse | OpenMeteoLocationResponse[];
  try {
    payload = await response.json();
  } catch {
    return { error: "unreachable" };
  }

  // Open-Meteo returns a bare object for a single lat/lng pair and an array
  // once more than one is requested — normalize to an array either way.
  return { data: Array.isArray(payload) ? payload : [payload] };
}

export async function getForecast(points: ForecastPoint[]): Promise<ServiceResult<WeatherSnapshot[]>> {
  if (points.length === 0) return { data: [] };

  const latitude = points.map((p) => p.lat).join(",");
  const longitude = points.map((p) => p.lng).join(",");
  const result = await fetchOpenMeteoHourly(latitude, longitude);
  if ("error" in result) return result;

  const locations = result.data;
  const fetchedAt = new Date().toISOString();
  const recentPrecipMm6h = sumRecentPrecipMm6h(locations[0].hourly, new Date(fetchedAt).getTime());

  const data: WeatherSnapshot[] = points.map((point, i) => {
    const hourly = locations[i].hourly;
    const index = nearestHourlyIndex(hourly.time, point.time);
    return {
      time: point.time,
      weatherCode: hourly.weather_code[index],
      precipMm: hourly.precipitation[index],
      precipProbability: hourly.precipitation_probability[index],
      tempC: hourly.temperature_2m[index],
      apparentTempC: hourly.apparent_temperature[index],
      windKph: hourly.wind_speed_10m[index],
      windGustKph: hourly.wind_gusts_10m[index],
      relativeHumidityPct: hourly.relative_humidity_2m[index],
      uvIndex: hourly.uv_index[index],
      isDaylight: hourly.is_day[index] === 1,
      forecastConfidence: forecastConfidence(point.time, fetchedAt),
      recentPrecipMm6h,
    };
  });

  return { data };
}

// §9.5 — one reading per hour for the Plan/Today hourly strip's rain-
// intensity gauge. A single-location read (unlike getForecast()'s
// multi-leg batching) since the strip shows one place's outlook, not a
// per-leg breakdown.
export interface HourlyReading {
  time: string; // ISO
  tempC: number;
  weatherCode: number;
  precipMm: number;
  windKph: number;
  rainIntensity: RainIntensity;
}

export async function getHourlyForecast(
  point: { lat: number; lng: number },
  fromIso: string,
  hours: number
): Promise<ServiceResult<HourlyReading[]>> {
  const result = await fetchOpenMeteoHourly(String(point.lat), String(point.lng));
  if ("error" in result) return result;

  const hourly = result.data[0].hourly;
  const fromMs = new Date(fromIso).getTime();
  // Open-Meteo's hourly.time entries have no timezone suffix under
  // timezone=UTC — appending "Z" is what makes them parse as UTC instead
  // of the runtime's local time (same quirk nearestHourlyIndex() handles).
  const startIndex = hourly.time.findIndex((t) => new Date(`${t}Z`).getTime() >= fromMs);
  if (startIndex === -1) return { data: [] };

  const data: HourlyReading[] = hourly.time.slice(startIndex, startIndex + hours).map((time, i) => {
    const index = startIndex + i;
    return {
      time: `${time}Z`,
      tempC: hourly.temperature_2m[index],
      weatherCode: hourly.weather_code[index],
      precipMm: hourly.precipitation[index],
      windKph: hourly.wind_speed_10m[index],
      rainIntensity: rainIntensityBucket(hourly.precipitation[index], hourly.precipitation_probability[index]),
    };
  });

  return { data };
}
