import { getDb } from "../index";
import type { CarryPreference } from "../../types";

export type ThemePreference = "system" | "light" | "dark";

async function getSetting(key: string): Promise<string | undefined> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string | null }>(
    "SELECT value FROM app_settings WHERE key = ?",
    key
  );
  return row?.value ?? undefined;
}

async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    value
  );
}

// docs/04-screens-navigation.md §4.1 — "a user can skip straight through
// and land on an empty Today tab; that's fine," which implies onboarding
// shouldn't re-trigger on the next launch just because everything was
// skipped and no Inventory/SavedLocation rows exist yet. An explicit
// completed flag (set whether the flow was skipped or filled in) is the
// gate; see DECISIONS.md for why this supersedes a pure "no data yet"
// check.
export async function isOnboardingCompleted(): Promise<boolean> {
  return (await getSetting("onboarding_completed")) === "true";
}

export async function setOnboardingCompleted(): Promise<void> {
  await setSetting("onboarding_completed", "true");
}

// docs/04-screens-navigation.md §4.1 step 5 — defaults off; changeable
// later in Settings (Phase 5).
export async function getCrashReportingEnabled(): Promise<boolean> {
  return (await getSetting("crash_reporting_enabled")) === "true";
}

export async function setCrashReportingEnabled(enabled: boolean): Promise<void> {
  await setSetting("crash_reporting_enabled", enabled ? "true" : "false");
}

// docs/09-design-system.md §9.1 — defaults to "system", read via
// useColorScheme() when set that way.
export async function getThemePreference(): Promise<ThemePreference> {
  const value = await getSetting("theme_preference");
  return value === "light" || value === "dark" ? value : "system";
}

export async function setThemePreference(preference: ThemePreference): Promise<void> {
  await setSetting("theme_preference", preference);
}

// docs/09-design-system.md §9.1 / docs/07-recommendation-engine.md §7.9 —
// the Settings-level default a Journey's own carryPreference overrides.
export async function getCarryPreferenceDefault(): Promise<CarryPreference> {
  const value = await getSetting("carry_preference_default");
  return value === "avoid-spares" ? "avoid-spares" : "no-preference";
}

export async function setCarryPreferenceDefault(preference: CarryPreference): Promise<void> {
  await setSetting("carry_preference_default", preference);
}

// docs/04-screens-navigation.md §4.1 (2026-07-21 minimal-onboarding rework)
// — the general location captured by onboarding's single "Where are you?"
// step. Deliberately not a SavedLocation: it's a lightweight fallback
// centre-point for the "Right now" card (useRightNow.ts), not a saved
// Home/Work place a user would plan journeys from — see DECISIONS.md.
export interface DefaultLocation {
  lat: number;
  lng: number;
  label: string;
}

export async function getDefaultLocation(): Promise<DefaultLocation | undefined> {
  const raw = await getSetting("default_location");
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.lat === "number" && typeof parsed.lng === "number" && typeof parsed.label === "string") {
      return parsed;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export async function setDefaultLocation(location: DefaultLocation): Promise<void> {
  await setSetting("default_location", JSON.stringify(location));
}

// docs/04-screens-navigation.md §4.1 — postponable setup hints on Today
// (SetupChecklist.tsx). A task disappears once its underlying data exists
// (computed live, not stored) OR once explicitly dismissed here — dismissal
// is a plain id list, not per-task state, since "postpone indefinitely" is
// the only state a dismissed task has (no snooze-until timestamp).
export async function getDismissedSetupTasks(): Promise<string[]> {
  const raw = await getSetting("dismissed_setup_tasks");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export async function dismissSetupTask(taskId: string): Promise<void> {
  const current = await getDismissedSetupTasks();
  if (current.includes(taskId)) return;
  await setSetting("dismissed_setup_tasks", JSON.stringify([...current, taskId]));
}

export async function resetDismissedSetupTasks(): Promise<void> {
  await setSetting("dismissed_setup_tasks", JSON.stringify([]));
}

// docs/12-dev-workflow-ci.md §12.2 point 4 — dev-menu "reset onboarding
// state and clear the crash-reporting/theme preferences... to re-test
// first-run flows without reinstalling." Also clears the two settings the
// 2026-07-21 onboarding rework introduced (default_location,
// dismissed_setup_tasks) — both are first-run-adjacent state a real reset
// should include, even though the original spec predates them.
export async function resetOnboardingAndPreferences(): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `DELETE FROM app_settings WHERE key IN (?, ?, ?, ?, ?)`,
    "onboarding_completed",
    "crash_reporting_enabled",
    "theme_preference",
    "default_location",
    "dismissed_setup_tasks"
  );
}
