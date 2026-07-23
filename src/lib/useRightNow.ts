import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { getForecast } from "../services/weatherService";
import { recommendGear, type Recommendation } from "./recommend";
import { listClothing } from "../db/repositories/clothing";
import { listShoes } from "../db/repositories/shoes";
import { listUmbrellas } from "../db/repositories/umbrellas";
import { getWarmthCalibration } from "../db/repositories/calibration";
import { getAdvancedThresholds } from "../db/repositories/advancedThresholds";
import { resolveApproximateLocation } from "./approximateLocation";
import { reverseGeocodeSuburb } from "../services/placesService";
import { newId } from "../db/rowMapping";
import type { Journey, WeatherSnapshot } from "../types";

// "Right now" card — docs/04-screens-navigation.md §4.2. Location resolved
// via approximateLocation.ts's shared GPS → default-location → Auckland
// chain (also used by LocationPickerMap's pin-drop seeding). One Open-Meteo
// call, and a *reduced* recommendGear() pass: a single short walk leg means
// AC-contrast and the warmup discount never fire on their own, and
// bottoms/severeWeatherAdvisory are stripped explicitly per §4.2's "the
// reduced path never triggers bottoms, the severe-weather advisory, or
// wear tracking." Refreshes on tab focus, not continuously, to avoid
// draining battery/quota — and throttled below so hopping between tabs
// (Today → Plan → Today) doesn't refire the network round-trip every time.

export interface RightNowState {
  loading: boolean;
  weather: WeatherSnapshot | null;
  recommendation: Recommendation | null;
  isFallbackLocation: boolean;
  suburb: string | null;
}

// Module-level (not component state) so it survives this hook's own
// mount/unmount — a tab switch keeps TodayScreen mounted in React
// Navigation, but a module cache is the more robust guarantee either way.
// A fresh app launch always gets `cache === null`, so the first load on
// any given run is never skipped.
const REFRESH_INTERVAL_MS = 5 * 60_000;
let cache: { state: RightNowState; fetchedAt: number; coordsKey: string } | null = null;

function buildSyntheticJourney(weather: WeatherSnapshot, coords: { lat: number; lng: number }): Journey {
  const here = { id: "current-location", label: "Current location", address: "", lat: coords.lat, lng: coords.lng };
  return {
    id: "right-now",
    origin: here,
    destination: here,
    departTime: weather.time,
    legs: [
      {
        id: newId(),
        mode: "walk",
        label: "Right now",
        durationMin: 1, // well under WARMUP_WALK_MIN_MINUTES — no warmup discount from a single-point check
        startTime: weather.time,
        outdoor: true,
        weather,
      },
    ],
  };
}

export function useRightNow(): RightNowState {
  const [state, setState] = useState<RightNowState>(
    cache?.state ?? { loading: true, weather: null, recommendation: null, isFallbackLocation: false, suburb: null }
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function load() {
        // A fresh-enough cached read wins outright — skip the network
        // round-trip (and the loading flicker) entirely rather than
        // refetching every time the Today tab regains focus.
        if (cache && Date.now() - cache.fetchedAt < REFRESH_INTERVAL_MS) {
          setState(cache.state);
          return;
        }

        setState((prev) => ({ ...prev, loading: true }));

        const { lat, lng, isFallback: isFallbackLocation } = await resolveApproximateLocation();
        const coords = { lat, lng };
        const coordsKey = `${lat},${lng}`;

        const now = new Date().toISOString();
        const [forecastResult, suburbResult] = await Promise.all([
          getForecast([{ lat: coords.lat, lng: coords.lng, time: now }]),
          reverseGeocodeSuburb(coords.lat, coords.lng),
        ]);
        if (cancelled) return;
        const suburb = "data" in suburbResult ? suburbResult.data.suburb : null;
        if (!("data" in forecastResult) || forecastResult.data.length === 0) {
          const next: RightNowState = { loading: false, weather: null, recommendation: null, isFallbackLocation, suburb };
          setState(next);
          cache = { state: next, fetchedAt: Date.now(), coordsKey };
          return;
        }
        const weather = forecastResult.data[0];

        const [clothing, shoes, umbrellas, calibration, thresholds] = await Promise.all([
          listClothing(),
          listShoes(),
          listUmbrellas(),
          getWarmthCalibration(),
          getAdvancedThresholds(),
        ]);
        if (cancelled) return;

        const journey = buildSyntheticJourney(weather, coords);
        const full = recommendGear(journey, { clothing, shoes, umbrellas }, calibration, "no-preference", thresholds);
        // §4.2 — never surfaced on the reduced path.
        const reduced: Recommendation = { ...full, bottoms: undefined, severeWeatherAdvisory: undefined };

        const next: RightNowState = { loading: false, weather, recommendation: reduced, isFallbackLocation, suburb };
        setState(next);
        cache = { state: next, fetchedAt: Date.now(), coordsKey };
      }

      load();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  return state;
}
