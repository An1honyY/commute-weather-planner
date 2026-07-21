import { create } from "zustand";
import type { ThemePreference } from "../db/repositories/settings";

// §9.1 — holds the persisted preference in memory so every screen re-renders
// together on change; src/db/repositories/settings.ts remains the source of
// truth on disk (loaded once at app start, written on every change from
// Settings).
type ThemeState = {
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
};

export const useThemeStore = create<ThemeState>((set) => ({
  themePreference: "system",
  setThemePreference: (preference) => set({ themePreference: preference }),
}));
