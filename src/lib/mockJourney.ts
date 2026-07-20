// Builds a "hardcoded" Journey object from Plan-screen inputs — Phase 3
// (docs/08-build-phases.md) is explicitly about the Plan/Journey Detail UI
// looking right before Phase 4 wires real Google Routes + Open-Meteo calls,
// so legs/weather/durations here are synthesized from simple distance/speed
// assumptions and one fixed "mild Auckland day" weather reading, not fetched.
import { newId } from "../db/rowMapping";
import type {
  CarryPreference,
  Journey,
  JourneyLeg,
  RecurrenceRule,
  SavedLocation,
  TravelMode,
  WeatherSnapshot,
} from "../types";

// "hike" isn't offered by the Plan screen yet (hidden until Phase 20,
// docs/04-screens-navigation.md §4), but TravelMode includes it — mapped to
// walk's speed here purely so this lookup stays total or unreachable.
const MODE_SPEED_KPH: Record<"walk" | "cycle" | "drive" | "hike", number> = {
  walk: 5,
  cycle: 15,
  drive: 40,
  hike: 5,
};
const TRANSIT_SPEED_KPH = 25; // bus/train, including stops — mock only
const STOP_WALK_MIN = 5; // flat walk-to-stop time, same simplification as the wait-leg fallback below
const STATIONARY_WAIT_FALLBACK_MIN = 5; // §5.6 — flat fallback used when there's no live GTFS delay data (Phase 7)
const WAYPOINT_DWELL_MIN = 10;

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function mockWeather(time: string): WeatherSnapshot {
  return {
    time,
    weatherCode: 1,
    precipMm: 0,
    precipProbability: 10,
    tempC: 17,
    apparentTempC: 16,
    windKph: 12,
    windGustKph: 18,
    relativeHumidityPct: 70,
    uvIndex: 3,
    isDaylight: true,
    forecastConfidence: "high",
  };
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function indoorLeg(location: SavedLocation, startTime: Date, durationMin: number): JourneyLeg {
  return {
    id: newId(),
    mode: "indoor",
    label: location.label,
    durationMin,
    startTime: startTime.toISOString(),
    outdoor: false,
    // §3.4 — hasReliableClimateControl overrides the CLIMATE_BY_MODE default
    // guess (Phase 4/6); false forces "unconditioned", true/undefined keep
    // a plain "heated" mock guess for now.
    climate: location.hasReliableClimateControl === false ? "unconditioned" : "heated",
  };
}

function outdoorLeg(
  mode: TravelMode,
  label: string,
  startTime: Date,
  durationMin: number
): JourneyLeg {
  return {
    id: newId(),
    mode,
    label,
    durationMin,
    startTime: startTime.toISOString(),
    outdoor: true,
    weather: mockWeather(startTime.toISOString()),
  };
}

function driveLeg(label: string, startTime: Date, durationMin: number): JourneyLeg {
  return {
    id: newId(),
    mode: "drive",
    label,
    durationMin,
    startTime: startTime.toISOString(),
    outdoor: false, // enclosed in the vehicle — see mockJourney.ts's module comment
    climate: "heated",
  };
}

function transitStationaryLeg(startTime: Date): JourneyLeg {
  return {
    id: newId(),
    mode: "bus", // placeholder mode value — isStationary + waitContext carry the real meaning (§3.5)
    label: "Waiting for transit",
    durationMin: STATIONARY_WAIT_FALLBACK_MIN,
    startTime: startTime.toISOString(),
    outdoor: true,
    weather: mockWeather(startTime.toISOString()),
    isStationary: true,
    waitContext: "transit-stop",
  };
}

function transitLeg(mode: "bus" | "train", to: SavedLocation, startTime: Date, durationMin: number): JourneyLeg {
  return {
    id: newId(),
    mode,
    label: `${mode === "bus" ? "Bus" : "Train"} to ${to.label}`,
    durationMin,
    startTime: startTime.toISOString(),
    outdoor: false,
    climate: "ac",
  };
}

// One hop between two consecutive stops, expanded into however many legs
// that mode actually implies (§5, §5.6) — a single leg for walk/cycle/
// drive, or walk-to-stop + wait + the transit leg itself for bus/train.
function buildHopLegs(from: SavedLocation, to: SavedLocation, mode: TravelMode, startTime: Date): JourneyLeg[] {
  const distanceKm = haversineKm(from, to);

  if (mode === "bus" || mode === "train") {
    const walk = outdoorLeg("walk", `Walk to stop near ${to.label}`, startTime, STOP_WALK_MIN);
    const waitStart = addMinutes(startTime, STOP_WALK_MIN);
    const wait = transitStationaryLeg(waitStart);
    const transitStart = addMinutes(waitStart, STATIONARY_WAIT_FALLBACK_MIN);
    const transitDurationMin = Math.max(5, Math.round((distanceKm / TRANSIT_SPEED_KPH) * 60));
    const transit = transitLeg(mode, to, transitStart, transitDurationMin);
    return [walk, wait, transit];
  }

  if (mode === "drive") {
    const durationMin = Math.max(3, Math.round((distanceKm / MODE_SPEED_KPH.drive) * 60));
    return [driveLeg(`Drive to ${to.label}`, startTime, durationMin)];
  }

  // walk | cycle
  const speed = MODE_SPEED_KPH[mode];
  const durationMin = Math.max(3, Math.round((distanceKm / speed) * 60));
  const verb = mode === "cycle" ? "Cycle" : "Walk";
  return [outdoorLeg(mode, `${verb} to ${to.label}`, startTime, durationMin)];
}

export interface BuildJourneyInput {
  origin: SavedLocation;
  destination: SavedLocation;
  waypoints: SavedLocation[];
  departTime: string; // ISO
  mode: TravelMode;
  formal: boolean;
  carryPreference: CarryPreference;
  recurrence?: RecurrenceRule;
}

export function buildMockJourney(input: BuildJourneyInput): Journey {
  const stops = [input.origin, ...input.waypoints, input.destination];
  const legs: JourneyLeg[] = [];
  let cursor = new Date(input.departTime);

  for (let i = 0; i < stops.length - 1; i++) {
    const from = stops[i];
    const to = stops[i + 1];
    const isIntermediateStop = i > 0;
    if (isIntermediateStop) {
      legs.push(indoorLeg(from, cursor, WAYPOINT_DWELL_MIN));
      cursor = addMinutes(cursor, WAYPOINT_DWELL_MIN);
    }
    const hopLegs = buildHopLegs(from, to, input.mode, cursor);
    legs.push(...hopLegs);
    cursor = addMinutes(cursor, hopLegs.reduce((sum, leg) => sum + leg.durationMin, 0));
  }

  return {
    id: newId(),
    origin: input.origin,
    destination: input.destination,
    departTime: input.departTime,
    legs,
    recurrence: input.recurrence,
    waypoints: input.waypoints.length > 0 ? input.waypoints : undefined,
    carryPreference: input.carryPreference,
    formal: input.formal || undefined,
  };
}
