import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import * as Location from "expo-location";
import { getForecast } from "../services/weatherService";
import { recommendGear, type Recommendation } from "./recommend";
import { listClothing } from "../db/repositories/clothing";
import { listShoes } from "../db/repositories/shoes";
import { listUmbrellas } from "../db/repositories/umbrellas";
import { getWarmthCalibration } from "../db/repositories/calibration";
import { getAdvancedThresholds } from "../db/repositories/advancedThresholds";
import { getDefaultLocation } from "../db/repositories/settings";
import { newId } from "../db/rowMapping";
import type { Journey, WeatherSnapshot } from "../types";

// "Right now" card — docs/04-screens-navigation.md §4.2. Current device
// location when granted; otherwise the general location captured by
// onboarding's single location step (app_settings.default_location), if
// any; otherwise Auckland — three-deep fallback chain rather than the
// original two, since 2026-07-21's minimal-onboarding rework (see
// DECISIONS.md) means onboarding often has a real, more-specific location
// even when device permission was never granted. One Open-Meteo call, and
// a *reduced* recommendGear() pass: a single short walk leg means
// AC-contrast and the warmup discount never fire on their own, and
// bottoms/severeWeatherAdvisory are stripped explicitly per §4.2's "the
// reduced path never triggers bottoms, the severe-weather advisory, or
// wear tracking." Refreshes on tab focus, not continuously, to avoid
// draining battery/quota.
const AUCKLAND = { lat: -36.8485, lng: 174.7633 };

export interface RightNowState {
  loading: boolean;
  weather: WeatherSnapshot | null;
  recommendation: Recommendation | null;
  isFallbackLocation: boolean;
}

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
  const [state, setState] = useState<RightNowState>({
    loading: true,
    weather: null,
    recommendation: null,
    isFallbackLocation: false,
  });

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function load() {
        setState((prev) => ({ ...prev, loading: true }));

        let coords = AUCKLAND;
        let isFallbackLocation = true;
        try {
          const permission = await Location.getForegroundPermissionsAsync();
          if (permission.granted) {
            const position = await Location.getCurrentPositionAsync({});
            coords = { lat: position.coords.latitude, lng: position.coords.longitude };
            isFallbackLocation = false;
          } else {
            const defaultLocation = await getDefaultLocation();
            if (defaultLocation) {
              coords = { lat: defaultLocation.lat, lng: defaultLocation.lng };
              isFallbackLocation = false;
            }
          }
        } catch {
          // keep whichever fallback was already resolved (default location, or Auckland)
        }

        const now = new Date().toISOString();
        const forecastResult = await getForecast([{ lat: coords.lat, lng: coords.lng, time: now }]);
        if (cancelled) return;
        if (!("data" in forecastResult) || forecastResult.data.length === 0) {
          setState({ loading: false, weather: null, recommendation: null, isFallbackLocation });
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

        setState({ loading: false, weather, recommendation: reduced, isFallbackLocation });
      }

      load();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  return state;
}
