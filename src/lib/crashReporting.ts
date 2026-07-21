// docs/10-production-readiness.md §10.5 — opt-in crash reporting. Default
// off; no telemetry SDK initializes and no data leaves the device until the
// user explicitly turns it on via the Settings toggle (the 2026-07-21
// minimal-onboarding rework dropped the old forced onboarding step — crash
// reporting isn't personalization-relevant, so it doesn't belong in the
// postponable setup checklist either, only Settings). See DECISIONS.md
// (2026-07-21) for why the actual telemetry transport is a no-op provider
// rather than a live `@sentry/react-native` install in this session — the
// on/off gating and scrubbing behavior below are real and unit-tested
// regardless of which provider is plugged in.
import { getCrashReportingEnabled } from "../db/repositories/settings";

export type CrashReportContext = Record<string, unknown>;

export interface CrashReportingProvider {
  init(): void;
  captureException(error: unknown, context: CrashReportContext): void;
  close(): void;
}

class NoopCrashReportingProvider implements CrashReportingProvider {
  init() {}
  captureException() {}
  close() {}
}

const provider: CrashReportingProvider = new NoopCrashReportingProvider();
let initialized = false;

// A stack trace doesn't need "Home" address or coordinates to be useful for
// debugging a null-pointer in the recommendation engine — strip anything
// that could carry a saved-location label or lat/lng before it ever reaches
// captureException(), recursively (context objects can nest a Journey's
// origin/destination).
const SCRUBBED_KEYS = new Set(["lat", "lng", "address", "label", "origin", "destination", "waypoints"]);

export function scrubCrashContext(context: CrashReportContext): CrashReportContext {
  const scrubbed: CrashReportContext = {};
  for (const [key, value] of Object.entries(context)) {
    if (SCRUBBED_KEYS.has(key)) continue;
    scrubbed[key] =
      value && typeof value === "object" && !Array.isArray(value)
        ? scrubCrashContext(value as CrashReportContext)
        : value;
  }
  return scrubbed;
}

// Called once at app startup and again immediately after the Settings
// toggle changes, so turning it on takes effect without a restart and
// turning it off actually tears the provider down rather than leaving it
// running silently.
export async function initCrashReportingIfEnabled(): Promise<void> {
  const enabled = await getCrashReportingEnabled();
  if (enabled && !initialized) {
    provider.init();
    initialized = true;
  } else if (!enabled && initialized) {
    provider.close();
    initialized = false;
  }
}

export function captureException(error: unknown, context: CrashReportContext = {}): void {
  if (!initialized) return;
  provider.captureException(error, scrubCrashContext(context));
}

export function isCrashReportingInitialized(): boolean {
  return initialized;
}
