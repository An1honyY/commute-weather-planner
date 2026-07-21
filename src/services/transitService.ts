// Auckland Transport GTFS Realtime (api.at.govt.nz/gtfs/v3/...) —
// docs/02-external-apis.md §2. Real Phase 7 wiring — see routesService.ts
// for the pattern this follows (env-var key, ServiceResult shape). Reads
// the trip-updates feed (AT's APIM-fronted `Ocp-Apim-Subscription-Key`
// auth) and returns the scheduled-vs-actual delay for one stop_time_update
// matching the given route/stop, used to size the stationary wait leg
// (docs/05-data-wiring.md §5.6) and drive the leg's live-delay pill
// (docs/09-design-system.md §9.3). Auckland-only per §2.1; callers outside
// Auckland should expect this to consistently return `unreachable` rather
// than the app trying to guess a fallback GTFS feed.
//
// Known gap (see DECISIONS.md): `routeId`/`stopId` here are best-effort
// values threaded through from Google Routes' transit step data (a route's
// short name, a stop's display name) — Google doesn't expose AT's actual
// GTFS `route_id`/`stop_id`, and resolving one from the other would need a
// static-GTFS stop/route lookup table this app doesn't build. A mismatch
// simply falls through to "no matching entity found," which is treated the
// same as `unreachable` (§5.6's flat 5-minute fallback already covers it).
import type { ServiceResult } from "./types";

export interface RealtimeDelay {
  delayMinutes: number;
  stopType: "platform" | "street-stop";
}

export interface GetRealtimeDelayParams {
  stopId: string;
  routeId: string;
  scheduledDepartTime: string; // ISO
  mode: "bus" | "train"; // AT's realtime feed doesn't carry GTFS static location_type, so platform-vs-street-stop is inferred from mode: Auckland trains always board from a platform, buses from a street stop — see DECISIONS.md
}

const TRIP_UPDATES_URL = "https://api.at.govt.nz/realtime/legacy/tripupdates";

function apiKey(): string | undefined {
  return process.env.EXPO_PUBLIC_AT_SUBSCRIPTION_KEY;
}

interface GtfsStopTimeUpdate {
  stop_id?: string;
  arrival?: { delay?: number };
  departure?: { delay?: number };
}
interface GtfsTripUpdate {
  trip?: { route_id?: string };
  stop_time_update?: GtfsStopTimeUpdate[];
}
interface GtfsEntity {
  trip_update?: GtfsTripUpdate;
}
interface GtfsFeedMessage {
  response?: { entity?: GtfsEntity[] };
}

export async function getRealtimeDelay(
  params: GetRealtimeDelayParams
): Promise<ServiceResult<RealtimeDelay>> {
  const key = apiKey();
  if (!key || !params.stopId || !params.routeId) {
    return { error: "unreachable" };
  }

  let response: Response;
  try {
    response = await fetch(`${TRIP_UPDATES_URL}?route_id=${encodeURIComponent(params.routeId)}`, {
      headers: { "Ocp-Apim-Subscription-Key": key },
    });
  } catch {
    return { error: "network" };
  }

  if (!response.ok) {
    return { error: response.status === 429 ? "rate-limited" : "unreachable" };
  }

  let payload: GtfsFeedMessage;
  try {
    payload = await response.json();
  } catch {
    return { error: "unreachable" };
  }

  const entities = payload.response?.entity ?? [];
  for (const entity of entities) {
    const stopTimeUpdate = entity.trip_update?.stop_time_update?.find((u) => u.stop_id === params.stopId);
    if (stopTimeUpdate) {
      const delaySeconds = stopTimeUpdate.arrival?.delay ?? stopTimeUpdate.departure?.delay ?? 0;
      return {
        data: {
          delayMinutes: Math.round(delaySeconds / 60),
          stopType: params.mode === "train" ? "platform" : "street-stop",
        },
      };
    }
  }

  // Reachable feed, but no live entity for this specific route/stop right
  // now (mismatched ids, or the trip genuinely has no realtime data yet) —
  // same "nothing to size the wait leg from" case as an unreachable feed.
  return { error: "unreachable" };
}
