// Real Plan-screen pipeline — docs/05-data-wiring.md's top-level pseudocode
// and §5.1's offline/failure handling. Replaces Phase 3's mockJourney.ts:
// computeRoutes (with waypoints as intermediates) → sample outdoor legs'
// midpoints/ETAs → one batched Open-Meteo call → merge weather/climate into
// legs → persist → return.
import { computeRoute, type RoutePoint, type RouteStep } from "../services/routesService";
import { getForecast } from "../services/weatherService";
import { createJourney, findRecentJourneyBetween } from "../db/repositories/journeys";
import { newId } from "../db/rowMapping";
import { CLIMATE_BY_MODE } from "./weather";
import type { CarryPreference, Journey, JourneyLeg, RecurrenceRule, SavedLocation, TravelMode } from "../types";

const WAYPOINT_DWELL_MIN = 10;
const OFFLINE_FALLBACK_WINDOW_DAYS = 30;

function toRoutePoint(location: SavedLocation): RoutePoint {
  return { lat: location.lat, lng: location.lng, label: location.label };
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function indoorClimateFor(location: SavedLocation): "ac" | "unconditioned" {
  // §5.5's override, already folded into the base pipeline (docs/05's main
  // pseudocode, not just §5.5): false forces unconditioned; true/undefined
  // keep CLIMATE_BY_MODE's default guess.
  if (location.hasReliableClimateControl === false) return "unconditioned";
  return CLIMATE_BY_MODE.indoor;
}

function midpoint(a: { lat: number; lng: number }, b: { lat: number; lng: number }): { lat: number; lng: number } {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

// Coarse fallback, used when precise per-hop coordinates aren't available
// (transit legs, or the offline cached-structure path) — equal-weight
// interpolation across the full stop sequence by elapsed-time fraction.
// Good enough for a weather sample point; not a substitute for real route
// geometry (polyline decoding first shows up in Phase 6 for annotation
// matching).
function interpolateAlongStops(stops: { lat: number; lng: number }[], fraction: number): { lat: number; lng: number } {
  const segments = stops.length - 1;
  if (segments <= 0) return stops[0];
  const scaled = Math.min(segments, Math.max(0, fraction * segments));
  const segmentIndex = Math.min(segments - 1, Math.floor(scaled));
  const localFraction = scaled - segmentIndex;
  const a = stops[segmentIndex];
  const b = stops[segmentIndex + 1];
  return { lat: a.lat + (b.lat - a.lat) * localFraction, lng: a.lng + (b.lng - a.lng) * localFraction };
}

export interface PlanJourneyInput {
  origin: SavedLocation;
  destination: SavedLocation;
  waypoints: SavedLocation[];
  departTime: string; // ISO
  mode: TravelMode;
  formal: boolean;
  carryPreference: CarryPreference;
  recurrence?: RecurrenceRule;
  // Set when materializing today's occurrence of a recurring journey (§3,
  // Today tab) — points back at the template Journey.id this occurrence
  // was generated from.
  templateId?: string;
}

export type PlanJourneyResult =
  | { kind: "success"; journey: Journey }
  | { kind: "success-cached"; journey: Journey; cachedFromDate: string }
  | { kind: "failed" };

interface AssembledLeg {
  mode: JourneyLeg["mode"];
  label: string;
  durationMin: number;
  outdoor: boolean;
  climate?: JourneyLeg["climate"];
  isStationary?: boolean;
  waitContext?: JourneyLeg["waitContext"];
  polyline?: string;
  hopIndex?: number; // index into the ordered stop sequence this leg travels *from* — undefined when unknown (transit, cached-structure reuse)
}

// docs/05-data-wiring.md §5.5 (waypoint routing) — walk/cycle/drive get one
// Google leg per hop (routesService.parseSimpleLegs), so waypoint indoor
// dwell legs interleave cleanly at each hop boundary and each leg knows
// its exact hop for precise weather-sample midpoints. TRANSIT's flat step
// list has no such boundary once waypoints are involved, so a transit
// journey with waypoints skips generating indoor dwell legs for them
// (Google still routes through the waypoints via `intermediates` — this
// only affects whether our own leg list shows a separate indoor stop) and
// falls back to the coarser whole-journey interpolation for its outdoor
// legs. Logged in DECISIONS.md.
function stepsToAssembledLegs(steps: RouteStep[], input: PlanJourneyInput): AssembledLeg[] {
  const isTransit = input.mode === "bus" || input.mode === "train";
  const hopCount = 1 + input.waypoints.length;
  const knownHopBoundaries = !isTransit && steps.length === hopCount;

  const legs: AssembledLeg[] = [];
  let hopIndex = 0;
  steps.forEach((step, i) => {
    if (knownHopBoundaries && i > 0) {
      const waypoint = input.waypoints[i - 1];
      legs.push({
        mode: "indoor",
        label: waypoint.label,
        durationMin: WAYPOINT_DWELL_MIN,
        outdoor: false,
        climate: indoorClimateFor(waypoint),
      });
    }
    const outdoor = step.isStationary === true || step.mode === "walk" || step.mode === "cycle";
    legs.push({
      mode: step.mode,
      label: step.label,
      durationMin: step.durationMin,
      outdoor,
      climate: step.isStationary ? undefined : step.mode === "bus" || step.mode === "train" ? "ac" : undefined,
      isStationary: step.isStationary,
      waitContext: step.waitContext,
      polyline: step.polyline,
      hopIndex: knownHopBoundaries ? hopIndex : undefined,
    });
    if (knownHopBoundaries) hopIndex++;
  });
  return legs;
}

async function assembleJourney(
  steps: AssembledLeg[],
  input: PlanJourneyInput,
  stops: { lat: number; lng: number }[]
): Promise<Journey> {
  const totalDurationMin = steps.reduce((sum, s) => sum + s.durationMin, 0);
  const departMs = new Date(input.departTime).getTime();

  let cumulativeMin = 0;
  let cursor = new Date(input.departTime);
  const legs: JourneyLeg[] = [];
  const forecastRequests: { legIndex: number; lat: number; lng: number; time: string }[] = [];

  steps.forEach((step, i) => {
    const startTime = cursor.toISOString();
    const midOffsetMin = cumulativeMin + step.durationMin / 2;
    cursor = addMinutes(cursor, step.durationMin);
    cumulativeMin += step.durationMin;

    const leg: JourneyLeg = {
      id: newId(),
      mode: step.mode,
      label: step.label,
      durationMin: step.durationMin,
      startTime,
      outdoor: step.outdoor,
      climate: step.climate,
      polyline: step.polyline,
      isStationary: step.isStationary,
      waitContext: step.waitContext,
    };
    legs.push(leg);

    if (step.outdoor) {
      const point =
        step.hopIndex !== undefined
          ? midpoint(stops[step.hopIndex], stops[step.hopIndex + 1])
          : interpolateAlongStops(stops, totalDurationMin > 0 ? midOffsetMin / totalDurationMin : 0);
      forecastRequests.push({
        legIndex: i,
        lat: point.lat,
        lng: point.lng,
        time: new Date(departMs + midOffsetMin * 60_000).toISOString(),
      });
    }
  });

  // §5 — batch every outdoor leg's midpoint + ETA into one Open-Meteo call.
  if (forecastRequests.length > 0) {
    const weatherResult = await getForecast(forecastRequests.map(({ lat, lng, time }) => ({ lat, lng, time })));
    // §5.1 point 2 — Open-Meteo failing (with Routes having succeeded)
    // degrades to "conditions unknown" per leg rather than blocking the
    // whole plan; `weather` simply stays undefined.
    if ("data" in weatherResult) {
      forecastRequests.forEach((request, resultIndex) => {
        legs[request.legIndex].weather = weatherResult.data[resultIndex];
      });
    }
  }

  return {
    id: newId(),
    origin: input.origin,
    destination: input.destination,
    departTime: input.departTime,
    legs,
    recurrence: input.recurrence,
    templateId: input.templateId,
    waypoints: input.waypoints.length > 0 ? input.waypoints : undefined,
    carryPreference: input.carryPreference,
    formal: input.formal || undefined,
  };
}

async function buildFromLiveRoute(steps: RouteStep[], input: PlanJourneyInput): Promise<Journey> {
  const assembled = stepsToAssembledLegs(steps, input);
  const stops = [input.origin, ...input.waypoints, input.destination];
  return assembleJourney(assembled, input, stops);
}

async function buildFromCachedStructure(cached: Journey, input: PlanJourneyInput): Promise<Journey> {
  const assembled: AssembledLeg[] = cached.legs.map((leg) => ({
    mode: leg.mode,
    label: leg.label,
    durationMin: leg.durationMin,
    outdoor: leg.outdoor,
    climate: leg.climate,
    isStationary: leg.isStationary,
    waitContext: leg.waitContext,
    polyline: leg.polyline,
    // Hop boundaries aren't preserved in a persisted Journey's legs, so the
    // cached-structure fallback always uses the coarser whole-journey
    // interpolation regardless of original mode.
    hopIndex: undefined,
  }));
  const stops = [input.origin, ...input.waypoints, input.destination];
  return assembleJourney(assembled, input, stops);
}

export async function planJourney(input: PlanJourneyInput): Promise<PlanJourneyResult> {
  const routeResult = await computeRoute({
    origin: toRoutePoint(input.origin),
    destination: toRoutePoint(input.destination),
    waypoints: input.waypoints.map(toRoutePoint),
    mode: input.mode as RouteStep["mode"], // "hike" never reaches here — the Plan screen doesn't offer it yet
    departTime: input.departTime,
  });

  let journey: Journey | undefined;
  let cachedFromDate: string | undefined;

  if ("data" in routeResult) {
    journey = await buildFromLiveRoute(routeResult.data, input);
  } else {
    // §5.1 — on failure, look for a previously-planned Journey between the
    // same origin/destination pair within the last 30 days and reuse its
    // route structure, still fetching fresh weather for it.
    const since = new Date(Date.now() - OFFLINE_FALLBACK_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const cached = await findRecentJourneyBetween(input.origin.id, input.destination.id, since);
    if (cached) {
      journey = await buildFromCachedStructure(cached, input);
      cachedFromDate = cached.departTime;
    }
  }

  if (!journey) return { kind: "failed" };

  await createJourney(journey);
  return cachedFromDate ? { kind: "success-cached", journey, cachedFromDate } : { kind: "success", journey };
}
