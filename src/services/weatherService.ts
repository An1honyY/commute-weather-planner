// Open-Meteo (api.open-meteo.com/v1/forecast) — docs/02-external-apis.md §2.
// Wired for real in Phase 4, requesting apparent_temperature, wind_gusts_10m,
// relative_humidity_2m, uv_index, is_day per §2/§6.2, plus past_days=1 for
// recentPrecipMm6h from Phase 6 (docs/05-data-wiring.md §5.5). This is the
// Phase 1 seam — see routesService.ts for the pattern.
import type { WeatherSnapshot } from "../types";
import type { ServiceResult } from "./types";

export interface ForecastPoint {
  lat: number;
  lng: number;
  time: string; // ISO
}

export async function getForecast(
  _points: ForecastPoint[]
): Promise<ServiceResult<WeatherSnapshot[]>> {
  return { error: "unreachable" };
}
