import { getDb } from "../index";

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
