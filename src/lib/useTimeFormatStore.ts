import { create } from "zustand";
import type { TimeFormatPreference } from "../db/repositories/settings";

// Mirrors src/theme/useThemeStore.ts's pattern — holds the persisted
// preference in memory so every screen showing a time (Today, Journey
// Detail, History, Plan's hourly strip) re-renders together on change.
// src/db/repositories/settings.ts remains the source of truth on disk
// (loaded once at app start, written on every change from Settings).
type TimeFormatState = {
  timeFormatPreference: TimeFormatPreference;
  setTimeFormatPreference: (preference: TimeFormatPreference) => void;
};

export const useTimeFormatStore = create<TimeFormatState>((set) => ({
  timeFormatPreference: "12h",
  setTimeFormatPreference: (preference) => set({ timeFormatPreference: preference }),
}));
