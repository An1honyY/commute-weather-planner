// Open-Meteo (api.open-meteo.com/v1/forecast) — docs/02-external-apis.md §2.
// Free, keyless. Requests apparent_temperature, wind_gusts_10m,
// relative_humidity_2m, uv_index, is_day per §2/§6.2. `past_days` for
// recentPrecipMm6h is Phase 6 (docs/05-data-wiring.md §5.5), not added here.
import { forecastConfidence } from "../lib/weather";
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

export async function getForecast(points: ForecastPoint[]): Promise<ServiceResult<WeatherSnapshot[]>> {
  if (points.length === 0) return { data: [] };

  const latitude = points.map((p) => p.lat).join(",");
  const longitude = points.map((p) => p.lng).join(",");
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&hourly=${HOURLY_VARS}&timezone=UTC&forecast_days=16`;

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
  const locations = Array.isArray(payload) ? payload : [payload];
  const fetchedAt = new Date().toISOString();

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
    };
  });

  return { data };
}
