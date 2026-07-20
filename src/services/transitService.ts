// Auckland Transport GTFS Realtime (api.at.govt.nz/gtfs/v3/...) —
// docs/02-external-apis.md §2. Wired for real in Phase 7
// (docs/08-build-phases.md), including the stationary-wait-leg sizing from
// delay data (docs/05-data-wiring.md §5.6). This is the Phase 1 seam — see
// routesService.ts for the pattern. Auckland-only per §2.1; callers outside
// Auckland should expect this to consistently return `unreachable` rather
// than the app trying to guess a fallback GTFS feed.
import type { ServiceResult } from "./types";

export interface RealtimeDelay {
  delayMinutes: number;
  stopType: "platform" | "street-stop";
}

export interface GetRealtimeDelayParams {
  stopId: string;
  routeId: string;
  scheduledDepartTime: string; // ISO
}

export async function getRealtimeDelay(
  _params: GetRealtimeDelayParams
): Promise<ServiceResult<RealtimeDelay>> {
  return { error: "unreachable" };
}
