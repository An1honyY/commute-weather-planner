// Data models — see docs/03-data-models.md (Section 3) for the full spec
// this file implements, including field-by-field rationale.

// ---------- Inventory ----------

export type ClothingType = "jacket" | "midlayer" | "base" | "bottoms" | "accessory";

export interface ClothingItem {
  id: string;
  name: string;
  type: ClothingType;
  warmth: number; // 1-10 scale, Section 3.6
  waterproof: boolean;
  windproof: boolean;
  packable: boolean;
  substitutesForMidlayer?: boolean; // Section 7.12 — jacket-only
  tags?: string[];
  unavailableUntil?: string; // ISO date
  unavailableReason?: "laundry" | "repair" | "lost" | "other";
  wearsSinceClean?: number;
  lastWornAt?: string; // ISO
  needsCleaning?: boolean;
  color?: MascotSwatch; // Phase 21 only
  photoUri?: string;
}

// Phase 21 (Section 13.9) — small fixed palette, not a free hex picker
export type MascotSwatch =
  | "black" | "white" | "grey" | "navy" | "blue" | "red"
  | "orange" | "yellow" | "green" | "purple" | "pink" | "brown";

export type ShoeType = "sneaker" | "boot" | "sandal" | "formal" | "waterproof-boot";

export interface ShoeItem {
  id: string;
  name: string;
  type: ShoeType;
  waterproof: boolean;
  grip: "low" | "med" | "high";
  unavailableUntil?: string;
  unavailableReason?: "laundry" | "repair" | "lost" | "other";
  wearsSinceClean?: number;
  lastWornAt?: string;
  needsCleaning?: boolean;
  color?: MascotSwatch;
  photoUri?: string;
}

export type UmbrellaType = "compact" | "full-size" | "golf";

export interface UmbrellaItem {
  id: string;
  name: string;
  type: UmbrellaType;
  windRating: "low" | "med" | "high";
  unavailableUntil?: string;
  color?: MascotSwatch;
  photoUri?: string;
}

export type VehicleType = "car" | "bike" | "motorcycle" | "scooter" | "none";

export interface VehicleItem {
  id: string;
  name: string;
  type: VehicleType;
  weatherProtection: "full" | "partial" | "none";
  photoUri?: string;
}

export interface Inventory {
  clothing: ClothingItem[];
  shoes: ShoeItem[];
  umbrellas: UmbrellaItem[];
  vehicles: VehicleItem[];
}

// ---------- Locations ----------

export interface SavedLocation {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  icon?: string;
  isFavorite?: boolean;
  lastUsedAt?: string; // ISO
  hasReliableClimateControl?: boolean; // Section 3.4 — overrides CLIMATE_BY_MODE default
}

// Bookmarked origin→destination pair (not a fixed schedule — see RecurrenceRule)
export interface SavedRoute {
  id: string;
  label: string;
  originId: string; // SavedLocation.id
  destinationId: string; // SavedLocation.id
  preferredMode?: TravelMode;
  createdAt: string; // ISO
  lastUsedAt?: string; // ISO
}

// Section 3.4 — pinned local knowledge about a point along a route, distinct
// from SavedLocation.hasReliableClimateControl which covers a named place.
export type EnvironmentEffectType =
  | "wind-tunnel"
  | "wind-sheltered"
  | "rain-cover"
  | "sun-exposed"
  | "shaded"
  | "high-reflection";

export interface EnvironmentAnnotation {
  id: string;
  label: string;
  effect: EnvironmentEffectType;
  lat: number;
  lng: number;
  radiusM: number; // default 100m, user-adjustable
  notes?: string;
  createdAt: string; // ISO
}

// ---------- Journey / weather ----------

export type TravelMode = "walk" | "drive" | "bus" | "train" | "cycle" | "hike"; // "hike" is Phase 20

export interface WeatherSnapshot {
  time: string; // ISO
  weatherCode: number; // WMO code
  precipMm: number;
  precipProbability: number; // 0-100
  tempC: number; // Open-Meteo temperature_2m — display only, not the engine's primary input
  apparentTempC: number; // Open-Meteo apparent_temperature — the engine's actual input, Section 6.2
  windKph: number; // Open-Meteo windspeed_10m — sustained wind
  windGustKph: number; // Open-Meteo wind_gusts_10m — umbrella wind-rating check, Section 7.8
  relativeHumidityPct: number; // Open-Meteo relative_humidity_2m — debug/dev-menu only
  uvIndex: number; // Open-Meteo uv_index — Section 7.6/7.8
  isDaylight: boolean; // Open-Meteo is_day — Section 7.6/7.8
  forecastConfidence: "high" | "medium" | "low"; // derived from lead time, Section 5.3
  recentPrecipMm6h?: number; // Open-Meteo past_days — puddle-risk flagging, Section 3.4
}

export interface JourneyLeg {
  id: string;
  mode: TravelMode | "indoor";
  label: string;
  durationMin: number;
  startTime: string; // ISO
  outdoor: boolean;
  climate?: "ac" | "heated" | "unconditioned"; // set when outdoor === false
  weather?: WeatherSnapshot; // only present when outdoor === true
  polyline?: string;
  windEffect?: "amplified" | "sheltered"; // Section 3.4
  sunEffect?: "exposed" | "shaded"; // Section 3.4
  highReflection?: boolean; // Section 3.4 — composes with sunEffect === "exposed"
  rainCovered?: boolean; // Section 3.4
  puddleRisk?: boolean; // derived from weather.recentPrecipMm6h, Section 3.4
  matchedAnnotationIds?: string[];
  isStationary?: boolean; // Section 3.5, 7.9 — outdoor wait ahead of a bus/train leg
  waitContext?: "transit-platform" | "transit-stop" | "pickup-queue" | "general"; // only set when isStationary
  hikeSamples?: HikeRouteSample[]; // only set when mode === "hike" (Phase 20)
  delayMinutes?: number; // Phase 7 — AT GTFS Realtime scheduled-vs-actual delta for a bus/train leg's specific departure, Section 5.6; only set once live data is fetched, drives the live-delay pill (Section 9.3) and the preceding wait leg's durationMin
}

// Phase 20 (Section 13.8) — per-sample reading along a hike leg's route
export interface HikeRouteSample {
  distanceKm: number;
  lat: number;
  lng: number;
  elevationM: number;
  weather?: WeatherSnapshot;
}

export interface RecurrenceRule {
  daysOfWeek: number[]; // 0 = Sunday .. 6 = Saturday
  departTimeOfDay: string; // "HH:mm", local time
  active: boolean;
}

// Section 3 — widened from an original 3-point scale so calibration can
// converge more precisely (Section 7.5). Ordered coldest to warmest.
export type GearFeedback = "much_too_cold" | "too_cold" | "just_right" | "too_warm" | "much_too_warm";

// A frozen, display-only copy of what recommendGear() returned at the time
// it mattered — History (Section 4.4) reads this instead of re-running the
// live engine.
export interface RecommendationSnapshot {
  layerNames: string[];
  accessoryNames: string[];
  shoeName: string | null;
  umbrellaName: string | null;
  notes: string[];
  snapshotAt: string; // ISO
}

export interface Journey {
  id: string;
  origin: SavedLocation;
  destination: SavedLocation;
  departTime: string; // ISO
  legs: JourneyLeg[];
  recurrence?: RecurrenceRule; // present if this journey is/was created as a recurring template
  templateId?: string; // if a materialized occurrence, points back at the template Journey.id
  linkedReturnJourneyId?: string; // if one-way leg of a there-and-back pair
  feedback?: GearFeedback; // Section 4.2 — feeds the calibration loop, Section 7.5
  savedRouteId?: string; // if planned from a SavedRoute quick-pick, Section 4.3
  recommendationSnapshot?: RecommendationSnapshot; // frozen at leave-by time, Section 7.3
  waypoints?: SavedLocation[]; // ordered intermediate stops, Section 3.5/4.3.1
  carryPreference?: CarryPreference; // per-Journey override of the Settings default, Section 7.9
  formal?: boolean; // Section 4.3.1 — Section 7.10
}

// Settings-level default with a per-Journey override, Section 7.9
export type CarryPreference = "no-preference" | "avoid-spares";

// ---------- Personalization ----------

// A single local row (not per-item) — how much warmer/colder this user runs
// relative to Section 7's thresholds. Extended in 7.5.1-7.5.3 with a
// seasonal split, wind-sensitivity axis, and decay tracking — all additive
// (Section 3.1); offsetLevels/sampleCount remain the fallback whenever a
// seasonal bucket has no samples yet.
export interface WarmthCalibration {
  offsetLevels: number; // global fallback
  sampleCount: number; // total feedback events factored into offsetLevels

  // Section 7.5.1
  seasonalOffsets?: { summer: number; winter: number; shoulder: number };
  seasonalSampleCounts?: { summer: number; winter: number; shoulder: number };

  // Section 7.5.2 — independent of general warm/cold running, only ever
  // nudges the annotation-gated wind-chill delta.
  windSensitivityOffset?: number;
  windSensitivitySampleCount?: number;

  // Section 7.5.3 — read by the decay check
  lastFeedbackAt?: string; // ISO

  // Section 7.5 — gates the one-time "we noticed" toast (Section 4.2/9.1.1)
  // to the first ~3 occasions the offset actually changes; not shown again
  // after that, and not itself part of the calibration math.
  calibrationToastsShown?: number;
}

// Section 3.6 — power-user opt-in escape hatch (see DECISIONS.md 2026-07-19).
// Every field starts undefined; undefined means "use the named constant
// from Section 7 unchanged." recommendGear() reads
// `thresholds?.freezingC ?? FREEZING_C`, etc.
export interface AdvancedWarmthThresholds {
  freezingC?: number; // overrides FREEZING_C (default 2°C)
  coolUpperC?: number; // overrides COOL_UPPER_C (default 14°C)
  warmOutdoorC?: number; // overrides WARM_OUTDOOR_C (default 18°C)
}
