// docs/09-design-system.md §9.1 — dark and light token sets, same shape.
// Components must never import these directly; read colors via useTheme()
// (src/theme/useTheme.ts) so theme switching doesn't require touching every
// screen.
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
};

export const darkTheme: ThemeTokens = {
  bg: "#161B26",
  surface: "#1F2534",
  surfaceRaised: "#2A3142",
  border: "#323A4D",
  textPrimary: "#F2F4F8",
  textSecondary: "#9AA3B8",
  accentTransit: "#4FB8AE",
  accentWalk: "#E8A860",
  accentDrive: "#7C8CE8",
  conditionDry: "#6E7890",
  conditionLight: "#F2C94C",
  conditionRain: "#4FA3E3",
  conditionHeavy: "#3B6FD6",
  conditionStorm: "#B24FE3",
  acBadge: "#5CC8E8",
  uvBadge: "#F2994A",
  feedbackPositive: "#5FBF7F",
  confidenceLow: "#9AA3B8",
  favoriteStar: "#F2C94C",
  annotationPin: "#C77DFF",
  danger: "#E0685A",
  surfaceRaisedBorder: "transparent",
};

export const lightTheme: ThemeTokens = {
  bg: "#F6F7FA",
  surface: "#FFFFFF",
  surfaceRaised: "#FFFFFF",
  border: "#DDE1EA",
  textPrimary: "#1A1E29",
  textSecondary: "#5C6478",
  accentTransit: "#2C8F86",
  accentWalk: "#C97F2E",
  accentDrive: "#5B63C9",
  conditionDry: "#7B8499",
  conditionLight: "#B8860B",
  conditionRain: "#2E7CC4",
  conditionHeavy: "#2953A8",
  conditionStorm: "#8C3AB0",
  acBadge: "#2F9FBE",
  uvBadge: "#C97327",
  feedbackPositive: "#3F9A5C",
  confidenceLow: "#5C6478",
  favoriteStar: "#B8860B",
  annotationPin: "#8A3FFC",
  danger: "#C0392B",
  surfaceRaisedBorder: "#DDE1EA",
};

// §6/9.1 — maps classifyWeather()'s severity (0-4) to the active theme's
// condition* tokens via a lookup array, theme-agnostic (indexes into
// whichever token object useTheme() currently returns).
export function conditionColorForSeverity(theme: ThemeTokens, severity: number): string {
  const lookup = [theme.conditionDry, theme.conditionLight, theme.conditionRain, theme.conditionHeavy, theme.conditionStorm];
  return lookup[severity] ?? theme.conditionDry;
}
