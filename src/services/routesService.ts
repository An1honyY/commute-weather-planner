// Google Routes API (routes.googleapis.com/directions/v2:computeRoutes) —
// docs/02-external-apis.md §2. Reads GOOGLE_ROUTES_API_KEY from env (Expo's
// EXPO_PUBLIC_ prefix convention, docs/01-tech-stack.md's "env/secrets"
// row) — see .env.example. No key configured is treated the same as an
// unreachable API: docs/05-data-wiring.md §5.1's offline/failure path
// already has to handle a real outage, and "not configured yet in this
// dev environment" is the same shape of failure for the caller.
//
// EXPO_PUBLIC_ env vars are bundled into the client JS as plain text —
// fine for local dev, but docs/10-production-readiness.md §10.1 requires
// restricting the key by package/bundle ID (or proxying calls through a
// backend) before wide release. That hardening is explicitly Phase 12
// scope, not something to half-do here.
import { getDevOverrides } from "../lib/devOverrides";
import type { ServiceResult } from "./types";

export type RouteTravelMode = "walk" | "drive" | "bus" | "train" | "cycle";

export interface RouteStep {
  mode: RouteTravelMode;
  label: string;
  durationMin: number;
  polyline: string;
  // A synthesized stationary wait ahead of a transit step (§3.5/§5.6) —
  // sized from Google's own scheduled departure time here; Phase 7 resizes
  // this from live AT GTFS Realtime delay data instead.
  isStationary?: boolean;
  waitContext?: "transit-platform" | "transit-stop";
  // Best-effort identifiers for Phase 7's AT GTFS Realtime lookup
  // (transitService.getRealtimeDelay, §5.6) — only set on the transit
  // step itself, not the walk/wait steps around it. See transitService.ts's
  // header comment for why these are approximate, not real AT GTFS ids.
  routeId?: string;
  stopId?: string;
  scheduledDepartTime?: string; // ISO
}

export interface RoutePoint {
  lat: number;
  lng: number;
  label: string;
}

export interface ComputeRouteParams {
  origin: RoutePoint;
  destination: RoutePoint;
  waypoints?: RoutePoint[]; // passed as `intermediates` on the same call, §5.5
  mode: RouteTravelMode;
  // Exactly one of these is set by callers. `arriveTime` only takes effect
  // for TRANSIT (bus/train) — Google's Routes API doesn't support
  // arrival-time routing for any other travel mode; planJourney.ts's
  // arrive-by estimate for walk/drive/cycle instead passes the desired
  // arrival instant as `departTime` itself (see resolveArrivalPlan there).
  departTime?: string; // ISO
  arriveTime?: string; // ISO — TRANSIT only
}

const COMPUTE_ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

function apiKey(): string | undefined {
  return process.env.EXPO_PUBLIC_GOOGLE_ROUTES_API_KEY;
}

function toWaypoint(point: RoutePoint) {
  return { location: { latLng: { latitude: point.lat, longitude: point.lng } } };
}

function parseDurationSeconds(duration: string | undefined): number {
  if (!duration) return 0;
  return parseInt(duration.replace("s", ""), 10) || 0;
}

function toMinutes(durationSeconds: number): number {
  return Math.max(1, Math.round(durationSeconds / 60));
}

interface GooglePolyline {
  encodedPolyline?: string;
}
interface GoogleTransitStop {
  name?: string;
}
interface GoogleTransitDetails {
  stopDetails?: {
    arrivalStop?: GoogleTransitStop;
    departureStop?: GoogleTransitStop;
    departureTime?: string;
    arrivalTime?: string;
  };
  transitLine?: { vehicle?: { type?: string }; nameShort?: string; name?: string };
}
interface GoogleRouteStep {
  travelMode?: "WALK" | "TRANSIT";
  staticDuration?: string;
  polyline?: GooglePolyline;
  transitDetails?: GoogleTransitDetails;
}
interface GoogleRouteLeg {
  duration?: string;
  staticDuration?: string;
  polyline?: GooglePolyline;
  steps?: GoogleRouteStep[];
}
interface GoogleRoute {
  legs?: GoogleRouteLeg[];
}
interface GoogleComputeRoutesResponse {
  routes?: GoogleRoute[];
}

// WALK/BICYCLE/DRIVE: one Google "leg" per hop between consecutive stops
// (origin→wp1, wp1→wp2, …, wpN→destination) — maps 1:1 onto our per-hop
// leg model, no further expansion needed.
function parseSimpleLegs(route: GoogleRoute, params: ComputeRouteParams): RouteStep[] {
  const stops = [params.origin, ...(params.waypoints ?? []), params.destination];
  const verb = params.mode === "cycle" ? "Cycle" : params.mode === "drive" ? "Drive" : "Walk";
  return (route.legs ?? []).map((leg, i) => ({
    mode: params.mode,
    label: `${verb} to ${stops[i + 1].label}`,
    durationMin: toMinutes(parseDurationSeconds(leg.duration ?? leg.staticDuration)),
    polyline: leg.polyline?.encodedPolyline ?? "",
  }));
}

// TRANSIT: Google returns one leg with a flat steps[] mixing WALK and
// TRANSIT sub-segments — expanded into our walk/wait/transit leg triple
// per hop. A wait step is only synthesized when Google's own scheduled
// departure time leaves a gap after our running cursor; otherwise the
// transit step follows immediately with no separate wait leg.
function parseTransitSteps(route: GoogleRoute, params: ComputeRouteParams): RouteStep[] {
  const steps = route.legs?.[0]?.steps ?? [];
  const result: RouteStep[] = [];

  let cursorMs: number;
  if (params.departTime) {
    cursorMs = new Date(params.departTime).getTime();
  } else {
    // Arrive-by call (arriveTime set, no departTime) — no anchor clock time
    // was given, so seed the cursor from the first transit step's own real
    // scheduled departure, walked back by any leading walk step's duration,
    // rather than assuming an (unknown) absolute start time.
    const firstTransitIndex = steps.findIndex(
      (s) => s.travelMode === "TRANSIT" && s.transitDetails?.stopDetails?.departureTime
    );
    const firstTransitDepartMs =
      firstTransitIndex >= 0
        ? new Date(steps[firstTransitIndex].transitDetails!.stopDetails!.departureTime!).getTime()
        : Date.now();
    const leadingWalkSeconds = steps
      .slice(0, firstTransitIndex >= 0 ? firstTransitIndex : 0)
      .reduce((sum, s) => sum + parseDurationSeconds(s.staticDuration), 0);
    cursorMs = firstTransitDepartMs - leadingWalkSeconds * 1000;
  }

  steps.forEach((step, i) => {
    const durationSeconds = parseDurationSeconds(step.staticDuration);

    if (step.travelMode === "WALK") {
      // Name the stop when the very next step is the transit leg it leads
      // into — reads far better than a bare "Walk to stop" when we already
      // know exactly which stop that is.
      const nextTransit = steps[i + 1];
      const walkTargetName =
        nextTransit?.travelMode === "TRANSIT" ? nextTransit.transitDetails?.stopDetails?.departureStop?.name : undefined;
      result.push({
        mode: "walk",
        label: walkTargetName ? `Walk to ${walkTargetName}` : "Walk to stop",
        durationMin: toMinutes(durationSeconds),
        polyline: step.polyline?.encodedPolyline ?? "",
      });
      cursorMs += durationSeconds * 1000;
      return;
    }

    if (step.travelMode === "TRANSIT" && step.transitDetails) {
      const vehicleType = step.transitDetails.transitLine?.vehicle?.type ?? "BUS";
      const mode: RouteTravelMode = vehicleType === "BUS" ? "bus" : "train";
      const departureIso = step.transitDetails.stopDetails?.departureTime;
      const arrivalStopName = step.transitDetails.stopDetails?.arrivalStop?.name ?? params.destination.label;
      const routeName = step.transitDetails.transitLine?.nameShort ?? step.transitDetails.transitLine?.name;

      if (departureIso) {
        const departureMs = new Date(departureIso).getTime();
        const waitMin = Math.round((departureMs - cursorMs) / 60_000);
        if (waitMin > 0) {
          result.push({
            mode,
            label: routeName ? `Waiting for the ${routeName}` : "Waiting for transit",
            durationMin: waitMin,
            polyline: "",
            isStationary: true,
            waitContext: "transit-stop",
          });
        }
        cursorMs = departureMs;
      }

      result.push({
        mode,
        label: `${mode === "bus" ? "Bus" : "Train"} to ${arrivalStopName}`,
        durationMin: toMinutes(durationSeconds),
        polyline: step.polyline?.encodedPolyline ?? "",
        routeId: routeName,
        stopId: step.transitDetails.stopDetails?.departureStop?.name,
        scheduledDepartTime: departureIso,
      });
      cursorMs += durationSeconds * 1000;
    }
  });

  return result;
}

export async function computeRoute(params: ComputeRouteParams): Promise<ServiceResult<RouteStep[]>> {
  // §12.2 — dev-menu "force this service to error" toggle, exercising
  // §5.1's offline fallback UX on demand instead of needing a real outage.
  if (__DEV__ && getDevOverrides().routesError) {
    return { error: getDevOverrides().routesError! };
  }

  const key = apiKey();
  if (!key) {
    return { error: "unreachable" };
  }

  const isTransit = params.mode === "bus" || params.mode === "train";
  const body: Record<string, unknown> = {
    origin: toWaypoint(params.origin),
    destination: toWaypoint(params.destination),
    // Google's Routes API rejects intermediates for TRANSIT outright ("Intermediate
    // waypoints are not supported for TRANSIT travel mode", HTTP 400 — verified against
    // the live API). Sending them would fail the whole plan, so transit journeys omit
    // waypoints entirely and route origin→destination directly; the waypoints are not
    // honoured for transit (a known limitation — see DECISIONS.md). walk/cycle/drive
    // still route through them as one leg per hop.
    intermediates: isTransit ? [] : (params.waypoints ?? []).map(toWaypoint),
    travelMode: isTransit ? "TRANSIT" : params.mode === "cycle" ? "BICYCLE" : params.mode === "drive" ? "DRIVE" : "WALK",
    languageCode: "en-US",
    units: "METRIC",
  };
  if (isTransit && params.arriveTime) {
    body.arrivalTime = params.arriveTime;
  } else {
    body.departureTime = params.departTime;
  }
  if (isTransit) {
    body.transitPreferences = {
      allowedTravelModes: params.mode === "bus" ? ["BUS"] : ["RAIL", "SUBWAY", "LIGHT_RAIL", "TRAIN"],
    };
  }

  let response: Response;
  try {
    response = await fetch(COMPUTE_ROUTES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": isTransit
          ? "routes.legs.steps.travelMode,routes.legs.steps.staticDuration,routes.legs.steps.polyline,routes.legs.steps.transitDetails"
          : "routes.legs.duration,routes.legs.staticDuration,routes.legs.polyline",
      },
      body: JSON.stringify(body),
    });
  } catch {
    return { error: "network" };
  }

  if (!response.ok) {
    return { error: response.status === 429 ? "rate-limited" : "unreachable" };
  }

  let payload: GoogleComputeRoutesResponse;
  try {
    payload = await response.json();
  } catch {
    return { error: "unreachable" };
  }

  const route = payload.routes?.[0];
  if (!route) return { error: "unreachable" };

  return { data: isTransit ? parseTransitSteps(route, params) : parseSimpleLegs(route, params) };
}

// Exported for the offline-fallback banner (§5.1) to explain *why* live
// routing didn't run, distinct from a genuine network failure.
export function hasRoutesApiKey(): boolean {
  return !!apiKey();
}
