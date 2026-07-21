import { useColorScheme } from "react-native";
import { useThemeStore } from "./useThemeStore";
import { darkTheme, lightTheme, type ThemeTokens } from "./tokens";

// §9.1 — the only sanctioned way for a component to read theme colors.
// Resolves "system" against RN's useColorScheme() so components never
// branch on themePreference themselves.
export default function useTheme(): ThemeTokens {
  const themePreference = useThemeStore((s) => s.themePreference);
  const systemScheme = useColorScheme();
  const resolved = themePreference === "system" ? (systemScheme ?? "dark") : themePreference;
  return resolved === "light" ? lightTheme : darkTheme;
}
