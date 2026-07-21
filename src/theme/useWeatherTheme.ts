import { useColorScheme } from "react-native";
import { useThemeStore } from "./useThemeStore";
import { darkTheme, lightTheme, moodOverrides, type ThemeTokens } from "./tokens";
import { classifyWeather, resolveWeatherMood } from "../lib/weather";
import type { WeatherSnapshot } from "../types";

// §9.1 (2026-07-21) — Today tab only (docs/09-design-system.md's weather-
// reactive tint subsection): layers a mood-based tint on top of the same
// dark/light resolution useTheme() does, so the rest of the app (Settings,
// Gear, Locations, Journey Detail, ...) stays on the fixed base palette and
// only the Today tab's "Right now" card + journey cards react to current
// conditions. Pass `undefined`/`null` (no weather loaded yet, or a screen
// that doesn't want the reactive tint) to get the plain base theme back —
// same value useTheme() would return.
export default function useWeatherTheme(weather: WeatherSnapshot | undefined | null): ThemeTokens {
  const themePreference = useThemeStore((s) => s.themePreference);
  const systemScheme = useColorScheme();
  const resolved = themePreference === "system" ? (systemScheme ?? "dark") : themePreference;
  const base = resolved === "light" ? lightTheme : darkTheme;

  if (!weather) return base;

  const severity = classifyWeather(weather.weatherCode, weather.precipMm, weather.windKph).severity;
  const mood = resolveWeatherMood(weather.apparentTempC, severity);
  if (mood === "mild") return base;

  const override = moodOverrides[mood][resolved === "light" ? "light" : "dark"];
  return { ...base, ...override };
}
