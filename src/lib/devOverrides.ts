// docs/12-dev-workflow-ci.md §12.2 — dev-menu service overrides, read by
// each src/services/ module at its single seam (§12.1: "exactly one seam
// per API to intercept, not one per screen that happens to call it").
// Module-level state, not persisted to app_settings — resets on every app
// reload, which is the right default for a debugging tool (a forced
// failure silently surviving a restart nobody remembers setting would be
// its own bug). Every read site gates on `__DEV__` itself (see
// routesService.ts/weatherService.ts/transitService.ts), so this module
// having no effect is never something DevMenuScreen needs to enforce.
import type { ServiceError } from "../services/types";

export interface DevOverrides {
  routesError?: ServiceError;
  weatherError?: ServiceError;
  transitError?: ServiceError;
  // §12.2 point 5 — "simulate an AT GTFS Realtime delay of a chosen number
  // of minutes," applied to every getRealtimeDelay() call while set rather
  // than scoped to one specific leg — see DevMenuScreen's own comment for
  // why per-leg targeting wasn't built.
  transitDelayMinutes?: number;
}

let overrides: DevOverrides = {};

export function getDevOverrides(): DevOverrides {
  return overrides;
}

export function setDevOverride<K extends keyof DevOverrides>(key: K, value: DevOverrides[K]): void {
  overrides = { ...overrides, [key]: value };
}

export function resetDevOverrides(): void {
  overrides = {};
}
