// docs/09-design-system.md §9.1 — dark and light token sets, same shape.
// Components must never import these directly; read colors via useTheme()
// (src/theme/useTheme.ts) so theme switching doesn't require touching every
// screen. "Paua Pop" palette (§9.1, 2026-07-21 redesign) — see DECISIONS.md
// for the round-by-round design review this came out of.
import type { WeatherMood } from "../lib/weather";

export type ThemeTokens = {
  bg: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  accentTransit: string;
  accentWalk: string;
  accentDrive: string;
  conditionDry: string;
  conditionLight: string;
  conditionRain: string;
  conditionHeavy: string;
  conditionStorm: string;
  acBadge: string;
  uvBadge: string;
  feedbackPositive: string;
  confidenceLow: string;
  favoriteStar: string;
  annotationPin: string;
  // Not in §9.1's table but needed consistently across screens that were
  // previously hardcoded: a destructive-action color and a raised border
  // used only in the light theme's surfaceRaised outline (§9.1's own note).
  danger: string;
  surfaceRaisedBorder: string;
  // §9.1 (2026-07-21) — the color a `cardElevationStyle()` shadow should
  // render in; distinct per theme since a light-mode shadow needs far less
  // opacity than a dark-mode one to read as "lifted" rather than "smudged."
  shadowColor: string;
  // Set once per base theme (dark/light) and left untouched by weather-mood
  // overrides (useWeatherTheme.ts) — cardElevationStyle() needs a stable
  // way to pick shadow opacity that survives a mood-merged token object,
  // where `theme === lightTheme` identity checks no longer hold.
  isLight: boolean;
};

export const darkTheme: ThemeTokens = {
  bg: "#171B36",
  surface: "#1F2447",
  surfaceRaised: "#262B52",
  border: "#383D6E",
  textPrimary: "#F5F3FF",
  textSecondary: "#A8A4CC",
  accentTransit: "#1FE0C4",
  accentWalk: "#FF4D8D",
  accentDrive: "#8A5CFF",
  conditionDry: "#6B7094",
  conditionLight: "#FFD23F",
  conditionRain: "#4FA7E0",
  conditionHeavy: "#3B6FD6",
  conditionStorm: "#B45CFF",
  acBadge: "#4FC8E8",
  uvBadge: "#FFD23F",
  feedbackPositive: "#4FBF7F",
  confidenceLow: "#A8A4CC",
  favoriteStar: "#FFD23F",
  annotationPin: "#C86BFF",
  danger: "#E0685A",
  surfaceRaisedBorder: "transparent",
  shadowColor: "#000000",
  isLight: false,
};

export const lightTheme: ThemeTokens = {
  bg: "#FAF7FC",
  surface: "#FFFFFF",
  surfaceRaised: "#FFFFFF",
  border: "#E4DFF0",
  textPrimary: "#1C1930",
  textSecondary: "#6B6584",
  accentTransit: "#0E9A87",
  accentWalk: "#D6266E",
  accentDrive: "#6636E0",
  conditionDry: "#6B6584",
  conditionLight: "#C99515",
  conditionRain: "#2E7CC4",
  conditionHeavy: "#2953A8",
  conditionStorm: "#9438DB",
  acBadge: "#1583A3",
  uvBadge: "#C99515",
  feedbackPositive: "#3F9A5C",
  confidenceLow: "#6B6584",
  favoriteStar: "#C99515",
  annotationPin: "#7A2FC4",
  danger: "#C0392B",
  surfaceRaisedBorder: "#E4DFF0",
  shadowColor: "#28204A",
  isLight: true,
};

// §6/9.1 — maps classifyWeather()'s severity (0-4) to the active theme's
// condition* tokens via a lookup array, theme-agnostic (indexes into
// whichever token object useTheme() currently returns).
export function conditionColorForSeverity(theme: ThemeTokens, severity: number): string {
  const lookup = [theme.conditionDry, theme.conditionLight, theme.conditionRain, theme.conditionHeavy, theme.conditionStorm];
  return lookup[severity] ?? theme.conditionDry;
}

// §9.0 (2026-07-21 redesign) — replaces the original "no drop shadows" rule:
// content-box components (the "Right now" card, journey cards, the gear
// recommendation card) now lift off the background with a shadow instead of
// a hairline border. One shared helper so every card gets the same
// elevation rather than each screen inventing its own shadow values;
// `elevation` covers Android (RN's shadow* props are iOS-only).
export function cardElevationStyle(theme: ThemeTokens) {
  return {
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: theme.isLight ? 0.1 : 0.35,
    shadowRadius: 14,
    elevation: 6,
  } as const;
}

// §9.1 (2026-07-21) — Today tab weather-reactive tint (useWeatherTheme.ts).
// Only the tokens that actually change with mood are listed per variant;
// everything else (condition*, accent hues other than accentWalk, badges)
// stays fixed so per-leg dots/badges keep their existing, unrelated meaning
// regardless of the screen's overall mood. "mild" has no entry — it *is*
// darkTheme/lightTheme unchanged, so useWeatherTheme() skips merging
// anything for it rather than duplicating the base values here.
type MoodOverride = Partial<
  Pick<ThemeTokens, "bg" | "surface" | "surfaceRaised" | "border" | "textPrimary" | "textSecondary" | "accentWalk">
>;

export const moodOverrides: Record<Exclude<WeatherMood, "mild">, { dark: MoodOverride; light: MoodOverride }> = {
  cold: {
    dark: {
      bg: "#10192E",
      surface: "#16233E",
      surfaceRaised: "#1C2C4A",
      border: "#2A3D63",
      textPrimary: "#EAF6FF",
      textSecondary: "#8FB3D6",
      accentWalk: "#2FB8E8",
    },
    light: {
      bg: "#EFF6FB",
      surface: "#FFFFFF",
      surfaceRaised: "#FFFFFF",
      border: "#D3E4F0",
      textPrimary: "#10202E",
      textSecondary: "#57748A",
      accentWalk: "#0E86B0",
    },
  },
  warm: {
    dark: {
      bg: "#241A12",
      surface: "#33241A",
      surfaceRaised: "#402D20",
      border: "#5C4530",
      textPrimary: "#FFF6EC",
      textSecondary: "#D9B99A",
      accentWalk: "#FFD23F",
    },
    light: {
      bg: "#FBF3EA",
      surface: "#FFFFFF",
      surfaceRaised: "#FFFFFF",
      border: "#EEDCC4",
      textPrimary: "#2E2013",
      textSecondary: "#8A6F52",
      accentWalk: "#B8790E",
    },
  },
};
