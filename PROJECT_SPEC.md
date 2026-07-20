# Commute Weather Planner — Build Spec

A React Native app that plans a journey (walking / driving / public transit), overlays
per-leg weather conditions, and recommends specific items from the user's own
wardrobe/gear — not generic advice — based on route conditions and indoor climate
exposure (offices, supermarkets, buses, trains).

This doc is written for a coding agent to scaffold and build the project in phases.
Follow the phase order in Section 8 — don't build the recommendation engine before
inventory + journey data exist to feed it.

---

## 1. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Expo (React Native)**, TypeScript | Managed workflow — avoids native build pain for maps/location |
| Navigation | `@react-navigation/native` (bottom tabs + native stack) | |
| Maps | `react-native-maps` (Google provider on Android, Apple on iOS) | Needs a Google Maps SDK key for Android + polylines |
| Local storage | `expo-sqlite` (preferred) or `@react-native-async-storage/async-storage` for simpler key-value | Inventory + saved locations are structured/relational → SQLite is worth it |
| State | Zustand (lightweight, no boilerplate) | Context is fine too if the agent prefers |
| HTTP | `fetch` or `axios`, wrapped by `@tanstack/react-query` | Query/cache layer for dedup, retry, and background refetch (Section 5.4) |
| Env/secrets | `expo-constants` + `.env` via `react-native-dotenv` or Expo's `app.config.ts` extra field | Never commit real keys |
| Location | `expo-location` | For "current location" as journey origin |
| Notifications | `expo-notifications` | Scheduled local "leave by" alerts (Section 7.3) — local only, no push server needed for v1 |
| Sharing / files | `expo-file-system` + `expo-sharing` + `expo-document-picker` | Data export/import (Section 10.3) |
| Gear photos | `expo-image-picker` + `expo-image-manipulator` | Capture/resize gear photos (Section 3.3) |
| Zip (export bundle) | `react-native-zip-archive` | Bundles `data.json` + gear photos into one export file (Sections 3.3, 10.3) |
| Testing | Jest via the `jest-expo` preset | Unit tests for `classifyWeather`, `recommendGear`, and friends (Section 11) |
| Crash reporting | Sentry's Expo SDK (or equivalent) | Opt-in only, initialized conditionally — never on by default (Section 10.5) |
| Vector graphics | `react-native-svg` | Mascot base art + paper-doll clothing overlays (Section 13.9, Phase 21 only) |
| Animation | `react-native-reanimated` | Drives the mascot's idle/wave/wiggle/shiver transforms (Section 13.9); also usable for any other UI motion, but this is its first real need |

---

## 2. External APIs

| Purpose | API | Cost | Auth |
|---|---|---|---|
| Route / directions | Google Routes API (`routes.googleapis.com/directions/v2:computeRoutes`) | Free monthly threshold, card required | API key |
| Weather (hourly, per lat/lng) | Open-Meteo (`api.open-meteo.com/v1/forecast`) | Free, no key, 10k calls/day non-commercial | none |
| Auckland public transit | Auckland Transport GTFS Realtime (`api.at.govt.nz/gtfs/v3/...`) | Free | subscription key from dev-portal.at.govt.nz |

Store all three as env vars: `GOOGLE_ROUTES_API_KEY`, `AT_SUBSCRIPTION_KEY`. Open-Meteo needs none.

**Billing safety net for Google Routes:** the free threshold plus a card on
file means a bug (retry loop, a runaway background re-fetch in Section 5.2,
etc.) can generate a real bill, not just a rate-limit error. Set this up in
Google Cloud Console **before** the key is used anywhere outside local dev:

- A budget with an alert threshold, starting low — **$5 NZD** is a sane v1
  default for a single-user app, since real usage should stay near $0 on the
  free tier — sent to the developer's own email/console notifications.
- This is deliberately a soft alert, not a hard cutoff that disables the key:
  a disabled key mid-development just looks like a mystery outage. Raise the
  threshold (e.g. to $25 or $50) once real usage patterns are known and the
  proxy-based key protection in Section 10.1 is in place; treat the $5
  starting value as a placeholder to revisit, not a permanent ceiling.
- Budget alerts are a GCP Console setting, not app code — note the project/
  billing-account name here once created so it's easy to find and adjust:
  `Billing → Budgets & alerts` in the same GCP project as the Routes API key.

Weather conditions are classified from Open-Meteo's `weather_code` (WMO code), not
just precipitation mm — see Section 6 for the mapping table.

Also request Open-Meteo's `uv_index` and `is_day` hourly fields in the same
call (no extra request needed) — they populate `WeatherSnapshot.uvIndex` and
`.isDaylight` and feed the sun/darkness gear logic in Section 7.6. Open-Meteo's
own forecast accuracy degrades the further out the requested time is; Section
5.3 defines how that's surfaced to the user rather than presented with false
precision.

**Also request `apparent_temperature`, `wind_gusts_10m`, and
`relative_humidity_2m`** in the same call (Section 6.2). Auckland's climate
has two properties that make raw `temperature_2m` and `windspeed_10m` alone
an unreliable basis for the recommendation engine:

- **Auckland is windy year-round** (averaging ~14–18 km/h, one of the
  windier NZ centres) and **consistently humid** (mid-to-high 70s% relative
  humidity even in the driest months) — both meaningfully affect how a given
  air temperature actually feels, and neither is captured by `temperature_2m`
  on its own. Rather than hand-building a wind-chill/humidity approximation
  from scratch, request Open-Meteo's `apparent_temperature` field — an
  already-validated feels-like figure computed from temperature, wind,
  humidity, and solar radiation together — and use *that* as the engine's
  primary input (Section 7). See Section 6.2 for exactly how this changes
  the engine's structure.
- **Umbrella survival is a gust question, not a sustained-wind question.**
  `windspeed_10m` (sustained wind) is the right field for describing general
  conditions, but a gust is what actually inverts an umbrella. Request
  `wind_gusts_10m` separately and use it specifically for the umbrella
  wind-rating check (Section 7.8) rather than reusing sustained wind for
  both purposes.

### 2.1 Regional scope (v1 is Auckland-only — say so explicitly)

Two parts of this app are hard-coded to Auckland, not just "likely to work
best there," and the app should be honest about that rather than let a
non-Auckland user discover it by trial and error:

- **Public transit is Auckland-only.** The AT GTFS Realtime integration only
  covers Auckland Transport's network. Walk/drive/cycle modes work anywhere
  Google Routes has coverage, but bus/train legs have no live-departure data
  (or any GTFS feed at all) outside Auckland.
- **Season detection assumes the Southern Hemisphere** (`getSeason()`,
  Section 6.1) — Dec–Feb is hardcoded as summer. This is correct for Auckland
  and wrong for a Northern Hemisphere user; it isn't derived from device
  locale or location.
- **v1 fix**: on first launch, if `expo-location`'s current position (or the
  address entered for "Home" during onboarding, Section 4.1) resolves to a
  country other than New Zealand, show a one-time non-blocking notice:
  "Commute Weather Planner is tuned for Auckland — walking/driving directions
  and weather will work anywhere, but bus/train times and seasonal gear
  advice may be off." Don't block onboarding on this, just set expectations.
- **Store listing**: the App Store / Play Store description (Section 10.4)
  should state the Auckland transit scope up front rather than leave it to a
  1-star review to surface it.

### 2.2 Single-user scope (v1 is one wardrobe, one person — say so explicitly)

The same honesty principle as 2.1 applies here: `Inventory` and
`WarmthCalibration` (Section 3) are both singular, app-wide constructs, not
because multi-person support was overlooked, but because it's a genuinely
different data model — every `ClothingItem`/`ShoeItem`/etc. would need an
`ownerId`, `WarmthCalibration` would need to become a table keyed by owner
instead of a single row, and `Journey` would need a "who's traveling" field
that touches nearly every part of Sections 3–9. That's the same scale of
change as Section 13.7's cloud-sync phase, not a quick bolt-on, so it's
explicitly out of scope for v1 and every phase in this document rather than
something a coding agent should try to half-implement along the way.

- **v1 fix**: state this plainly in the app's About/Settings copy —
  "Commute Weather Planner is built for one person's wardrobe and one
  commute at a time" — next to the theme picker introduced in Section 9.1,
  so it's disclosed rather than discovered when a second person's jacket
  shows up in someone else's recommendation.
- **If pursued later**: it deserves its own fully-specced phase (data
  model, wiring, screens) the same way Section 13.7 treats cloud sync, not
  a field added to `Inventory` in passing.

---

## 3. Data models

Put these in `src/types/index.ts`.

```ts
// ---------- Inventory ----------

export type ClothingType = "jacket" | "midlayer" | "base" | "bottoms" | "accessory"; // "bottoms" added (Section 7.13) — trousers/leggings, evaluated independently of the base/midlayer/jacket stack since legwear doesn't "layer" the way torso items do

export interface ClothingItem {
  id: string;
  name: string;              // "Blue rain shell", "Grey wool cardigan"
  type: ClothingType;
  warmth: number;             // 1-10 scale (Section 3.6) — 1 = barely warmer than a t-shirt, 10 = heaviest winter coat owned. Widened from an earlier 1-5 scale specifically so genuinely different items don't collide on the same value (a pair of thin cotton trousers and a mid-weight cardigan both used to round to the same "2"). Migrating existing data: additive per Section 3.1 — backfill `warmth = warmth * 2` in the migration function, never drop/rename the column.
  waterproof: boolean;
  windproof: boolean;
  packable: boolean;          // can be easily carried/removed mid-journey
  substitutesForMidlayer?: boolean; // Section 7.12 — only meaningful on type "jacket". Set on an item that's already insulated enough to do a midlayer's job on its own (e.g. a rain shell with a built-in thin puffer lining). When true and this item's own `warmth` already meets the leg's target, `recommendGear()` skips asking for a separate midlayer underneath it. Ignored for non-jacket types.
  tags?: string[];             // free-form subtype hints, e.g. ["gloves"], ["sunglasses"], ["hat", "reflective", "socks"] for accessories (Section 7.6); ["cycling"] on a jacket/midlayer/bottoms item lets pickLayer() prefer it for cycle legs (Section 7.9); ["formal"] lets pickLayer() prefer it when Journey.formal is set (Section 7.10) — all quick-select chips in the Gear CRUD add/edit form, not free text, so the engine can rely on matching against them
  unavailableUntil?: string;   // ISO date; set when in the laundry / lost / being repaired — excluded from recommendations until this date passes (Section 7.7)
  unavailableReason?: "laundry" | "repair" | "lost" | "other"; // Section 7.7/7.16 — which quick action set unavailableUntil, so the Gear list can show "In the laundry — back Thursday" instead of a generic "Unavailable." Undefined on legacy rows that only have unavailableUntil (pre-dating this field) — treat as "other" for display purposes, no migration needed since it's purely additive and optional.
  wearsSinceClean?: number;    // Section 7.16 — count of completed journeys this item was recommended (and presumed worn) for since it was last marked clean. Starts undefined/0 for a new item.
  lastWornAt?: string;         // Section 7.16 — ISO departTime of the most recent completed Journey this item was recommended for.
  needsCleaning?: boolean;     // Section 7.16 — set by the engine (not the user) once wearsSinceClean crosses WASH_REMINDER_WEAR_COUNT, or immediately after one journey flagged as sweaty conditions. Drives a Gear-list badge with a one-tap "mark as washing" action (Section 4, Gear CRUD) that clears this, resets wearsSinceClean to 0, and — if the user confirms — also sets unavailableUntil/unavailableReason via the same laundry quick action.
  color?: MascotSwatch;        // Section 13.9 (Phase 21) — one of a small fixed swatch set (not a free color picker, Section 9.7), used only to tint the mascot companion's paper-doll overlay for this item. Purely cosmetic — recommendGear() (Section 7) never reads this field. Added via Phase 21's own additive migration (Section 3.1), the same precedent hikeSamples/HikeRouteSample already set for Phase 20 — not part of the Phase 1 schema. Undefined for any item added before Phase 21 or left unset since; the mascot renders a neutral placeholder shape rather than guessing.
  photoUri?: string;           // local file:// path under documentDirectory — see Section 3.3 for capture/storage rules
}

// Section 13.9 (Phase 21) — a small fixed palette rather than a free hex
// picker, so every mascot overlay tint stays visually coherent and legible
// against the mascot's own base art regardless of what the user picks.
export type MascotSwatch =
  | "black" | "white" | "grey" | "navy" | "blue" | "red"
  | "orange" | "yellow" | "green" | "purple" | "pink" | "brown";

export type ShoeType = "sneaker" | "boot" | "sandal" | "formal" | "waterproof-boot";

export interface ShoeItem {
  id: string;
  name: string;
  type: ShoeType;
  waterproof: boolean;
  grip: "low" | "med" | "high"; // traction in wet/slippery conditions
  unavailableUntil?: string;    // see ClothingItem.unavailableUntil
  unavailableReason?: "laundry" | "repair" | "lost" | "other"; // see ClothingItem.unavailableReason — "laundry" reads oddly for shoes in code but the Gear-list copy shows "Being cleaned" for shoes vs "In the laundry" for clothing (Section 9.1.2-adjacent copy), same underlying reason value
  wearsSinceClean?: number;     // see ClothingItem.wearsSinceClean (Section 7.16)
  lastWornAt?: string;          // see ClothingItem.lastWornAt
  needsCleaning?: boolean;      // see ClothingItem.needsCleaning
  color?: MascotSwatch;         // see ClothingItem.color (Section 13.9) — tints the mascot's shoe overlay
  photoUri?: string;             // see Section 3.3
}

export type UmbrellaType = "compact" | "full-size" | "golf";

export interface UmbrellaItem {
  id: string;
  name: string;
  type: UmbrellaType;
  windRating: "low" | "med" | "high"; // survives high wind without inverting
  unavailableUntil?: string;          // see ClothingItem.unavailableUntil
  color?: MascotSwatch;                // see ClothingItem.color (Section 13.9) — tints the mascot's umbrella overlay when carried
  photoUri?: string;                   // see Section 3.3
}

export type VehicleType = "car" | "bike" | "motorcycle" | "scooter" | "none";

export interface VehicleItem {
  id: string;
  name: string;
  type: VehicleType;
  weatherProtection: "full" | "partial" | "none"; // car=full, bike=none
  photoUri?: string;                                // see Section 3.3
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
  label: string;       // "Home", "Work", "Gym"
  address: string;
  lat: number;
  lng: number;
  icon?: string;        // maps to an emoji/icon key in the UI
  isFavorite?: boolean;  // pins it to the top of the Locations list and the quick-pick row on Plan (Section 4.3)
  lastUsedAt?: string;   // ISO; bumped whenever picked as an origin/destination, used to sort non-favorites by recency
  hasReliableClimateControl?: boolean; // true/false overrides CLIMATE_BY_MODE's default guess (Section 6) for this specific place — "this office has no AC" is `false`; undefined means "use the mode default." Only meaningful when this location is a journey's origin or destination (Section 3.4).
}

// A bookmarked origin→destination pair the user takes often but that
// doesn't run on a fixed schedule (unlike a RecurrenceRule) — "the way to
// the gym," not "the 8am commute." Selecting one on the Plan screen
// pre-fills origin/destination/mode and still runs a fresh computeRoutes +
// Open-Meteo call, since a SavedRoute has no legs/weather of its own.
export interface SavedRoute {
  id: string;
  label: string;            // user-given, e.g. "Fast way to the gym"
  originId: string;         // SavedLocation.id
  destinationId: string;    // SavedLocation.id
  preferredMode?: TravelMode; // optional default filter passed to Google Routes
  createdAt: string;         // ISO
  lastUsedAt?: string;       // ISO; bumped on each use, drives quick-pick ordering (Section 4.3)
}

// User-pinned local knowledge about a specific *point along a route* —
// distinct from SavedLocation.hasReliableClimateControl above, which
// covers a single named place (an office, a shop). An annotation covers a
// stretch of outdoor route that isn't itself a destination — an alley,
// a bridge, a covered arcade — see Section 3.4 for how these are matched
// against a journey's legs.
export type EnvironmentEffectType =
  | "wind-tunnel"     // amplifies felt wind speed, e.g. a channel between tall buildings
  | "wind-sheltered"  // dampens felt wind speed, e.g. a low-rise side street
  | "rain-cover"      // covered walkway/arcade/underpass — informational, doesn't change the umbrella decision (Section 7.8)
  | "sun-exposed"     // no shade at all — direct sun reads as warmer here
  | "shaded"          // tree/building shade — direct-sun warming doesn't apply here even on a clear day
  | "high-reflection"; // sand/water/snow — amplifies effective UV beyond the raw forecast reading; composes additively with sun-exposed rather than overriding it (Section 7.8)

export interface EnvironmentAnnotation {
  id: string;
  label: string;        // user-given, e.g. "Queen St wind tunnel", "Britomart arcade"
  effect: EnvironmentEffectType;
  lat: number;
  lng: number;
  radiusM: number;       // how far from (lat, lng) this applies — default 100m, user-adjustable
  notes?: string;         // optional free text, shown when the annotation fires
  createdAt: string;      // ISO
}

// ---------- Journey / weather ----------

export type TravelMode = "walk" | "drive" | "bus" | "train" | "cycle" | "hike"; // "hike" is a Section 7.11/13.8 (Phase 20) extension — multi-hour, elevation-aware, see HikeRouteSample below

export interface WeatherSnapshot {
  time: string;             // ISO timestamp
  weatherCode: number;      // WMO code from Open-Meteo
  precipMm: number;
  precipProbability: number; // 0-100
  tempC: number;             // Open-Meteo `temperature_2m` — raw air temperature, kept for display and for the apparentTempC-vs-tempC divergence note (Section 6.2), but NOT the engine's primary input
  apparentTempC: number;     // Open-Meteo `apparent_temperature` — the engine's actual input to warmthLevelFromTemp() (Section 6.2, 7); already folds in ambient wind, humidity, and solar radiation for the general area, which raw tempC alone can't capture
  windKph: number;           // Open-Meteo `windspeed_10m` — sustained wind, used for the general "how it feels to walk" picture; NOT used for umbrella-survival (see windGustKph)
  windGustKph: number;       // Open-Meteo `wind_gusts_10m` — used specifically for the umbrella wind-rating check (Section 7.8), since a gust is what physically inverts an umbrella, not sustained wind
  relativeHumidityPct: number; // Open-Meteo `relative_humidity_2m` — not read directly by the engine (already folded into apparentTempC), kept for debug/dev-menu visibility (Section 12.2) so a "why did this feel colder" question is answerable without guessing
  uvIndex: number;           // Open-Meteo `uv_index` — drives sunglasses/hat suggestions (Section 7.6) and sun-warming (Section 7.8)
  isDaylight: boolean;       // Open-Meteo `is_day` — drives reflective-gear suggestions (Section 7.6) and sun-warming (Section 7.8)
  forecastConfidence: "high" | "medium" | "low"; // derived from lead time at fetch time (Section 5.3), not from Open-Meteo directly
  recentPrecipMm6h?: number; // cumulative precip (mm) over the preceding 6h, from Open-Meteo's `past_days` param — drives puddle-risk flagging (Section 3.4), not shown directly in the UI
}

export interface JourneyLeg {
  id: string;
  mode: TravelMode | "indoor"; // "indoor" = inside a building (office, shop)
  label: string;                // "Walk to Kingsland Station", "Western Line to Britomart"
  durationMin: number;
  startTime: string;            // ISO
  outdoor: boolean;
  climate?: "ac" | "heated" | "unconditioned"; // set when outdoor === false
  weather?: WeatherSnapshot;    // only present when outdoor === true
  polyline?: string;            // encoded polyline segment, for map rendering
  windEffect?: "amplified" | "sheltered"; // set when this leg's polyline intersects a wind-tunnel/wind-sheltered EnvironmentAnnotation (Section 3.4)
  sunEffect?: "exposed" | "shaded";        // set when it intersects a sun-exposed/shaded annotation
  highReflection?: boolean;                 // set when it intersects a high-reflection annotation (Section 3.4) — composes with sunEffect === "exposed" rather than replacing it, see Section 7.8
  rainCovered?: boolean;                    // set when it intersects a rain-cover annotation
  puddleRisk?: boolean;                     // derived from weather.recentPrecipMm6h at fetch time (Section 3.4) — footwear only, see Section 7.8
  matchedAnnotationIds?: string[];          // which EnvironmentAnnotation(s) applied, for the "why" note on Journey Detail (Section 9.3)
  isStationary?: boolean;                   // true for a stationary outdoor wait (transit platform, pickup queue) inserted ahead of a bus/train leg — see Section 3.5 and 7.9; excluded from warmup-discount eligibility since no body heat is generated while standing still
  waitContext?: "transit-platform" | "transit-stop" | "pickup-queue" | "general"; // only set when isStationary is true, for leg-label copy on Journey Detail (Section 9.3)
  hikeSamples?: HikeRouteSample[];          // only set when mode === "hike" (Section 3.5, 13.8) — replaces single-midpoint weather sampling with multiple elevation-aware samples along the leg
}

// A single weather+elevation reading along a hike leg's route — hike legs
// are sampled at intervals (Section 5.7) rather than at one midpoint,
// since temperature/wind at elevation can differ meaningfully from the
// trailhead forecast and a multi-hour leg isn't well represented by one
// point. See Section 13.8 (Phase 20).
export interface HikeRouteSample {
  distanceKm: number;   // distance along the route from the leg's start
  lat: number;
  lng: number;
  elevationM: number;    // from Google Routes' elevation data or a fallback elevation API
  weather?: WeatherSnapshot; // sampled independently at this point, not shared across the whole leg
}

// A journey can recur (e.g. the Mon-Fri commute) so the user isn't
// re-planning the same Home→Work trip every morning. Recurrence only
// pins origin/destination/departTime-of-day/mode — legs, weather, and
// gear recommendations are still (re)computed fresh each occurrence,
// since conditions change day to day even if the route doesn't.
export interface RecurrenceRule {
  daysOfWeek: number[];  // 0 = Sunday .. 6 = Saturday
  departTimeOfDay: string; // "HH:mm", local time — combined with each occurrence's date
  active: boolean;         // lets the user pause a recurrence without deleting it
}

// Widened from an original 3-point too_warm/too_cold/just_right scale
// (Section 7.5) — a flat "too warm" collapses "slightly overdressed" and
// "sweating the whole way" into one signal, which limits how precisely
// WarmthCalibration.offsetLevels (below) can converge. Ordered coldest to
// warmest so UI code can index into it positionally if needed.
export type GearFeedback = "much_too_cold" | "too_cold" | "just_right" | "too_warm" | "much_too_warm";

// A frozen, display-only copy of what recommendGear() actually returned at
// the time it mattered (leave-by time, or plan time if the journey has
// already passed by the time it's viewed). History (Section 4.4) reads
// this instead of re-running the live engine, so a journey from 3 months
// ago still shows what was *actually* recommended even if the matched
// ClothingItem has since been deleted, marked unavailable, or renamed.
export interface RecommendationSnapshot {
  layerNames: string[];      // resolved item names, or fallback text if none matched — flattened for storage/display
  accessoryNames: string[];
  shoeName: string | null;
  umbrellaName: string | null;
  notes: string[];
  snapshotAt: string;         // ISO — when this was frozen, shown in History as "recommended as of…"
}

export interface Journey {
  id: string;
  origin: SavedLocation;
  destination: SavedLocation;
  departTime: string; // ISO
  legs: JourneyLeg[];
  recurrence?: RecurrenceRule;   // present if this journey was created from/as a recurring template
  templateId?: string;           // if this is a materialized *occurrence*, points back at the recurring Journey.id it was generated from
  linkedReturnJourneyId?: string; // if this is a one-way leg of a there-and-back pair, points at its counterpart
  feedback?: GearFeedback;       // set post-journey via the prompt in Section 4.2; feeds the calibration loop in Section 7.5
  savedRouteId?: string;         // if planned by picking a SavedRoute quick-pick (Section 4.3), points back at it
  recommendationSnapshot?: RecommendationSnapshot; // frozen at leave-by time (Section 7.3) or on first History view of a past journey missing one
  waypoints?: SavedLocation[];    // ordered intermediate stops between origin and destination (Section 3.5, 4.3.1) — e.g. bank → pharmacy → supermarket. Absent/empty for a normal point-to-point journey.
  carryPreference?: CarryPreference; // overrides the Settings-level default (Section 9.1) for this Journey only — Section 7.9
  formal?: boolean;               // set via the Plan screen toggle (Section 4.3.1) — Section 7.10
}

// Settings-level default with a per-Journey override, same pattern as
// themePreference (Section 9.1) — "I don't want to carry a spare layer
// today," most relevant to someone moving between classes/meetings with a
// full bag. Section 7.9.
export type CarryPreference = "no-preference" | "avoid-spares";

// ---------- Personalization ----------

// A single local row (not per-item) — how much warmer or colder this
// specific user tends to run relative to the warmth-level thresholds in
// Section 7. Starts at 0 and nudges by WARMTH_CALIBRATION_STEP (Section 7.5)
// each time the user gives feedback. Persisted in SQLite as one row, no id
// needed. Extended in Sections 7.5.1-7.5.3 with a seasonal split, a
// separate wind-sensitivity axis, and decay tracking — all additive
// (Section 3.1): `offsetLevels`/`sampleCount` remain the fallback used
// whenever a seasonal bucket has no samples yet, so nothing reading the
// old two fields breaks.
export interface WarmthCalibration {
  offsetLevels: number; // global fallback — e.g. -1 means "run warm, recommend one level lighter than the raw calc." Read whenever the current season's bucket in seasonalOffsets has zero samples.
  sampleCount: number;   // total feedback events factored into offsetLevels — shown in Settings for transparency, not used in the calc itself

  // Section 7.5.1 — same semantics as offsetLevels, tracked separately per
  // Season (Section 6.1) so "I run warm" learned from summer feedback
  // doesn't silently carry over into a genuine winter cold snap.
  seasonalOffsets?: { summer: number; winter: number; shoulder: number };
  seasonalSampleCounts?: { summer: number; winter: number; shoulder: number };

  // Section 7.5.2 — a separate, smaller-range dimension for wind
  // sensitivity specifically, independent of general warm/cold running.
  // Only ever nudges the annotation-gated wind-chill delta (Section 7.8);
  // never touches the base warmthLevel calculation. Clamped to
  // ±WIND_SENSITIVITY_OFFSET_CLAMP (Section 7.5.2).
  windSensitivityOffset?: number;
  windSensitivitySampleCount?: number;

  // Section 7.5.3 — ISO timestamp of the most recent feedback event of any
  // kind, read by the decay check so a calibration value from last winter
  // doesn't sit unexamined and unchanged into next summer.
  lastFeedbackAt?: string;
}
```

Recurring journeys are stored as a single `Journey` row with `recurrence`
set and no `templateId` (it *is* the template). The Today tab materializes
today's occurrence(s) at read time — by evaluating each active recurring
template against today's date — rather than writing a new DB row per day;
this avoids an ever-growing table of near-duplicate rows. A materialized
occurrence only gets persisted as its own row (with `templateId` set) once
its weather/gear data has actually been fetched, so it can be cached for
the rest of the day instead of re-planned on every app open.

`linkedReturnJourneyId` is set when the user creates a return leg from the
Journey Detail screen (Section 4) — it's a plain reciprocal link, not a
separate "round trip" entity, so each leg still works as a normal `Journey`
on its own.

### 3.1 Schema versioning & migrations

The schema in this section doesn't arrive all at once — Section 8's build
phases add tables/columns incrementally (e.g. `RecommendationSnapshot` isn't
needed until Phase 5, `RecurrenceRule` materialization details firm up in
Phase 5, notification-related fields in Phase 8). A user who updates the app
mid-development (or across any future release) needs their existing local
SQLite data to survive that, so don't leave migration to whatever the next
`CREATE TABLE` happens to do:

- Maintain a single `schema_version` integer row (own table,
  `PRAGMA user_version` works too) written on every app launch.
- Each schema change ships as a numbered, ordered migration function
  (`migrations/001_initial.ts`, `002_add_saved_routes.ts`, …) that runs only
  if `schema_version < N`, then bumps the stored version. Run pending
  migrations once at app startup, before any screen reads from SQLite.
- **v1 policy: additive-only migrations.** New tables and new nullable/
  defaulted columns are fine (`ALTER TABLE … ADD COLUMN … DEFAULT NULL`).
  Never drop a column or rename one in place — if a field is genuinely
  replaced, add the new column, backfill from the old one in the migration
  function, and leave the old column unused rather than dropping it. This
  keeps every migration safe to run against real user data without a backup/
  restore step.
- Migrations are exactly the kind of thing a coding agent should write a
  quick test for (Section 11) — run each migration against a fixture DB from
  the previous version and assert the expected columns/rows exist after.

### 3.2 Indices

The schema above doesn't specify indices, and several columns are queried
by often enough that a table scan would start to show up as real lag once
History (Section 4.4) has a few hundred rows:

- `Journey(departTime)` — Today's materialization query and History's
  reverse-chronological read both filter/sort on this.
- `SavedLocation(lastUsedAt)` — the Locations list's recency sort (Section
  4.3) reads this on every screen focus.
- `Journey(originId)`, `Journey(destinationId)` — used when checking for a
  reusable cached route in the offline-planning fallback (Section 5.1).
- `SavedRoute(lastUsedAt)` — same recency-sort pattern as `SavedLocation`,
  for the Plan screen's chip row (Section 4.3).

Add these as part of the initial schema in Phase 1 (Section 8) rather than
retrofitting once History has enough rows to make the scan noticeable —
cheap to add now, annoying to diagnose later as "the app got slower for no
reason."

### 3.3 Gear photos

The core pitch of this app — *your* jacket, not generic advice — is more
convincing when the recommendation card shows the actual jacket, not just
its name. Add photo capture to the Gear CRUD flow (Section 4, item 4):

- Each add/edit form for `ClothingItem` / `ShoeItem` / `UmbrellaItem` /
  `VehicleItem` gets an optional photo well at the top, backed by
  `expo-image-picker` (camera or library — offer both via an action sheet,
  since gear is often photographed after the fact rather than in the
  moment).
- On capture, resize/compress with `expo-image-manipulator` (cap at 800px
  on the long edge, JPEG quality ~0.7) before saving — full camera-resolution
  photos are unnecessary for a thumbnail-sized UI use and would otherwise
  bloat the export/import JSON's referenced file set (Section 10.3) and
  device backup size (Section 10.3).
- Copy the processed image into
  `${FileSystem.documentDirectory}gear-photos/{itemId}.jpg` (not just
  storing the camera-roll URI) so the photo survives the user deleting it
  from their camera roll, and store that path in `photoUri`. Overwrite in
  place on re-capture rather than accumulating orphaned files; delete the
  file when the gear item itself is deleted.
- **Export/Import (Section 10.3) update**: the JSON export can't inline
  binary image data cleanly, so extend the export to a zip (still via
  `expo-file-system` + `expo-sharing`) containing `data.json` plus a
  `gear-photos/` folder, rather than a bare JSON file. Import reverses this:
  unzip, upsert `data.json` as before, and copy photo files back into
  `documentDirectory`. Update the pre-submission checklist item (10.6) for
  export/import round-trip testing to explicitly include an item with a
  photo, not just text fields.
- Missing photo → fall back to a simple type-based icon (jacket/shoe/
  umbrella/vehicle glyph), never a broken-image placeholder — most items
  won't have one, especially right after onboarding, and that's fine.
- Display: a small thumbnail (~40px, `border`-radius per Section 9.2's 8px
  pill radius) next to the item name wherever gear is listed — the Gear CRUD
  list, and notably the gear recommendation card on Journey Detail (Section
  9.3) and the compact Today card (Section 9.4), which is the actual payoff
  moment for this feature.

### 3.4 Environment annotations & location climate overrides

Weather from Open-Meteo describes the general area; it doesn't know that a
specific office has no AC, that a specific alley funnels wind, or that a
specific arcade keeps you dry. Two separate mechanisms cover this, matched
to how specific the knowledge actually is:

- **`SavedLocation.hasReliableClimateControl`** — for a single named place
  the user already has saved (an office, a gym). A boolean override, not a
  free-text field, because the only thing the recommendation engine needs
  to know is "does this override the CLIMATE_BY_MODE default guess," not
  arbitrary detail.
- **`EnvironmentAnnotation`** — for a stretch of route that isn't a
  destination at all (an alley, a bridge, an arcade). A point + radius, not
  tied to any single `Journey`, since the same wind tunnel applies to every
  future journey that happens to walk through it.

**Matching annotations to a leg** (runs during the wiring in Section 5.5):
for each outdoor leg with a `polyline`, decode it to a point list (the same
decode already needed for map rendering, Section 9.3), and for each saved
`EnvironmentAnnotation`, compute the minimum distance from any polyline
point to `(annotation.lat, annotation.lng)`. If that minimum distance is
`<= annotation.radiusM`, the leg intersects it. This is a simple point-radius
check, not full polyline-geometry intersection — accurate enough for
walking-scale annotations (tens to low-hundreds of meters) without pulling
in a geometry library.

- If a leg intersects annotations of the *same* effect category (e.g. two
  overlapping wind-tunnel pins), apply the effect once — it's boolean, not
  additive — but record all matched ids in `matchedAnnotationIds`.
- If a leg intersects **conflicting** annotations in the same category
  (e.g. a `sun-exposed` pin and a `shaded` pin both in range — a plausible
  edge case near a tree line), the **closer** one by distance wins; still
  record both ids so Journey Detail's leg note can be honest about the
  ambiguity ("near both a sun-exposed and a shaded spot you've marked") if
  the agent wants to surface that level of detail, though showing just the
  winning effect is also fine for v1.
- Only outdoor legs (`walk`/`cycle`/`drive` with a polyline) are checked —
  annotations describe open-air route conditions, not indoor climate,
  which is what `hasReliableClimateControl` is for instead.

**Puddle risk** doesn't need annotation matching at all — it's derived
directly from `WeatherSnapshot.recentPrecipMm6h` (Section 5.5) against a
threshold (Section 7.8), since "did it rain recently here" is a time-based
signal, not a place-based one.

**High-reflection is additive, not exclusive**, unlike the same-category
conflict rule above: a leg matching both a `sun-exposed` and a
`high-reflection` annotation (a beach, most obviously — sand and water both
reflect) sets `sunEffect: "exposed"` *and* `highReflection: true`, and
Section 7.8's UV-threshold check treats the two together as one composed
signal rather than stacking two separate warmth deltas. A `high-reflection`
annotation with no accompanying `sun-exposed`/`shaded` pin nearby simply has
no effect — reflection amplifies direct sun, it isn't a light source on its
own.

See Section 7.8 for exactly how `windEffect`, `sunEffect`, `highReflection`,
`rainCovered`, and `puddleRisk` feed into `recommendGear()`, and Section 4.5
for the annotation-management UI.

### 3.5 Stationary legs, multi-stop waypoints, and hike sampling

Three more scenario-driven extensions to the leg/journey model, each
covered in depth where they're used (engine logic in Section 7, wiring in
Section 5) — this subsection just establishes the shapes:

- **Stationary outdoor waits** (`JourneyLeg.isStationary`, `.waitContext`):
  covers standing on an open platform waiting for a delayed train, or
  waiting in a pickup queue — outdoor exposure with no walking, and
  therefore no body-heat generation, which existing legs don't distinguish.
  Only ever set on a `bus`/`train` leg's immediately-preceding wait, never
  on a `walk`/`cycle`/`drive` leg. See Section 5.6 for how `durationMin` is
  derived from AT GTFS Realtime delay data, and Section 7.9 for how the
  engine treats it as an aggravating factor rather than a neutral one.
- **Multi-stop waypoints** (`Journey.waypoints`): an ordered list of
  `SavedLocation`s between origin and destination — a bank → pharmacy →
  supermarket errand run planned and tracked as one `Journey` with one
  leave-by notification and one gear recommendation, rather than several
  disconnected point-to-point journeys. Each waypoint contributes a short
  indoor leg (using the exact `hasReliableClimateControl` override already
  described above, applied at N points instead of 2) plus a short outdoor
  leg to the next stop. See Section 5.5 for wiring and Section 4.3.1 for
  the Plan-screen UI.
- **Hike sampling** (`JourneyLeg.hikeSamples`, `HikeRouteSample`): a `hike`
  leg (Section 3, `TravelMode`) replaces the single-midpoint weather
  sampling every other outdoor leg uses with several samples along the
  route, each carrying its own elevation and independently-fetched weather
  — a multi-hour hike gaining several hundred meters of elevation can see
  meaningfully different temperature and wind at the top than the
  trailhead forecast alone would suggest. Full spec, including why this is
  sequenced as a post-v1 phase rather than folded into the v1 core, is in
  Section 13.8 (Phase 20).

### 3.6 Advanced warmth threshold overrides (power-user opt-in)

Section 7's `FREEZING_C` / `COOL_UPPER_C` / `WARM_OUTDOOR_C` constants are
sane Auckland-tuned defaults, and the feedback-driven calibration loop
(Section 7.5) is the intended way most users correct for running warm or
cold — Section 7.5 explicitly rejected exposing raw threshold sliders on
the reasoning that "nobody will tune correctly." A small minority of users
will still want direct control over the thresholds themselves rather than
a learned offset, so this is added as an explicit, narrow, opt-in escape
hatch — off/collapsed by default, tucked behind an "Advanced" disclosure in
Settings (Section 9.1), not a first-class control. This is a deliberate
reversal of Section 7.5's stated position for a specific subset of users,
recorded as such in `DECISIONS.md` rather than silently contradicting it.

```ts
// Single row, alongside WarmthCalibration. Every field starts undefined —
// undefined means "use the named constant from Section 7 unchanged."
// recommendGear() reads `thresholds?.freezingC ?? FREEZING_C`, etc.; the
// constants in Section 7 remain the source of truth for anyone who never
// opens the Advanced section.
export interface AdvancedWarmthThresholds {
  freezingC?: number;     // overrides FREEZING_C (default 2°C, Section 7)
  coolUpperC?: number;    // overrides COOL_UPPER_C (default 14°C)
  warmOutdoorC?: number;  // overrides WARM_OUTDOOR_C (default 18°C)
}
```

See Section 9.1 for the required in-UI explanation copy for each of these
three fields — they must not be presented as bare numeric inputs with only
a constant name, since "COOL_UPPER_C" means nothing to a user who isn't
reading this spec.

### 3.7 Wardrobe rotation & wear tracking

Without this, an inventory with several equally-suitable jackets always
recommends the same one — `pickLayer()`'s sort is deterministic given the
same inputs, so the "best" match wins every time with no notion of
"already worn three times this week, try a different one" or "this one
needs a wash." Two related but distinct mechanisms cover this, both
additive to the existing `unavailableUntil` mechanism (Section 7.7) rather
than replacing it:

- **`unavailableReason`** (`ClothingItem`/`ShoeItem`, above) — the existing
  "mark unavailable until…" action (Section 7.7) gains a reason picker
  (Laundry / Repair / Lost / Other) instead of being a single undifferentiated
  action, so the Gear list can show *why* an item is greyed out ("In the
  laundry — back Thursday") rather than just "unavailable." Each reason
  gets its own sensible default turnaround when the picker is opened
  (laundry a couple of days, repair closer to a week, lost left open-ended)
  — see Section 7.16 for the exact defaults and Section 4/9 for the UI.
- **`wearsSinceClean` / `lastWornAt` / `needsCleaning`** — a lightweight
  rotation signal. Every time an item is the one actually resolved (not
  `fallbackText`) for a *completed* Journey, `wearsSinceClean` increments
  by one. Once it crosses `WASH_REMINDER_WEAR_COUNT` (Section 7.16), or
  immediately after a single journey the engine judges as "sweaty
  conditions" (sustained walking/cycling exertion in warm weather — the
  same signals already computed for the warmup discount, Section 7.9),
  `needsCleaning` is set and a badge appears on that item in the Gear list.
  This is a *reminder*, not an automatic exclusion — a flagged item still
  gets recommended until the user acts on it (or ignores it indefinitely;
  nothing forces a wash). Tapping the badge's "mark as washing" action
  applies the laundry `unavailableUntil`/`unavailableReason` combination
  above and resets `wearsSinceClean` to 0 in one step. Full mechanism,
  including exactly when wear is recorded (never inside `recommendGear()`
  itself), is in Section 7.16.
- **Deliberately not built**: this is a wear-count reminder, not a
  fairness-weighted rotation algorithm that actively deprioritizes a
  recently-worn item in `pickLayer()`'s sort ahead of it needing a wash.
  The two ideas sound similar but solve different problems — "recommend
  variety" vs. "tell me when to wash something" — and the spec only ever
  asked for the latter. If active rotation is wanted later, it's a change
  to `pickLayer()`'s sort itself and deserves its own pass rather than
  being folded in here.

---

## 4. Screens & navigation

Bottom tab navigator with 4 tabs. Today and Plan are the screens opened on
nearly every session — register them as the initial route and let React
Navigation lazy-load Locations, Gear, and the History/Settings stack screens
(`lazy: true`, the default for tab screens not currently focused) so cold
start only pays for the two screens actually seen first.

1. **Today** (home/dashboard) — a **"Right now" card** pinned above the
   journey list (Section 4.2), then today's saved/upcoming journeys, each as
   a card showing route summary + weather badges + top clothing
   recommendation, with a **"Leaving now" quick-action button** on whichever
   journey card is next up. Tapping a card opens the full Journey Detail
   screen. Materializes today's occurrences of any recurring journeys
   (Section 3) alongside one-off journeys, in departure-time order. Empty
   state (see 4.1) if there are none. A small clock/history icon in the
   header opens the **History** stack screen (Section 4.4). Once Phase 21
   ships, the mascot companion (Section 13.9, 9.7) sits directly above the
   "Right now" card, reflecting current conditions and today's actual
   recommended colors.
2. **Plan** — journey planner: origin/destination pickers (autocomplete against
   saved locations first — favorites (Section 4.3) surfaced above the rest —
   then free text via Google Places, debounced ~300ms so autocomplete fires
   once typing pauses rather than on every keystroke — Places billing is
   per-request, so this isn't just a UX nicety, it's a cost control that
   pairs with the budget alert in Section 2), a **"Saved routes" quick-pick
   row** above the pickers (Section 4.3) that pre-fills origin/destination/mode
   from a `SavedRoute` in one tap, date/time picker, mode selector
   (including **`hike`**, Section 13.8/Phase 20 — hidden behind a "More
   modes" overflow until that phase ships, so it doesn't clutter the
   day-to-day walk/drive/bus/train/cycle selector), an optional
   **"Add a stop"** affordance between origin and destination for
   multi-stop errands (writes `Journey.waypoints`, Section 3.5/4.3.1), a
   **"Repeats" control** (off / pick days of week — writes a
   `RecurrenceRule`, Section 3), a **"Plan return trip too" toggle** (creates
   a second Journey with swapped origin/destination and sets
   `linkedReturnJourneyId` on both), a **"Save this route" toggle**
   (writes a `SavedRoute` alongside the Journey, Section 4.3), a
   **"Formal occasion" toggle** (writes `Journey.formal`, Section 4.3.1/7.10),
   and a **carry-preference override chip** (defaults to the Settings-level
   `CarryPreference`, Section 9.1/7.9, overridable per trip), "Plan journey"
   button → navigates to Journey Detail. Date/time defaults to "now" and
   origin defaults to Home (if set) whenever Plan is opened fresh (not
   mid-edit) — the most common case is planning from home right now, and
   defaulting to it removes two taps from the single most frequent flow in
   the app.
3. **Locations** — CRUD list of `SavedLocation`s, favorites (`isFavorite`,
   Section 4.3) pinned in their own section at the top, the rest sorted by
   `lastUsedAt` descending. Add via map pin drop or address search. Each has
   a label + optional icon + a star toggle for favoriting, plus a
   **"Reliable AC/heating here?"** three-way control (Yes / No / Don't
   override) in the add/edit form, backed by
   `hasReliableClimateControl` (Section 3.4) — "No" is the "this office has
   no AC" case. Empty state (4.1) prompts adding "Home" and "Work" first,
   since almost every journey starts from one of those. A small map-pin
   icon in the header opens the **Local knowledge** stack screen (Section
   4.5) for managing `EnvironmentAnnotation`s.
4. **Gear** — inventory manager, sub-tabbed by `Vehicles / Clothing / Shoes /
   Umbrellas`. Each is a simple CRUD list (add/edit/delete) matching the data
   models in Section 3. Clothing add/edit uses the same 1-10 warmth slider
   (with the "barely warmer than a t-shirt" / "heaviest winter coat you
   own" anchor labels) and, for jackets, the same
   `substitutesForMidlayer` toggle described in Section 4.1's onboarding
   step 4 — one shared component, not a separate implementation for the
   onboarding checklist vs. the full CRUD form. The Clothing sub-tab's
   `type` picker gains a "Bottoms" option (Section 3, 7.13) alongside
   jacket/midlayer/base/accessory — trousers and leggings use the same
   add/edit form (warmth slider, waterproof/windproof toggles, tag chips)
   as any other clothing item, not a separate flow.
   - **"Mark unavailable until…"** (Section 7.7) is a reason picker
     (Laundry / Repair / Lost / Other), each defaulting to its own
     turnaround (Laundry: 2 days, Repair/Other: 3 days, Lost: no date) that
     the user can still adjust. The Gear list shows the specific reason
     next to the return date ("In the laundry — back Thursday") rather than
     a generic "Unavailable."
   - **Wash-reminder badge** (Section 7.16): any item with `needsCleaning`
     set shows a small badge in its Gear-list row — "Worn 4 times since
     last wash" or, if flagged by a single sweaty trip rather than a wear
     count, "Might need a wash after that last trip" — with a one-tap
     "Mark as washing" action that applies the Laundry unavailability
     above and resets the wear count in one step. This is a reminder, not
     an automatic removal from recommendations — an unactioned badge
     doesn't stop the item being picked.
   - **Mascot color swatch** (Section 3, 9.7) — only appears in the
     Clothing/Shoes/Umbrellas add/edit forms starting Phase 21, once the
     mascot companion ships; entirely absent before then. Fully optional,
     with a "Skip" option alongside the 12 fixed swatches.
   Empty state (4.1) per sub-tab.

Plus stack screens reached from Today or Plan:

- **Journey Detail** — the core screen, fully specified in Section 9 (design
  tokens + component layout — no external mockup files needed). Map view up
  top — showing route polylines plus any `EnvironmentAnnotation` pins that
  fall near the route (Section 9's tokens define their marker styling), with
  a long-press on the map opening the "Add a note about this spot" sheet
  from Section 4.5 pre-filled with the tapped coordinates — a severe-weather
  advisory banner when `Recommendation.severeWeatherAdvisory` is set
  (Section 7.14, 9.3), gear recommendation card, journey leg list. Any leg
  with a `matchedAnnotationIds` entry or `puddleRisk` shows a small note
  badge next
  to that leg (Section 9.3) surfacing the relevant label ("Wind tunnel on
  Queen St") or puddle note. If a `linkedReturnJourneyId` exists, show a
  small "Return trip" link/card at the bottom navigating to the counterpart
  Journey — and if that return leg's conditions differ meaningfully from
  the outbound leg (e.g. crossing the `WARM_OUTDOOR_C` or `FREEZING_C`
  thresholds from Section 7 in either direction), surface a one-line
  "conditions change for your return" note rather than silently repeating
  the same gear card.
- **History** — reverse-chronological list of past `Journey`s (Section 4.4).
- **Local knowledge** — list/manage screen for `EnvironmentAnnotation`s
  (Section 4.5).
- **Onboarding** (first-run only, see 4.1).

### 4.1 Onboarding & empty states

Recommendations are meaningless against an empty `Inventory`, so first-run
UX matters more here than in a typical CRUD app:

- **First launch** (no `Inventory` rows and no `SavedLocation` rows at all):
  a short 5-step onboarding stack, skippable at every step but defaulting
  forward:
  1. Location permission priming screen — explain *why* ("so we can use
     your current location as a starting point") before triggering the OS
     permission dialog, since a bare OS prompt with no context has a much
     higher deny rate.
  2. "Add Home and Work" — a minimal 2-field version of the Locations
     add-flow, pre-labeled.
  3. **Live demo card** — before asking for any gear, make one real
     Open-Meteo call for the just-granted (or skipped) location and render
     an actual "Right now" card (Section 4.2) with today's real conditions,
     but with placeholder gear slots reading "If you owned a rain shell,
     we'd tell you to grab it here" instead of a real recommendation. This
     is the payoff-before-effort moment — it shows what the app *does*
     with real, current data before asking the user to do any setup work,
     rather than asking for gear entry on faith. If location was skipped in
     step 1, use Auckland's coordinates as a fallback demo location and
     label the card "Example — Auckland" so it's clearly not personalized
     yet.
  4. "Add a few gear basics" — a short checklist-style add flow (not the
     full Gear CRUD screen) for one jacket, one pair of shoes, one
     umbrella — the minimum needed for the recommendation engine to return
     real items instead of `fallbackText` on the very first journey. A
     fourth, clearly-marked-optional entry for bottoms/trousers (Section
     3, 7.13) is offered too, but skippable without the same "this is the
     minimum" framing as the first three — most journeys don't trigger the
     bottoms slot at all (Section 7.13's narrow thermal/waterproof
     triggers), so it's less urgent than the always-relevant jacket/shoes/
     umbrella trio. Each entry offers the optional photo capture from
     Section 3.3 right inline (skippable per-item), since this is the
     moment the step 3 card's placeholder gets replaced with something real
     and it's worth letting that replacement include a photo immediately
     rather than a follow-up trip to Gear later.
     - **Opens with a one-tap self-report question** (Section 7.5.1),
       before any gear entry: "Do you tend to run warm, cold, or about
       average?" — three buttons (Warm / Average / Cold). This seeds
       `WarmthCalibration.offsetLevels` (and all three `seasonalOffsets`
       buckets, Section 3) at -1/0/+1 respectively, so the very first
       recommendation the user sees already reflects a self-declared
       starting point rather than the flat default — the feedback loop
       (Section 7.5) still refines it from there. One line of context
       under the question: "Helps us get your first few recommendations
       right — you can fine-tune this anytime from how a trip actually
       felt." Skippable, defaulting to "Average" (offset 0).
     - **The jacket entry's warmth field is a 1-10 slider** (Section 3.6),
       not a 5-point picker, labeled at both ends so the scale means
       something without reading a spec: "1 · barely warmer than a
       t-shirt" and "10 · heaviest winter coat you own," with the
       in-between values unlabeled (the two anchors are enough context —
       see Section 9.1 for the exact copy pattern reused everywhere this
       slider appears). Every other clothing item's warmth field in the
       full Gear CRUD screen (Section 4, item 4) uses the same slider and
       the same two anchor labels for consistency.
     - **A "This is also warm enough to skip a midlayer" toggle** appears
       under the warmth slider whenever the item's `type` is `"jacket"`
       (`ClothingItem.substitutesForMidlayer`, Section 3.6/7.12), off by
       default, with one line of context: "Turn this on if this jacket is
       insulated enough on its own — like a rain shell with a built-in
       thin puffer lining. We won't ask you to add anything underneath it
       when it's picked." Hidden entirely for non-jacket types rather than
       shown-and-disabled.
  5. Crash-reporting opt-in (Section 10.5) — a single toggle, defaulted
     **off**, with one line explaining what it does and that it's changeable
     later in Settings. Skipping this step leaves it off, same as declining
     it explicitly.
  A user can skip straight through and land on an empty Today tab; that's
  fine, but see below for what that empty state should do. If the resolved
  Home address (step 2) or current location falls outside New Zealand, show
  the regional-scope notice from Section 2.1 once, after onboarding
  completes rather than as its own step — it's informational, not a
  decision the user needs to make.
- **Today tab, empty (no journeys yet)**: primary CTA button straight to
  Plan, not just descriptive text.
- **Today tab, journeys exist but Inventory is empty/sparse**: still show
  the journey cards, but the gear slots show their `fallbackText` with a
  visible "Add to Gear →" affordance inline, instead of a silent blank —
  don't make the user go hunting in the tab bar to figure out why
  recommendations look thin.
- **Locations / Gear tabs, empty**: an illustration-free, single-line
  prompt + CTA button per screen ("No shoes yet — Add your first pair"),
  matching the pattern above rather than a generic "No data" message.

### 4.2 Right now, leaving now, and post-journey feedback

Not every use of this app starts from a planned Journey, and a planned
Journey doesn't end the app's usefulness the moment you walk out the door —
these three pieces close both gaps:

- **"Right now" card**: doesn't require a Journey at all. Uses
  `expo-location`'s current position, makes a single Open-Meteo call for
  that lat/lng (no Google Routes call — there's no route to compute), and
  runs it through `classifyWeather()` (Section 6) plus a **reduced**
  version of `recommendGear` that only has one "leg" to reason about — no
  AC-contrast or warmup-discount logic applies (those need multiple legs to
  compare against), just current temp/precip/UV/darkness. Refreshes on tab
  focus, not continuously, to avoid draining battery/quota. This is the
  card someone checks before a dog walk or a trip to the shops that was
  never going to be "planned" in the first place.
  - **Calibration on the reduced path** (Section 7.5, worth stating
    explicitly since it's easy to assume the "reduced" label means "no
    calibration"): `resolveWarmthOffset()` — global/seasonal offset,
    §7.5.1 — and any `AdvancedWarmthThresholds` override (§3.6) apply
    exactly as they do on a full Journey, using today's actual date to
    resolve the season. The hot-weather note (§7.15) applies too — it's a
    single `apparentTempC` check with no dependency on having multiple
    legs. The wind-sensitivity axis (§7.5.2), bottoms (§7.13), and the
    severe-weather advisory (§7.14) do NOT apply here, and for a more
    precise reason than "reduced": all three key off a `JourneyLeg.mode`
    (walk/cycle/hike) and, for wind-sensitivity, a route-matched
    `EnvironmentAnnotation` — and the reduced path never constructs a real
    `JourneyLeg` with a travel mode at all, since there's no planned trip
    to derive one from, just a raw "how does it feel right now" weather
    snapshot for the user's current coordinates. Wear tracking (§7.16)
    does *not* fire from this card at all — it only records wear against a
    completed planned `Journey`, not an ad hoc "Right now" check, since
    there's no journey to freeze a `RecommendationSnapshot` against or
    trigger the leave-by point from.
- **"Leaving now" quick action**: appears on the Today card for whichever
  journey has the nearest upcoming `departTime`. Tapping it does two things
  immediately — cancels that journey's scheduled leave-by notification
  (Section 7.3, it's redundant now) and opens Journey Detail directly, so
  the one-tap path from "I'm heading out" to "here's exactly what to grab"
  skips the tab navigation entirely. This is the shortcut for the daily
  recurring commute the "Repeats" control (Section 4) already set up — the
  route is already known, so this is purely about removing taps, not
  re-planning anything.
- **Post-journey feedback prompt**: once a Journey's `departTime` +
  total `durationMin` across its legs has passed, the next time the user
  opens that Journey's card (or the app, if it's still "today"), show a
  low-friction one-line prompt — "How was the gear call for your commute
  today?" with five tap targets in a single row (much too cold / too cold
  / just right / too warm / much too warm, per `GearFeedback`, Section 3;
  Section 9.3's layout keeps these compact enough to fit five rather than
  three without crowding). Skippable with no penalty, never a modal that
  blocks other interaction, and never asked twice for the same journey.
  Writes to `Journey.feedback` and feeds the calibration loop in
  Section 7.5 — the two "much too" ends move the calibration offset twice
  as far as the adjacent plain "too" options (Section 7.5).

### 4.3 Favorite locations & saved routes

Two related but distinct shortcuts — a favorite is a place, a saved route is
a trip between two places:

- **Favorite locations**: any `SavedLocation` can be starred
  (`isFavorite`, Section 3). Favorites appear pinned above the rest of the
  Locations list and are the first options offered in the Plan screen's
  origin/destination autocomplete, before recency-sorted (`lastUsedAt`)
  non-favorites and before free-text Google Places results. There's no cap
  on favorite count, but the UI should keep the pinned section visually
  distinct (e.g. a thin `border`-colored divider) rather than let it blend
  into the recency-sorted list below it once it grows past a few entries.
- **Saved routes**: created two ways — explicitly via the "Save this route"
  toggle on the Plan screen at journey-creation time, or after the fact from
  a Journey Detail screen's overflow menu ("Save as a route"). A `SavedRoute`
  stores only `originId`/`destinationId`/`preferredMode` — no date, time, or
  weather — so it stays valid indefinitely, unlike a specific planned
  `Journey`. Displayed on the Plan screen as a horizontal chip row above the
  manual pickers, ordered by `lastUsedAt` descending (most recently used
  first, not alphabetical — this is a speed shortcut, not a directory).
  Tapping a chip pre-fills origin/destination/mode and drops the user
  straight into the date/time picker rather than re-navigating them through
  autocomplete. Deleting a `SavedRoute` never deletes the `Journey`s that
  were planned from it (`Journey.savedRouteId` just becomes a dangling
  reference — harmless, since History (4.4) reads from the `Journey`
  directly and doesn't need the `SavedRoute` to still exist).
- Both favorites and saved routes are simple CRUD-adjacent, no network calls
  of their own — they only ever supply inputs to the existing Google
  Routes/Open-Meteo flow (Section 5), never bypass it.

### 4.3.1 Multi-stop waypoints, formal occasion, and carry preference

Three small Plan-screen additions, grouped here because they're all
one-tap trip-level context rather than a new screen or flow of their own —
each just changes how the existing engine (Section 7) resolves a
recommendation for this specific `Journey`:

- **Add a stop**: tapping "Add a stop" between the origin and destination
  pickers inserts a `SavedLocation` autocomplete row (same favorites-first
  pattern as origin/destination, Section 4.3), appendable multiple times to
  build an ordered `Journey.waypoints` list — a bank → pharmacy →
  supermarket run planned and tracked as one trip. See Section 3.5 for the
  data shape and Section 5.5 for how each waypoint gets its own indoor leg
  plus a short outdoor leg to the next stop. Removing a stop just removes
  its row; there's no separate "waypoints" screen, since this only ever
  matters at plan time for one trip.
- **Formal occasion toggle**: a plain on/off switch, off by default,
  labeled "Formal occasion" — not buried in an advanced section, since it's
  the same one-tap weight as the existing mode selector. When on, it sets
  `Journey.formal` and changes how `recommendGear()` weighs shoe and layer
  candidates (Section 7.10) — dress shoes over grippier-but-casual ones,
  an umbrella over a bulky added layer.
- **Carry-preference chip**: a small chip next to the mode selector
  reading either "No preference" or "Avoid spares," defaulting to whatever
  is set in Settings (Section 9.1) and overridable for this trip only via a
  single tap that cycles the two states. Setting it to "Avoid spares" tells
  `recommendGear()` (Section 7.9) not to recommend a packable/removable
  layer even where the engine would otherwise pick one — useful for
  someone moving between classes or meetings with a full bag who won't
  actually carry a spare regardless of what's suggested.

### 4.4 History

A reverse-chronological, read-only list of past `Journey`s (any journey
whose `departTime` + total leg duration has already passed), reached from
the Today tab's header icon (Section 4):

- **List view**: one compact row per journey — date, route summary, and the
  top layer name from `recommendationSnapshot` (Section 3) if one exists.
  If an older journey predates this feature and has no snapshot, fall back
  to re-running `recommendGear` against current inventory and label it
  "recomputed" rather than presenting it as what was actually recommended
  at the time — don't silently blur that distinction.
- **Detail view**: tapping a row opens a read-only variant of Journey
  Detail (Section 9.3) — same layout, but with the leave-by notification
  controls, "Leaving now" action, and "Plan return trip" toggle all hidden,
  since none of those apply to something that already happened. The
  post-journey feedback strip (4.2) still shows if feedback wasn't already
  given, since History is exactly where someone is likely to notice and
  fill it in retroactively.
- **No separate storage**: History is a query (`departTime` + duration <
  now, ordered descending), not a new data model — it reads the same
  `Journey` rows everything else does. No pagination-heavy infinite scroll
  needed for v1; a simple "load more" at the bottom past the first ~30 rows
  is enough, since local SQLite reads are cheap.
- **Retention**: keep history indefinitely by default — it's a personal log,
  not a cache, and the export flow (Section 10.3) already gives the user a
  way to back it up or move it. If storage growth ever becomes a real
  concern post-v1, that's a Settings-level "clear history older than…"
  action, not an automatic silent deletion.

### 4.5 Local knowledge (environment annotations)

Two entry points, since discovery and management have different natural
homes:

- **Add, in context**: long-press anywhere on the Journey Detail map
  (Section 4, "Journey Detail" bullet) opens a bottom sheet pre-filled with
  the tapped coordinates: effect type (`wind-tunnel` / `wind-sheltered` /
  `rain-cover` / `sun-exposed` / `shaded` — five icon+label buttons, single
  select), a label field (placeholder text varies by effect, e.g. "Name this
  spot… (e.g. 'Queen St wind tunnel')"), a radius slider (50–300m, default
  100m, with the affected circle previewed live on the map underneath the
  sheet), and an optional notes field. Saves an `EnvironmentAnnotation` and
  immediately re-runs the annotation-matching for the current journey's legs
  (Section 3.4) so the effect is visible on this same Journey Detail screen
  without navigating away.
- **Manage, as a list**: the "Local knowledge" stack screen (reached from
  the Locations tab header, per Section 4) shows every saved annotation as a
  row — effect icon, label, radius, and a small static map thumbnail
  centered on it — with swipe-to-delete and tap-to-edit (same sheet as
  above, minus the "pre-filled from a map tap" part; editing repositions via
  a small embedded map instead). This is the screen for reviewing/pruning
  what's accumulated over time, since the in-context add flow has no
  browse/edit affordance of its own.
- **Empty state** (4.1 pattern): "No local knowledge yet — long-press
  anywhere on a journey's map to mark a windy corner, a covered walkway, or
  a sunny stretch."
- **No per-journey scoping**: annotations are global, not tied to the
  journey they were created from — a wind tunnel on a street doesn't stop
  being one for a different route that happens to pass through it. This is
  the reason the data model (Section 3.4) doesn't reference a `Journey.id`.

---

## 5. Screen-to-data wiring

```
Plan screen
  → user picks origin/destination (+ optional waypoints, Section 5.5) + time
  → call Google Routes API, passing waypoints as intermediates if present
    → get steps (mode, duration, polyline) per leg
  → sample each leg's midpoint (lat/lng) + ETA at that point
  → batch those points into ONE Open-Meteo call (include past_days=1 for
    recentPrecipMm6h, Section 5.5)
  → merge weather into JourneyLeg[] for outdoor legs
  → for indoor legs (offices, shops, transit vehicles, or waypoint stops),
    default `climate` from the CLIMATE_BY_MODE table in Section 6 — no
    weather API call needed — then apply that SavedLocation's
    `hasReliableClimateControl` override if set (Section 5.5)
  → match each outdoor leg's polyline against saved EnvironmentAnnotations,
    stamp windEffect/sunEffect/highReflection/rainCovered/matchedAnnotationIds
    (Section 5.5)
  → if any leg mode is bus/train, call AT GTFS Realtime for live departure/delay
    info scoped to the relevant stop/route, merge into that leg, and insert a
    preceding isStationary wait leg sized off any reported delay (Section 5.6)
  → save resulting Journey object, navigate to Journey Detail
```

### 5.1 Planning offline / when Google Routes is unreachable

Unlike *viewing* an already-planned journey (Section 8, Phase 8 covers that
fallback), *planning a new one* has a hard dependency on a live
`computeRoutes` call — there's no cached route for a trip that's never been
planned before. Define this explicitly rather than leaving it to whatever
the fetch call happens to throw:

1. On `computeRoutes` failure (network error or non-2xx), check for a
   previously-saved `Journey` between the same origin/destination pair
   (exact `SavedLocation.id` match) within the last 30 days.
   - **Match found**: offer to reuse its cached `legs[].polyline` /
     `durationMin` structure with a visible "Using a saved route from
     [date] — may not reflect current conditions" banner, then still attempt
     a fresh Open-Meteo call for weather (Open-Meteo has no route
     dependency, so it may succeed even when Routes doesn't).
   - **No match**: show a clear "Can't plan a new route right now — check
     your connection" state with a retry button. Do not silently fail or
     show an empty Journey Detail screen.
2. If Open-Meteo specifically fails but Routes succeeds, fall back to
   "conditions unknown" per leg (`weather: undefined`) rather than blocking
   the whole plan — the recommendation engine (Section 7) already treats
   legs without `weather` as excluded from its temp/severity calculations,
   so gear recommendations degrade gracefully to shoes/umbrella-only with a
   note ("Couldn't fetch weather — showing route only").
3. AT GTFS Realtime failures never block planning — transit legs simply omit
   the live-delay pill (Section 9.3 already specifies this as "omit, don't
   placeholder").

### 5.2 Forecast drift — re-checking before departure

A journey planned the night before is only as good as last night's
forecast. Weather forecasts routinely shift overnight, so the app
re-fetches rather than trusting the plan-time snapshot:

1. For any Journey with a future `departTime`, schedule a background
   re-fetch of Open-Meteo (route/polyline don't need re-fetching — only
   weather does) at a fixed lead time before departure: **3 hours out** for
   same-day journeys, and again at **30 minutes out** as a final check.
   Use `expo-task-manager` + `expo-background-fetch` for the 3-hour check
   (OS-scheduled, not guaranteed to the minute) and a foreground check on
   app open as a supplement, since background fetch timing isn't reliable
   enough to be the only trigger.
2. Compare the new `WeatherSnapshot[]` against the originally-saved one per
   leg. If the change is enough to flip the recommendation output — a
   different `warmthLevel` (Section 7), a newly-required umbrella, or
   `acContrast` toggling — update the stored `Journey.legs[].weather` and
   re-run `recommendGear`.
3. If the recommendation changed, update the already-scheduled leave-by
   notification (Section 7.3) in place using the same `identifier`, and
   change its body to lead with what's different: "Forecast changed:
   pack a rain shell too" rather than repeating the full original message.
4. If nothing material changed, don't notify again — silently refresh the
   stored data. The user should only hear from the app when something is
   actually different from what they last saw.

### 5.3 Forecast confidence for far-future journeys

Forecast reliability drops the further out the requested time is — Open-Meteo
is generally solid inside ~48 hours and increasingly a rough guess past
5-7 days. Don't present a journey planned for next Tuesday with the same
visual confidence as one departing in two hours:

```ts
function forecastConfidence(departTime: string, fetchedAt: string): "high" | "medium" | "low" {
  const leadHours = (new Date(departTime).getTime() - new Date(fetchedAt).getTime()) / 3_600_000;
  if (leadHours <= 48) return "high";
  if (leadHours <= 120) return "medium";
  return "low";
}
```

Stamp this onto `WeatherSnapshot.forecastConfidence` (Section 3) at fetch
time. Journey Detail (Section 9.3) shows a small "forecast may still
change" note for `medium`/`low` confidence, and — combined with 5.2 above —
this is exactly the case where the pre-departure re-fetch matters most, so
make sure a `low`-confidence journey is re-checked again as it moves inside
the 48-hour `high` window, not just at the fixed 3-hour/30-minute marks.

### 5.4 Performance: caching, prefetching, optimistic writes

The data flow above is correct but says nothing about *when* it runs
relative to the user tapping something — that gap is most of what makes an
app feel slow even when every individual call is fast:

- **Shared query/cache layer.** Wrap the Routes/Open-Meteo/AT GTFS calls in
  TanStack Query (`@tanstack/react-query`) rather than bespoke `fetch` calls
  per screen. This gives request deduping for free (bouncing between Plan
  and Journey Detail for the same journey shouldn't refire the same
  `computeRoutes` call), a natural home for the retry/fallback behavior
  already specified in 5.1 (`retry`, `onError`) instead of reimplementing it
  per screen, and `staleTime`/background-refetch semantics that fit the
  forecast-drift re-check in 5.2 more cleanly than a manually scheduled
  timer for the foreground-check case.
- **Prefetch on app foreground, not on tab tap.** The "Right now" card
  (Section 4.2) and the next-up Today journey card's weather both currently
  read as fetch-on-focus. Kick both off as soon as the app returns to the
  foreground (`AppState` listener) instead of waiting for the Today tab to
  actually be tapped — by the time the user looks at the screen, the
  request is already in flight or done, not starting fresh.
- **Optimistic local writes for anything SQLite-only.** Favoriting a
  location, marking gear unavailable (7.7), giving post-journey feedback
  (4.2) — none of these have a network dependency. Update local state
  immediately, persist in the background, and roll back only if the write
  itself fails (which on local SQLite is rare and near-instant to detect).
  These are the most-tapped interactions in the app and should never show a
  spinner.
- **A `src/services/` layer**, one module per external API
  (`routesService.ts`, `weatherService.ts`, `transitService.ts`), each
  exposing a consistent typed result shape (`{ data } | { error:
  "network" | "unreachable" | "rate-limited" }`) rather than letting each
  screen interpret raw fetch errors differently. This is what makes 5.1's
  fallback behavior implementable once and reused everywhere it applies,
  and it's the natural seam to mock in the unit tests from Section 11 and
  the dev-menu failure toggles from Section 12.2.

### 5.5 Environment annotations & location overrides — wiring

Three separate pieces of local knowledge get folded into the same
Plan-screen wiring pass, each cheap enough to not need its own network call:

- **Recent precipitation (puddle risk)**: request `past_days=1` on the same
  Open-Meteo call already being made (no extra request), and read the
  hourly `precipitation` values for the 6 hours immediately before "now"
  (not the journey's future departure/arrival time — puddle risk is about
  current ground conditions, regardless of when the journey happens later
  today). Sum them into `recentPrecipMm6h` once per journey and stamp it
  onto every outdoor leg's `WeatherSnapshot` — this is deliberately a
  single citywide-ish value reused across legs rather than computed
  per-leg-location, which is an acceptable v1 simplification since legs
  within one journey are rarely far enough apart for recent rain history to
  differ meaningfully between them.
- **Location climate override**: after the default `climate` is set from
  `CLIMATE_BY_MODE` (Section 6) for each indoor leg — the journey's
  origin/destination *and*, when present, any `Journey.waypoints` stop
  (Section 3.5) — check that `SavedLocation`'s `hasReliableClimateControl`:
  `false` → force `climate = "unconditioned"`; `true` → leave the default
  as-is (it already assumes working climate control); `undefined` → leave
  the default as-is. Waypoint stops use exactly the same override
  mechanism as origin/destination — there's no separate code path.
- **Route annotation matching**: for each outdoor leg with a `polyline`,
  run the point-radius check from Section 3.4 against all saved
  `EnvironmentAnnotation`s (load the full set from SQLite once per Plan
  session — expected to be at most a few dozen rows, cheap to hold in
  memory rather than querying per-leg) and stamp `windEffect` / `sunEffect`
  / `highReflection` / `rainCovered` / `matchedAnnotationIds` accordingly,
  per the additive `high-reflection` composition rule in Section 3.4.
- **Waypoint routing**: when `Journey.waypoints` is non-empty, pass each
  waypoint's `(lat, lng)` to Google Routes as an ordered `intermediates`
  entry on the same `computeRoutes` call already being made (Google Routes
  supports this natively — no second API call, no change to Section 10.1's
  billing/key-restriction posture). The returned route naturally segments
  into origin→waypoint1, waypoint1→waypoint2, …, waypointN→destination legs
  instead of a single origin→destination pair; everything downstream
  (weather sampling, annotation matching, indoor-leg climate defaults)
  treats each of those segments as an ordinary leg, since a waypoint stop
  is just another indoor leg by the point this step runs.

All of the above run synchronously against already-fetched data — no
additional network round trips beyond the `past_days` parameter and the
`intermediates` addition already folded into the existing Google
Routes/Open-Meteo calls — so this doesn't add perceptible latency to
journey planning.

### 5.6 Stationary wait legs — wiring

Covers the platform-wait / pickup-queue scenario from Section 3.5 and 7.9.
Runs as the final step of the wiring pass, after AT GTFS Realtime data is
merged (Section 5, the pseudocode above), since a wait leg's duration
depends on live delay data that isn't available until that call returns:

1. For every leg with `mode: "bus" | "train"`, insert a preceding
   `JourneyLeg` with `isStationary: true`, `outdoor: true`, and
   `waitContext: "transit-platform"` (or `"transit-stop"` for a street-level
   bus stop rather than a station platform — inferred from the AT GTFS stop
   type if available, otherwise default to `"transit-stop"`).
2. Size `durationMin` from the AT GTFS Realtime scheduled-vs-actual delta
   for that specific departure: if GTFS reports a service is running N
   minutes late, `durationMin = N`. If GTFS Realtime is unavailable (Section
   5.1's omit-the-pill fallback already covers the transit leg itself),
   default the wait leg to a flat 5-minute assumed wait rather than
   omitting it entirely — "no delay data" isn't the same claim as "no
   wait," and silently dropping the leg would understate cold/wind exposure
   on the calibration-sensitive engine in Section 7.
3. The wait leg's single point (no polyline — it's stationary) is checked
   against saved `EnvironmentAnnotation`s using the same point-radius logic
   as Section 3.4, just evaluated at one coordinate instead of decoded
   along a polyline. An exposed platform is exactly the kind of spot a
   `wind-tunnel` annotation is likely to already cover.
4. A `pickup-queue` wait (e.g. waiting outside a school gate) is created
   the same way when the app has independent signal that a wait is
   expected at a `SavedLocation` — out of scope to auto-detect in v1; for
   now this context value exists for manual annotation via the "Add a
   stop" flow (Section 4.3.1) tagging a waypoint as a wait rather than a
   pass-through stop, which a future phase can wire up without a data
   model change.

### 5.7 Hike sampling — wiring

Full context and rationale in Section 13.8 (Phase 20) — this subsection
covers only the mechanical difference from the standard wiring pass above.
A `hike` leg does not use the single-midpoint sampling every other outdoor
leg uses:

1. Decode the leg's polyline (same decode Section 3.4 already needs for
   annotation matching) and pick sample points at a fixed interval — every
   ~2km of distance or every ~200m of cumulative elevation gain, whichever
   produces fewer points, so a long flat stretch isn't over-sampled and a
   steep short stretch isn't under-sampled.
2. Request Open-Meteo's `elevation` parameter for each sample point
   (folded into the same batched call pattern Section 5 already uses for
   midpoint sampling — one call covering all of a leg's sample points, not
   one call per point) and populate `HikeRouteSample.elevationM` and
   `.weather` per point.
3. Store the resulting array on `JourneyLeg.hikeSamples` (Section 3.5)
   instead of the single `weather` field other legs use. Section 7.11's
   engine logic reads `minTemp` (from `apparentTempC`) and `maxGust` (from
   `windGustKph`) across all of a hike leg's samples the same way it
   currently reduces across `outdoorLegs`, just at one extra level of
   nesting.

### 5.8 Map tile caching (why there's no bespoke system here)

Sections 5.1-5.3 define offline/failure handling for route and weather
data specifically, but say nothing about the map tiles themselves — worth
addressing explicitly rather than leaving it an unstated gap. `react-native-maps`
renders tiles through the underlying native SDK (Google Maps SDK on
Android, Apple MapKit on iOS), and **both already cache recently-viewed
tiles on-device automatically** — this is platform behavior, not something
`react-native-maps` or this app opts into or configures. A previously
-viewed area of the map (e.g. a regular commute route) will generally
still render from cache with no network call, without any app code.

Building a bespoke tile-caching layer on top of that (pre-fetching and
storing tiles for offline use, the way the hike-mode "download for
offline" action in Section 13.8 does for route/weather data specifically)
would be a meaningfully larger undertaking — tile storage formats, cache
eviction, a much bigger on-disk footprint — for a benefit the native SDKs'
own caching already covers for the app's actual use case (a regular
commuter revisiting familiar routes). Explicitly out of scope for v1 for
that reason, not because it was overlooked. If full offline map rendering
for never-before-seen areas is wanted later (most relevant to hike mode,
Section 13.8, where a route may genuinely be visited once), that's its own
scoped addition to Section 13.8's offline-download action specifically,
not a general change here.

---

## 6. Weather + climate classification (port directly from the working mockups)

```ts
function classifyWeather(code: number, mm: number, windKph: number) {
  if (code >= 95) return { label: "Stormy", icon: "⛈", severity: 4 };
  if (code >= 61) return mm > 4
    ? { label: "Heavy rain", icon: "🌧", severity: 3 }
    : { label: "Rain", icon: "🌧", severity: 2 };
  if (code >= 51) return { label: "Light rain", icon: "🌦", severity: 1 };
  if (code === 45 || code === 48) return { label: "Foggy", icon: "🌫", severity: 1 };
  if (code === 3) return { label: "Overcast", icon: "☁", severity: 0 };
  if (windKph > 25) return { label: "Windy", icon: "💨", severity: 1 };
  return { label: "Dry", icon: "☀", severity: 0 };
}

// Default indoor climate per mode — refine later if AT exposes vehicle data
const CLIMATE_BY_MODE = {
  walk: null,
  cycle: null,
  drive: null,      // treat car interior as unconditioned by outside weather
  bus: "ac",
  train: "ac",
  indoor: "ac",      // offices, supermarkets, shops
} as const;
```

This table is a **default guess, not a fact** — a journey's origin/
destination `SavedLocation.hasReliableClimateControl` (Section 3.4), when
set, always overrides it for that leg. See Section 5.5 for exactly where
that override is applied during wiring.

Rain-intensity gauge (used for the hourly strip UI): `none` if probability < 20%,
`low` if precip < 0.5mm/hr, `med` if 0.5–4mm/hr, `high` if > 4mm/hr.

### 6.1 Season + AC contrast

Auckland is Southern Hemisphere, so seasons are shifted relative to the
`Intl`/calendar defaults an agent might assume. Derive season from the
journey's `departTime`, not from device locale:

```ts
export type Season = "summer" | "winter" | "shoulder";

const SUMMER_MONTHS = [12, 1, 2];   // Dec–Feb
const WINTER_MONTHS = [6, 7, 8];    // Jun–Aug
// Mar–May and Sep–Nov = "shoulder"

function getSeason(isoDateTime: string): Season {
  const month = new Date(isoDateTime).getMonth() + 1; // JS months are 0-indexed
  if (SUMMER_MONTHS.includes(month)) return "summer";
  if (WINTER_MONTHS.includes(month)) return "winter";
  return "shoulder";
}
```

Air conditioning on buses/trains is **not symmetric** across seasons:

- **Summer**: AC is actively refrigerating against a hot exterior, so the
  gap between "outside" and "inside the carriage" is large — it reads as
  noticeably cold, especially after being warm outside. This is the case
  the existing `hasIndoorAC && hasWarmOutdoor` branch in Section 7 is for.
- **Winter**: transit AC units are typically idle or blowing unconditioned/
  ambient air rather than actively cooling (heating, if present, works the
  opposite direction). There's no equivalent "cold contrast" — treat winter
  AC exposure as a neutral factor, not a reason to add a layer.

```ts
function acFeelsCold(journey: Journey, season: Season, hasWarmOutdoor: boolean) {
  const hasIndoorAC = journey.legs.some(l => l.climate === "ac");
  return hasIndoorAC && season === "summer" && hasWarmOutdoor;
}
```

Only `summer` triggers the AC-contrast adjustment in the recommendation
engine below. `winter` and `shoulder` AC exposure is ignored for layering
purposes (it may still matter for e.g. suggesting a scarf in winter, but
that's out of scope for v1).

### 6.2 Apparent temperature as the engine's baseline, not raw air temperature

An earlier draft of this spec had `recommendGear()` (Section 7) work
entirely from raw `tempC`/`windKph`/`uvIndex`, with its own hand-built
wind-chill and direct-sun deltas layered on top. That duplicates work
Open-Meteo already does more rigorously via `apparent_temperature`
(Section 2), and — more importantly for Auckland specifically — it had no
way to account for humidity at all, despite Auckland's persistently high
relative humidity being a real, commonly-cited factor in how cold a given
temperature actually feels here ("damp cold"). The corrected structure:

- **`WeatherSnapshot.apparentTempC` (Section 3) is the engine's baseline
  input**, not raw `tempC`. `warmthLevelFromTemp()` and every `minTemp`
  reduction across a journey's legs (Section 7) read `apparentTempC`, which
  already has Open-Meteo's own wind/humidity/solar-radiation model folded
  in for the general area.
- **The engine's own wind/sun adjustments (Section 7.8) are rescoped to
  hyper-local deviations only** — they fire *only* when an
  `EnvironmentAnnotation` applies (`windEffect`, `sunEffect`,
  `highReflection`, Section 3.4), representing a specific street or spot
  that's meaningfully windier/sunnier than the citywide baseline
  `apparentTempC` already assumes. Without an annotation, there is no
  separate general wind-chill or sun-warming check — that would
  double-count an effect `apparentTempC` already includes. This is a
  deliberate correction from an earlier version of this section, which
  applied a general ambient wind-chill delta on top of raw temperature;
  once the baseline itself is wind/humidity-aware, that general check is
  redundant and was removed rather than kept "just in case."
- **A single divergence note replaces the old wind-specific one.** Rather
  than a wind-only "windy conditions will feel colder" note, `notes[]`
  compares `apparentTempC` to `tempC` directly on the worst outdoor leg: a
  difference of 2°C or more (whatever the cause — wind, humidity, or a
  combination) earns a note naming the gap, e.g. "Feels noticeably colder
  than the air temperature today." This is more honest than attributing the
  gap to wind alone, since in Auckland it's frequently humidity-driven or a
  combination of both, and Open-Meteo's model already knows which factors
  contributed without the app needing to re-derive that itself.
- **Umbrella wind-rating uses `windGustKph`, not `windKph`.** A gust is what
  physically inverts an umbrella; sustained wind is the more relevant
  figure for how cold a walk feels. Using the same field for both was an
  earlier simplification, corrected here now that both fields are
  requested (Section 2).
- **Validity caveat, carried into the spec rather than left implicit:** the
  standard wind-chill formula Open-Meteo's `apparent_temperature` draws on
  is formally validated only for ambient temperatures at or below ~10°C.
  Auckland's typical "cool and breezy" commute conditions (11–14°C) sit
  just past that validated range — treat `apparentTempC` in that band as a
  reasonable, well-grounded approximation, not an exact physiological
  reading, the same caveat Section 5.3 already applies to forecast
  confidence generally.

Section 7's constants and control flow below reflect this corrected
structure directly — this subsection exists so the *reasoning* for the
correction is documented alongside the mechanism, not just the mechanism
itself.

---

## 7. Gear recommendation engine

This is the part that's new vs. the earlier prototypes: recommendations must
resolve to **actual owned items**, not generic text. Put this in
`src/lib/recommend.ts`.

```ts
type LayerPick = ClothingItem | { fallbackText: string; layerType: ClothingType };

interface Recommendation {
  layers: LayerPick[];        // ordered base → midlayer → jacket, only the layers actually needed
  bottoms?: LayerPick;        // Section 7.13 — legwear, evaluated independently of the layers stack (trousers don't "layer" the way torso items do). Undefined on a mild, dry journey — omitted from the card entirely (Section 9.3), not shown as "regular trousers fine."
  accessories: LayerPick[];   // gloves/hat/scarf-type ClothingType "accessory" items, only when warranted
  shoes?: ShoeItem | { fallbackText: string };
  umbrella?: UmbrellaItem | { fallbackText: string };
  severeWeatherAdvisory?: string; // Section 7.14 — a suggestion to reconsider walking/cycling today, not a gear pick. Rendered as its own banner (Section 9.3), not folded into notes[], since it's a different kind of statement ("maybe don't" vs. "wear this").
  notes: string[]; // human-readable reasoning, shown under each pick
}

// ---- Named thresholds — tune these, don't touch control flow below ----
const FREEZING_C = 2;              // at/below this, warmth always wins, no warmup discount. NOTE: Auckland's practical record cold is close to this value (a rare 2011 near-snow event recorded a 2°C low) — this tier is intentionally a "genuine cold snap" ceiling, not a threshold expected to fire on a typical Auckland winter morning
const COOL_UPPER_C = 14;           // "cool" band upper bound
const WARM_OUTDOOR_C = 18;         // outdoor temp counted as "warm" for AC-contrast logic
const WARMUP_WALK_MIN_MINUTES = 15; // total outdoor walking time before body heat matters
const WARMUP_CYCLE_MIN_MINUTES = 8; // lower than walking's — cycling builds body heat faster (Section 7.9)
const HIGH_WIND_KPH = 30;          // GUST speed (WeatherSnapshot.windGustKph, Section 6.2) that requires a wind-rated umbrella — a gust, not sustained wind, is what actually inverts one
const ACCESSORY_WARMTH_LEVEL = 3;  // warmth level (see below) at/above which gloves/hat are worth surfacing
const HIGH_UV_INDEX = 6;           // Open-Meteo uv_index at/above which sun protection is worth surfacing — matches the WHO UV index scale's official "High" band (6-7)
const HIGH_REFLECTION_UV_OFFSET = 1; // Section 7.8 — the effective UV threshold is lowered by this much on a leg flagged highReflection (sand/water/snow); reuses HIGH_UV_INDEX rather than adding a second threshold to keep in sync
const WARMTH_CALIBRATION_STEP = 0.5; // how much one feedback event shifts WarmthCalibration.offsetLevels (Section 7.5)
const WIND_CHILL_KPH = 15;          // Section 6.2/7.8 — effective SUSTAINED wind speed (not gust) at/above which a hyper-local wind-tunnel annotation is amplifying conditions enough beyond the citywide apparentTempC baseline to justify an extra warmth-level bump. Corrected down from an earlier draft's 20: the standard wind-chill formula shows a ~2°C feels-like depression already at ~15kph and Auckland averages 14-18kph — a threshold near or above that average was suppressing a real, common effect rather than reserving the note for something unusual. How often a true effect fires is not a reason to raise its threshold.
const APPARENT_TEMP_DIVERGENCE_NOTE_C = 2; // Section 6.2 — when |apparentTempC - tempC| on the worst leg is at/above this, add a note naming the gap (wind, humidity, or both — Open-Meteo's model already knows which, the app doesn't need to re-derive it)
const WIND_TUNNEL_MULTIPLIER = 1.5;  // felt-wind multiplier for a leg flagged windEffect === "amplified"
const WIND_SHELTERED_MULTIPLIER = 0.5; // felt-wind multiplier for a leg flagged windEffect === "sheltered"
const PUDDLE_RISK_PRECIP_MM_6H = 5; // cumulative mm over the past 6h at/above which puddle risk is flagged for footwear (Section 7.8)
const STATIONARY_WAIT_MIN_MINUTES = 10; // Section 7.9 — a stationary outdoor wait at/above this long, in cool-or-colder conditions, is treated as an aggravating factor on warmthLevel, since standing still generates no body heat. Applies when the wait is NOT already flagged windy (see below) — a calm wait needs the full duration before it's noticeably worse than the ambient reading.
const STATIONARY_WAIT_WINDY_MIN_MINUTES = 5; // Section 7.9 — a shorter duration threshold used when the same wait leg's effective wind already meets WIND_CHILL_KPH: standing still is windchill's worst case (no body heat to counter it), so a windy wait earns the aggravating bump sooner than a calm one, not on the same flat schedule
const ITEM_WARMTH_SCALE_MAX = 10;   // Section 3.6 — ClothingItem.warmth's range (1-10, widened from an original 1-5 scale). Documented here as a named constant, not just a type comment, since pickLayer()'s targetWarmth math (below) depends on it directly — if this scale ever changes again, the multiplier there must change with it.
const WIND_SENSITIVITY_OFFSET_CLAMP = 1; // Section 7.5.2 — clamps WarmthCalibration.windSensitivityOffset to ±1. Deliberately a tighter clamp than WARMTH_CALIBRATION_STEP's ±2 range on offsetLevels, since this only ever nudges one already-conditional delta (the annotation-gated wind-chill bump, Section 7.8), not the whole recommendation's baseline.
const CALIBRATION_DECAY_AFTER_DAYS = 60; // Section 7.5.3 — a WarmthCalibration bucket (global, seasonal, or wind-sensitivity) with no feedback in this many days is nudged toward 0 rather than left frozen, since "runs warm" learned two seasons ago may no longer reflect how someone dresses now.
const CALIBRATION_DECAY_STEP = 0.25; // Section 7.5.3 — how much a stale offset moves toward 0 per decay check (Section 12.2's dev menu exposes a manual trigger for testing this without waiting 60 real days)
const BOTTOMS_COLD_WARMTH_LEVEL = 4; // Section 7.13 — legwear only gets a specific thermal call at genuine-cold-snap warmthLevel (4); anything milder assumes regular trousers are fine, same reasoning as layerPlanForWarmthLevel's level-0 "nothing extra needed"
const HOT_C = 24;                    // Section 7.15 — apparentTempC at/above which a breathable-fabric note is worth surfacing; distinct from WARM_OUTDOOR_C (18°C), which only governs AC-contrast — this is specifically about genuinely hot, not just "not cold"
const SEVERE_WEATHER_SEVERITY = 4;   // Section 7.14 — classifyWeather() severity ("Stormy") at/above which the severe-weather advisory considers firing on a walk/cycle leg
const SEVERE_GUST_KPH = 60;          // Section 7.14 — windGustKph at/above which the advisory fires on wind alone even without storm-level precipitation; well above HIGH_WIND_KPH's 30kph umbrella-survival threshold, since this is about the walk/cycle itself being unpleasant or unsafe, not just an umbrella surviving it
const WASH_REMINDER_WEAR_COUNT = 3;  // Section 7.16 — wearsSinceClean at/above which needsCleaning is set, absent an earlier sweaty-conditions trigger
const LAUNDRY_DEFAULT_TURNAROUND_DAYS = 2; // Section 7.16 — default unavailableUntil offset when marking an item "in the laundry" specifically (a wash-and-dry cycle), shorter than the general +3 day default the "mark unavailable until…" action (Section 7.7) uses for "repair"/"other"

// An item is usable only if it isn't flagged unavailable (in the wash,
// lost, being repaired) for a date range that covers this journey.
function isAvailable<T extends { unavailableUntil?: string }>(item: T, departTime: string): boolean {
  if (!item.unavailableUntil) return true;
  return new Date(item.unavailableUntil).getTime() < new Date(departTime).getTime();
}

// Warmth level 0 (warm) .. 4 (freezing), derived from the coldest outdoor
// leg's apparentTempC (Section 6.2) — NOT raw tempC. apparentTempC already
// folds in Open-Meteo's own wind/humidity/solar-radiation model for the
// general area, so this single input already reflects Auckland's
// persistent wind and humidity without the engine re-deriving either.
//
// `thresholds` defaults to the named constants below but can be overridden
// per-user via Section 3.6's opt-in AdvancedWarmthThresholds — callers
// resolve `{ freezingC: advanced?.freezingC ?? FREEZING_C, ... }` once and
// pass it in, the same "resolve once, engine only sees one final value"
// pattern already used for CarryPreference above.
function warmthLevelFromTemp(
  apparentTempC: number,
  thresholds: { freezingC: number; coolUpperC: number; warmOutdoorC: number } =
    { freezingC: FREEZING_C, coolUpperC: COOL_UPPER_C, warmOutdoorC: WARM_OUTDOOR_C }
): 0 | 1 | 2 | 3 | 4 {
  if (apparentTempC <= thresholds.freezingC) return 4;
  if (apparentTempC < 9) return 3;
  if (apparentTempC < thresholds.coolUpperC) return 2;
  if (apparentTempC < thresholds.warmOutdoorC) return 1;
  return 0;
}

// Section 7.9 — walking and cycling are evaluated against separate warmup
// thresholds (sustained cycling builds body heat faster than walking at
// the same duration), and both explicitly exclude isStationary legs
// (Section 3.5) — standing still on a platform generates no body heat at
// all, so it must never count toward either warmup discount.
function totalOutdoorExertionMinutes(journey: Journey, mode: "walk" | "cycle"): number {
  return journey.legs
    .filter(l => l.outdoor && !l.isStationary && l.mode === mode)
    .reduce((sum, l) => sum + l.durationMin, 0);
}

// Section 7.9 — the mirror image of the function above: total time spent
// standing still outdoors (transit waits, pickup queues), which aggravates
// cold exposure rather than offsetting it.
function totalOutdoorStationaryMinutes(journey: Journey): number {
  return journey.legs
    .filter(l => l.outdoor && l.isStationary)
    .reduce((sum, l) => sum + l.durationMin, 0);
}

// Which ClothingType(s) are actually needed at a given warmth level. Returns
// them in put-on order (base first). This is what makes recommendations
// multi-piece for cold conditions instead of a single "jacket" guess.
function layerPlanForWarmthLevel(level: 0 | 1 | 2 | 3 | 4, requirePackable: boolean): ClothingType[] {
  if (level === 4) return ["base", "midlayer", "jacket"];
  if (level === 3) return ["midlayer", "jacket"];
  if (level === 2) return requirePackable ? ["midlayer"] : ["jacket"];
  if (level === 1) return ["midlayer"];
  return []; // level 0 — no extra layer needed beyond whatever the user's already wearing
}

function pickLayer(
  inventory: Inventory,
  type: ClothingType,
  targetWarmth: number, // on the same 1-ITEM_WARMTH_SCALE_MAX (1-10) scale as ClothingItem.warmth (Section 3.6) — callers must scale warmthLevel (0-4) up onto this range before calling, not pass warmthLevel directly
  needsWaterproof: boolean,
  requirePackable: boolean,
  departTime: string,
  preferTags: string[] = [] // Section 7.9/7.10 — e.g. ["cycling"] or ["formal"]; biases ordering toward a tagged match without excluding untagged items, so a thin inventory still resolves to something
): LayerPick {
  const candidates = inventory.clothing.filter(c =>
    c.type === type && (!requirePackable || c.packable) && isAvailable(c, departTime));
  const picked = candidates.sort((a, b) =>
    (preferTags.length
      ? Number(preferTags.some(t => b.tags?.includes(t))) - Number(preferTags.some(t => a.tags?.includes(t)))
      : 0) ||
    (needsWaterproof ? Number(b.waterproof) - Number(a.waterproof) : 0) ||
    Math.abs(a.warmth - targetWarmth) - Math.abs(b.warmth - targetWarmth)
  )[0];
  return picked ?? { fallbackText: `No available ${type} for these conditions`, layerType: type };
}

// `carryPreferenceDefault` is the Settings-level default (Section 9.1);
// callers resolve `journey.carryPreference ?? carryPreferenceDefault`
// themselves before calling, or pass the already-resolved value — either
// way the engine only ever sees one final CarryPreference, not two sources
// to reconcile.
function recommendGear(
  journey: Journey,
  inventory: Inventory,
  calibration: WarmthCalibration,
  carryPreference: CarryPreference,
  advancedThresholds?: AdvancedWarmthThresholds // Section 3.6 — undefined for the vast majority of users; resolved once here, never read piecemeal below
): Recommendation {
  // Section 3.6 — resolve once; every reference to a warmth threshold
  // below reads from this object, never the bare named constants, so an
  // opted-in override is applied consistently rather than in some places
  // and not others.
  const thresholds = {
    freezingC: advancedThresholds?.freezingC ?? FREEZING_C,
    coolUpperC: advancedThresholds?.coolUpperC ?? COOL_UPPER_C,
    warmOutdoorC: advancedThresholds?.warmOutdoorC ?? WARM_OUTDOOR_C,
  };
  const outdoorLegs = journey.legs.filter(l => l.outdoor && l.weather);
  const worstOutdoor = outdoorLegs.reduce((worst, l) =>
    l.weather!.severity > (worst?.weather?.severity ?? -1) ? l : worst, null as JourneyLeg | null);
  // Section 6.2 — minTemp (the engine's actual temperature input) is drawn
  // from apparentTempC, not raw tempC. maxGust for the umbrella check is
  // drawn from windGustKph, not sustained windKph — see Section 7.8.
  const minTemp = Math.min(...outdoorLegs.map(l => l.weather!.apparentTempC));
  const maxGust = Math.max(...outdoorLegs.map(l => l.weather!.windGustKph));
  const hasWarmOutdoor = outdoorLegs.some(l => l.weather!.apparentTempC >= thresholds.warmOutdoorC);
  const season = getSeason(journey.departTime);           // Section 6.1
  const acContrast = acFeelsCold(journey, season, hasWarmOutdoor); // Section 6.1
  const walkingMinutes = totalOutdoorExertionMinutes(journey, "walk");
  const cyclingMinutes = totalOutdoorExertionMinutes(journey, "cycle");
  const stationaryMinutes = totalOutdoorStationaryMinutes(journey); // Section 7.9
  const isFormal = journey.formal ?? false; // Section 7.10
  const needsWaterproof = outdoorLegs.some(l => l.weather!.severity >= 2);
  // Puddle risk affects footwear only, independent of current rain — see Section 7.8.
  const puddleRisk = outdoorLegs.some(l =>
    l.puddleRisk || (l.weather!.recentPrecipMm6h ?? 0) >= PUDDLE_RISK_PRECIP_MM_6H);
  const anyRainCovered = outdoorLegs.some(l => l.rainCovered);

  const notes: string[] = [];

  // --- Umbrella ---
  let umbrella: Recommendation["umbrella"];
  if (worstOutdoor && worstOutdoor.weather!.severity >= 2) {
    const owned = inventory.umbrellas.find(u =>
      isAvailable(u, journey.departTime) && (maxGust > HIGH_WIND_KPH ? u.windRating !== "low" : true));
    umbrella = owned ?? { fallbackText: "No suitable umbrella owned or available — consider a wind-rated one" };
    notes.push(`${worstOutdoor.label}: ${worstOutdoor.weather!.label.toLowerCase()} expected`);
    // Informational only — a partially covered walk doesn't change *whether*
    // to bring an umbrella (the uncovered portion still needs one), just
    // sets expectations. See Section 7.8 for why this doesn't alter the
    // umbrella pick itself.
    if (anyRainCovered) {
      notes.push("Part of this route is covered — you may not need it out the whole way");
    }
  }

  // --- Shoes ---
  // needsWaterproof (currently raining) and puddleRisk (rained recently,
  // may be dry now) both push toward waterproof/grippy footwear, but for
  // different reasons — see Section 7.8.
  const shoesNeedWaterproof = needsWaterproof || puddleRisk;
  const shoeCandidates = inventory.shoes.filter(s =>
    isAvailable(s, journey.departTime) && (shoesNeedWaterproof ? s.waterproof : true));
  // Section 7.10 — a formal occasion prefers a formal-type shoe even at a
  // waterproof/grip penalty, falling back to the normal weather-first sort
  // only when no formal shoe is available, so the user isn't left with
  // nothing rather than something merely not-quite-optimal.
  let shoes: Recommendation["shoes"];
  if (isFormal) {
    const formalShoe = inventory.shoes.find(s => s.type === "formal" && isAvailable(s, journey.departTime));
    if (formalShoe) {
      shoes = formalShoe;
      if (shoesNeedWaterproof && !formalShoe.waterproof) {
        notes.push("Dress shoes picked for the occasion — bring an umbrella, conditions call for one");
      }
    }
  }
  if (!shoes) {
    shoes = shoeCandidates.sort((a, b) => (b.grip === "high" ? 1 : 0) - (a.grip === "high" ? 1 : 0))[0]
      ?? { fallbackText: shoesNeedWaterproof ? "No waterproof shoes owned or available" : "Any regular shoes fine" };
  }
  if (puddleRisk && !needsWaterproof) {
    notes.push("Rain earlier today — puddles likely, going with waterproof/grippy shoes even though it's dry now");
  }

  // --- Layers ---
  // 1. Start from a warmth level driven by the coldest outdoor leg's
  //    apparentTempC (Section 6.2 — already wind/humidity/solar-aware),
  //    then apply this user's personal calibration (Section 7.5) — someone
  //    who consistently reports "too warm" runs a lighter recommendation
  //    than the raw calculation from here on. resolveWarmthOffset()
  //    (Section 7.5.1) prefers the current season's own offset and falls
  //    back to the global offsetLevels when that season has no samples yet.
  let warmthLevel = Math.max(0, Math.min(4,
    warmthLevelFromTemp(minTemp, thresholds) + resolveWarmthOffset(calibration, season)
  )) as 0 | 1 | 2 | 3 | 4;

  // 1.5. Hyper-local wind/sun/reflection adjustments and stationary-wait
  //      adjustment — see Section 7.8/7.9 for the full rationale. The
  //      wind/sun checks below fire ONLY in the presence of an
  //      EnvironmentAnnotation (windEffect/sunEffect/highReflection) —
  //      there is deliberately no general ambient wind-chill or sun-warming
  //      check here, since apparentTempC (used for minTemp above) already
  //      folds in the citywide ambient wind/humidity/solar picture. A
  //      general check on top of that would double-count. These deltas
  //      represent only the *extra* local deviation a specific street or
  //      spot adds beyond the citywide baseline.
  let envDelta = 0;
  // Section 6.2 — only "amplified" (wind-tunnel) legs add a delta here.
  // "sheltered" legs are deliberately informational-only (surfaced as a
  // note, not a warmthLevel change) rather than subtracting a dampening
  // delta: apparentTempC is a single combined figure from Open-Meteo with
  // no exposed breakdown of how much of it is wind-driven, so there's no
  // reliable way to know how much to offset for a specific sheltered spot
  // — same reasoning as why puddle risk stays footwear-only rather than
  // guessing at a jacket implication (Section 7.8 below).
  const windLeg = outdoorLegs.find(l =>
    l.windEffect === "amplified" && l.weather!.windKph * WIND_TUNNEL_MULTIPLIER >= WIND_CHILL_KPH);
  if (windLeg && !isFormal) {
    // Section 7.10 — a formal occasion relies on the umbrella pick + note
    // above rather than an added layer, since a bulky wind-chill layer is
    // more likely to be visually wrong for the occasion than useful.
    // Section 7.5.2 — someone who's told the app they're more bothered by
    // wind than average gets a slightly larger bump here (clamped to
    // ±WIND_SENSITIVITY_OFFSET_CLAMP); someone less bothered gets a
    // slightly smaller one. This is the *only* place windSensitivityOffset
    // is read — it never touches the base warmthLevel or any other delta.
    const windBump = 1 + clamp(calibration.windSensitivityOffset ?? 0, -WIND_SENSITIVITY_OFFSET_CLAMP, WIND_SENSITIVITY_OFFSET_CLAMP);
    envDelta += windBump;
    notes.push(`Wind tunnel on ${windLeg.label} — dressing warmer for that stretch`);
  }
  const sunLeg = outdoorLegs.find(l =>
    l.sunEffect === "exposed" && l.weather!.isDaylight &&
    l.weather!.uvIndex >= (HIGH_UV_INDEX - (l.highReflection ? HIGH_REFLECTION_UV_OFFSET : 0)));
  if (sunLeg) {
    envDelta -= 1;
    notes.push(
      sunLeg.highReflection
        ? `Direct sun and reflection on ${sunLeg.label} will feel warmer than the temperature alone suggests`
        : `Direct sun on ${sunLeg.label} will feel warmer than the temperature alone suggests`
    );
  }
  // Section 7.9 — standing still outdoors (a delayed platform, a pickup
  // queue) generates no body heat, so a wait long enough in cool-or-colder
  // conditions is treated as an aggravating factor, the same direction as
  // wind chill. A windy wait earns this sooner than a calm one
  // (STATIONARY_WAIT_WINDY_MIN_MINUTES vs. STATIONARY_WAIT_MIN_MINUTES) —
  // wind chill is at its worst precisely when there's no body heat to
  // counter it, so duration alone isn't the whole story.
  const stationaryLegWindy = outdoorLegs.some(l => l.isStationary && l.weather!.windKph >= WIND_CHILL_KPH);
  const stationaryThreshold = stationaryLegWindy ? STATIONARY_WAIT_WINDY_MIN_MINUTES : STATIONARY_WAIT_MIN_MINUTES;
  if (stationaryMinutes >= stationaryThreshold && minTemp < thresholds.coolUpperC) {
    envDelta += 1;
    notes.push(
      stationaryLegWindy
        ? `${stationaryMinutes} min waiting in the wind — dressing warmer since you won't be moving to generate heat`
        : `${stationaryMinutes} min waiting outdoors — dressing warmer since you won't be moving to generate heat`
    );
  }
  warmthLevel = Math.max(0, Math.min(4, warmthLevel + envDelta)) as typeof warmthLevel;

  // 1.6. Section 6.2 — a general note (not a warmthLevel change; apparentTempC
  //      already includes this) naming the gap when the worst leg's feels-like
  //      figure diverges meaningfully from the raw air temperature, whatever
  //      the cause — wind, Auckland's persistent humidity, or both. This
  //      replaces a wind-only note from an earlier draft with something more
  //      honest about what's actually driving the difference.
  if (worstOutdoor) {
    const gap = worstOutdoor.weather!.tempC - worstOutdoor.weather!.apparentTempC;
    if (gap >= APPARENT_TEMP_DIVERGENCE_NOTE_C) {
      notes.push(`Feels noticeably colder than the air temperature today — dressed for that, not just the number`);
    }
  }

  // 1.7. Section 7.15 — the engine is otherwise entirely cold-direction:
  //      warmthLevel 0 just means "nothing extra needed," with no positive
  //      guidance for a genuinely hot day. This is a note only, not an item
  //      pick — there's no `breathable` attribute on ClothingItem to match
  //      against (out of scope for v1, see Section 7.15), so the engine
  //      can flag the condition but not resolve a specific breathable item.
  if (outdoorLegs.some(l => l.weather!.apparentTempC >= HOT_C)) {
    notes.push("Warm enough today that something breathable and light-colored will feel better than your usual pick");
  }

  // 2. Warmup discount: sustained outdoor exertion generates enough body
  //    heat that the "textbook" layer for a given temp will feel like too
  //    much within a matter of minutes. Walking and cycling are evaluated
  //    against separate thresholds (Section 7.9) since cycling builds heat
  //    faster; a journey only earns the discount from whichever exertion
  //    type it actually has enough of. Freezing temps are exempt from
  //    both — hypothermia risk outweighs the warmup effect.
  const eligibleForWarmupDiscount =
    minTemp > thresholds.freezingC && minTemp < thresholds.coolUpperC &&
    (walkingMinutes >= WARMUP_WALK_MIN_MINUTES || cyclingMinutes >= WARMUP_CYCLE_MIN_MINUTES);
  if (eligibleForWarmupDiscount) {
    warmthLevel = Math.max(0, warmthLevel - 1) as typeof warmthLevel;
    const cyclingQualifies = cyclingMinutes >= WARMUP_CYCLE_MIN_MINUTES;
    const exertionMinutes = cyclingQualifies ? cyclingMinutes : walkingMinutes;
    const exertionLabel = cyclingQualifies ? "cycling" : "walking";
    notes.push(
      `${exertionMinutes} min of ${exertionLabel} at ${Math.round(minTemp)}°C will warm you up fast — ` +
      `going one layer lighter than the raw temperature suggests`
    );
  }

  // 3. Summer AC contrast: cooling indoor legs sandwiched between warm
  //    outdoor legs call for something removable, not a fixed heavy jacket.
  //    This only fires in summer — see Section 6.1 for why winter AC is
  //    treated as neutral. Note this reads journey.legs directly, so a
  //    location-override-forced "unconditioned" leg (Section 5.5) correctly
  //    stops counting as AC here without any extra logic.
  let requirePackable = false;
  if (acContrast) {
    requirePackable = true;
    warmthLevel = Math.max(warmthLevel, 2) as typeof warmthLevel; // ensure *something* is picked
    notes.push(
      "Summer AC on the bus/train will feel cold after being warm outside — " +
      "pick a layer you can put on and take off easily"
    );
  }
  // Section 7.9 — "avoid spares" overrides the AC-contrast packable
  // requirement above: the user has said they won't carry a spare
  // regardless of what's suggested, so recommend the warmest single
  // wearable layer instead of a packable one, and say so rather than
  // silently keeping requirePackable true.
  if (carryPreference === "avoid-spares" && requirePackable) {
    requirePackable = false;
    notes.push("Skipping a spare layer per your preference — the bus AC may feel cold");
  }

  // 4. Resolve the layer plan for the (possibly adjusted) warmth level into
  //    actual owned items — this is what produces "base + midlayer + jacket"
  //    for genuinely cold journeys instead of a single guess. Biases toward
  //    cycling-tagged items on a cycle leg and formal-tagged items on a
  //    formal occasion (Section 7.9/7.10) via pickLayer's preferTags.
  //    `warmthLevel * 2.5` maps the 0-4 warmthLevel range onto the 1-10
  //    ClothingItem.warmth scale (ITEM_WARMTH_SCALE_MAX, Section 3.6) —
  //    update this multiplier if either scale's range ever changes.
  const layerTypes = layerPlanForWarmthLevel(warmthLevel, requirePackable);
  const preferTags = [
    ...(cyclingMinutes > 0 ? ["cycling"] : []),
    ...(isFormal ? ["formal"] : []),
  ];
  let layers = layerTypes.map(type =>
    pickLayer(inventory, type, warmthLevel * 2.5, needsWaterproof, requirePackable, journey.departTime, preferTags)
  );
  // Section 7.12 — a jacket that's already insulated enough to do a
  // midlayer's job (ClothingItem.substitutesForMidlayer, Section 3.6, e.g.
  // a rain shell with a built-in thin puffer lining) makes a separately
  // recommended midlayer redundant. Only applies when both a midlayer and
  // a jacket were actually resolved to real items (not fallbackText) and
  // the jacket's own warmth already covers the target — a substitutable
  // jacket that's unavailable this trip still needs a normal midlayer.
  const pickedJacket = layers.find((l, i) => layerTypes[i] === "jacket");
  const midlayerIndex = layerTypes.indexOf("midlayer");
  if (
    midlayerIndex !== -1 &&
    pickedJacket && "id" in pickedJacket && pickedJacket.substitutesForMidlayer &&
    pickedJacket.warmth >= warmthLevel * 2.5
  ) {
    layers = layers.filter((_, i) => i !== midlayerIndex);
    notes.push(`Your ${pickedJacket.name} is warm enough on its own — no separate midlayer needed underneath`);
  }

  // 4.5. Legwear (Section 7.13) — evaluated independently of the layers
  //      stack above, since trousers don't "layer" the way base/midlayer/
  //      jacket do. Only surfaced when conditions specifically call for
  //      it — a genuine cold snap (thermal bottoms) or wet-and-windy-enough
  //      conditions that ordinary trousers would be miserable (rain
  //      trousers, not just a jacket). Reuses the same waterproof/gust
  //      reasoning as the umbrella-survival check (Section 6.2/7.8): a leg
  //      wet AND windy enough to threaten an umbrella is wet+windy enough
  //      to matter for legwear too.
  const needsWaterproofBottoms = needsWaterproof && maxGust >= HIGH_WIND_KPH;
  const needsThermalBottoms = warmthLevel >= BOTTOMS_COLD_WARMTH_LEVEL;
  let bottoms: Recommendation["bottoms"];
  if (needsWaterproofBottoms || needsThermalBottoms) {
    bottoms = pickLayer(
      inventory, "bottoms", warmthLevel * 2.5, needsWaterproofBottoms, false, journey.departTime, preferTags
    );
    if (needsWaterproofBottoms) {
      notes.push("Wet and windy enough to warrant rain trousers, not just a jacket");
    }
  }

  // --- Accessories (gloves/hat/scarf, plus sun/darkness gear — Section 7.6) ---
  const accessories: LayerPick[] = [];
  const availableAccessories = inventory.clothing.filter(c =>
    c.type === "accessory" && isAvailable(c, journey.departTime));

  // Only worth surfacing once it's actually cold — don't clutter the
  // recommendation card with an accessory suggestion at warmthLevel 0-2.
  if (warmthLevel >= ACCESSORY_WARMTH_LEVEL) {
    const warm = availableAccessories.filter(c => !c.tags || (!c.tags.includes("sunglasses")));
    if (warm.length > 0) {
      accessories.push(...warm);
    } else {
      accessories.push({ fallbackText: "Consider gloves/a hat — it's cold out", layerType: "accessory" });
    }
  }

  // Sun and low-light gear layer on top of (not instead of) cold-weather
  // accessories above — see Section 7.6 for these two functions.
  applySunProtection(accessories, availableAccessories, outdoorLegs, notes);
  applyDarknessGear(accessories, availableAccessories, outdoorLegs, notes);

  // --- Severe weather advisory (Section 7.14) ---
  // A suggestion to reconsider the mode itself, not a gear pick — scoped to
  // walk/cycle/hike legs (a severe drive/bus/train leg is the driver's/
  // operator's problem, not a clothing one) and kept as a single
  // non-blocking sentence, consistent with this app's stance elsewhere
  // (Section 13.8) that it recommends clothing, not safety decisions. Hike
  // legs are included deliberately, not as an afterthought — a multi-hour,
  // elevation-varying leg is if anything the case this advisory matters
  // most for, and excluding it would be a real gap, not a scope choice.
  // Reuses Section 7.11's established fold-over-`hikeSamples` pattern
  // rather than reading `l.weather` directly, since a hike leg's `.weather`
  // is unset in favor of per-sample readings (Section 3).
  const severeLeg = outdoorLegs.find(l => {
    if (l.mode === "hike" && l.hikeSamples) {
      return l.hikeSamples.some(s =>
        s.weather.severity >= SEVERE_WEATHER_SEVERITY || s.weather.windGustKph >= SEVERE_GUST_KPH);
    }
    return (l.mode === "walk" || l.mode === "cycle") &&
      (l.weather!.severity >= SEVERE_WEATHER_SEVERITY || l.weather!.windGustKph >= SEVERE_GUST_KPH);
  });
  const severeModeLabel = severeLeg?.mode === "cycle" ? "cycling" : severeLeg?.mode === "hike" ? "the hike" : "walking";
  const severeWeatherAdvisory = severeLeg
    ? `${severeLeg.label}: conditions look severe enough that you might want to reconsider ${severeModeLabel} today, if you have another option.`
    : undefined;

  return { layers, bottoms, accessories, shoes, umbrella, severeWeatherAdvisory, notes };
}
```

Wind chill, direct-sun/reflection warming, puddle risk, rain-cover
awareness, and the stationary-wait adjustment in the code above are
explained in full in Section 7.8/7.9, after the rest of the engine's
supporting logic below. Cycling exertion and the formal-occasion mode are
covered in Section 7.9 and 7.10 respectively.

Keep the logic table-driven (thresholds as named constants, above) so the
coding agent can tune cutoffs without touching control flow. `getSeason` and
`acFeelsCold` come from Section 6.1 and must be imported into
`src/lib/recommend.ts` alongside this function (or moved into a shared
`src/lib/weather.ts` — agent's choice, just keep them out of the UI layer).
`resolveWarmthOffset()` (Section 7.5.1) and a small generic `clamp(value,
min, max)` utility are used by both `recommendGear()` and
`applyGearFeedback()` — put `clamp` in a shared utils module rather than
duplicating it. `recordWear()` and `isSweatyConditions()` (Section 7.16)
are deliberately *not* called from inside `recommendGear()` — they belong
at the leave-by/RecommendationSnapshot-freeze call site (Section 7.3)
instead, alongside a `updateItemWearTracking()` SQLite write function
analogous to `saveWarmthCalibration()`.

The gear recommendation card (Section 9.3) renders `layers` as a small
ordered stack (base → midlayer → jacket) rather than a single slot, and
`accessories` as an optional row underneath that's simply omitted from
layout entirely when the array is empty — don't reserve visual space for it
on a mild day. `bottoms` (Section 7.13), when present, renders as its own
horizontal slot alongside `shoes`/`umbrella` — not part of the layers
stack, since legwear doesn't visually "stack" the way torso layers do.

### 7.3 Leave-by notifications

The most useful moment for this app is *before* the user opens it — so
scheduling a local notification is worth building in v1, not deferring:

```ts
import * as Notifications from "expo-notifications";

const LEAVE_BY_LEAD_MINUTES = 10; // how long before departure to notify

async function scheduleLeaveByNotification(journey: Journey, recommendation: Recommendation) {
  const departMs = new Date(journey.departTime).getTime();
  const triggerMs = departMs - LEAVE_BY_LEAD_MINUTES * 60_000;
  if (triggerMs <= Date.now()) return; // don't schedule for the past

  const summary = summarizeRecommendation(recommendation); // e.g. "Rain shell + waterproof boots"

  await Notifications.scheduleNotificationAsync({
    identifier: `leave-by:${journey.id}`, // stable id so re-planning cancels/replaces cleanly
    content: {
      title: `Leave in ${LEAVE_BY_LEAD_MINUTES} minutes`,
      body: `${journey.destination.label}: ${summary}`,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(triggerMs) },
  });
}
```

- Schedule/re-schedule whenever a Journey's weather or gear recommendation is
  (re)computed — including when a materialized recurring occurrence
  (Section 3) gets its data fetched for the day.
- If AT GTFS Realtime (Phase 7) reports a delay on a bus/train leg, recompute
  `triggerMs` and call `scheduleNotificationAsync` again with the same
  `identifier` — Expo replaces rather than duplicates.
- Cancel with `Notifications.cancelScheduledNotificationAsync(identifier)` if
  the user deletes the journey or turns off a recurrence's `active` flag.
- Request notification permission from the onboarding flow (Section 4.1) or
  the first time the user plans a journey — not silently on app launch.
- **Overlapping notifications, decided rather than left open**: two
  Journeys with close leave-by times each schedule and fire independently
  — no merging, stacking, or "you have two things happening" combined
  notification. This is deliberate, not an oversight: each notification's
  copy already names the specific route ("Leave by 8:12 to catch the 8:20
  train — grab your rain shell," Section 9.0.1), so even two arriving
  minutes apart are independently identifiable by content, and genuinely
  overlapping departures are low-frequency enough for a single-user commute
  app that dedicated merge logic isn't worth the complexity. If this
  proves wrong in practice, it's a small addition here later, not a
  structural change.
- The same point this notification fires — leave-by time, once nothing else
  is going to change the recommendation — is also when `Journey.recommendationSnapshot`
  (Section 3) gets frozen from the live `Recommendation`, so History (Section
  4.4) later shows exactly what was suggested rather than re-deriving it
  from whatever the inventory happens to look like by then. `recordWear()`
  (Section 7.16) fires at this same point, against the same final
  `Recommendation` being frozen and the same resolved `warmOutdoorC`
  (Section 3.6/7) already computed for that `recommendGear()` call — not
  earlier (a still-changeable recommendation shouldn't count as a real
  wear) and not deferred to the post-journey feedback prompt (Section 4.2),
  since that prompt is skippable and shouldn't gate whether wear gets
  recorded at all.

### 7.4 Home screen widget (native complexity — scope honestly)

A glanceable widget showing "next journey + top recommendation" is high
value but **cannot be built in Expo's plain managed workflow** — it needs a
native widget extension (`WidgetKit` on iOS, App Widgets on Android), which
means either `expo-dev-client` + a config plugin (e.g.
`react-native-android-widget` for Android; iOS widgets still require some
Swift/WidgetKit code even with Expo, there's no pure-JS path yet) or ejecting.
Full spec and phase placement is in Section 13.2 — it's sequenced after the
v1 core (Phases 1–11) since it's a separate native workstream, not because
it's undefined or optional.

### 7.5 Personal calibration from feedback

The warmth-level thresholds in the main engine are one reasonable default —
they won't match everyone, since people genuinely run hot or cold
differently. Rather than exposing five separate temperature-threshold
sliders in Settings (which nobody will tune correctly — see Section 3.6 for
the narrow, opt-in exception to this), calibrate from the low-friction
feedback prompt in Section 4.2, widened to a 5-point scale (Section 3,
`GearFeedback`) so "too warm" and "way too warm" move the offset by
different amounts:

```ts
// Section 3 — GearFeedback is 5-point, ordered coldest to warmest. Each
// value maps to a direction and magnitude relative to WARMTH_CALIBRATION_STEP:
// a "much_too_*" report moves the offset twice as far as a plain
// "too_*" one in the same direction, on the reasoning that someone who
// reaches for the more extreme option is telling you the gap was bigger.
const FEEDBACK_STEP_MULTIPLIER: Record<GearFeedback, number> = {
  much_too_cold: 2,
  too_cold: 1,
  just_right: 0,
  too_warm: -1,
  much_too_warm: -2,
};

async function applyGearFeedback(
  feedback: GearFeedback,
  current: WarmthCalibration,
  season: Season // Section 6.1 — the season the feedback journey actually happened in, not "now"
): Promise<WarmthCalibration> {
  const multiplier = FEEDBACK_STEP_MULTIPLIER[feedback];
  const now = new Date().toISOString();
  if (multiplier === 0) {
    return { ...current, lastFeedbackAt: now }; // "just right" still resets the decay clock (Section 7.5.3) — it's a real data point, not silence
  }
  const delta = multiplier * WARMTH_CALIBRATION_STEP;
  const seasonalOffsets = current.seasonalOffsets ?? { summer: current.offsetLevels, winter: current.offsetLevels, shoulder: current.offsetLevels };
  const seasonalSampleCounts = current.seasonalSampleCounts ?? { summer: 0, winter: 0, shoulder: 0 };
  const next: WarmthCalibration = {
    ...current,
    offsetLevels: clamp(current.offsetLevels + delta, -2, 2), // global fallback still updates too, so it stays a sensible default for a season with no samples yet
    sampleCount: current.sampleCount + 1,
    seasonalOffsets: { ...seasonalOffsets, [season]: clamp(seasonalOffsets[season] + delta, -2, 2) },
    seasonalSampleCounts: { ...seasonalSampleCounts, [season]: seasonalSampleCounts[season] + 1 },
    lastFeedbackAt: now,
  };
  await saveWarmthCalibration(next); // single-row SQLite upsert
  return next;
}

// Section 7.5.1 — what recommendGear() actually reads: prefer the current
// season's own offset once it has at least one sample, otherwise fall back
// to the global offsetLevels so a brand-new user (or a season that hasn't
// had feedback yet) still gets a sensible value instead of 0-with-no-history.
function resolveWarmthOffset(calibration: WarmthCalibration, season: Season): number {
  const seasonalCount = calibration.seasonalSampleCounts?.[season] ?? 0;
  if (seasonalCount > 0 && calibration.seasonalOffsets) {
    return calibration.seasonalOffsets[season];
  }
  return calibration.offsetLevels;
}
```

- Clamp every offset (global and seasonal) to ±2 — beyond that the
  calibration is more likely reflecting a one-off unusual day (sick, forgot
  a jacket, held a hot coffee) than a genuine baseline shift, and an
  unbounded offset could drift recommendations somewhere unsafe in
  genuinely cold conditions.
- This is a set of running offsets, not a model — no need for anything
  fancier than a small step per feedback event, per season, per axis.
- Show `sampleCount` next to the calibration value in Settings ("Adjusted
  from 12 check-ins") purely for transparency — it's not used in the
  calculation, just so the user can see the app isn't guessing blind. When
  seasonal data exists, show the per-season sample counts too (e.g. "Winter:
  adjusted from 5 check-ins · Summer: adjusted from 9"), so it's clear which
  season's number is actually driving today's recommendation.
- **Surface it in the moment, not just in Settings.** The first time
  `offsetLevels` (or the active season's offset) actually changes for each
  of the first ~3 occurrences, show a small non-blocking toast right after
  the feedback tap — "Noticed you run warm — dialing back a layer next
  time" (offset moved negative) or the cold-running equivalent. After those
  first few, stop showing it — this is a one-time "the app is learning"
  moment, not a recurring notification. Track a simple
  `calibrationToastsShown` counter (own row, alongside `WarmthCalibration`)
  to gate it.

#### 7.5.1 Seasonal calibration split

"I run warm" learned entirely from summer feedback doesn't necessarily
hold during a genuine Auckland cold snap, and vice versa — the two
situations call for different baseline adjustments. `WarmthCalibration`
(Section 3) tracks `seasonalOffsets`/`seasonalSampleCounts` per `Season`
(Section 6.1) alongside the original global `offsetLevels`/`sampleCount`,
which remain as the fallback for whichever season doesn't have samples
yet. `resolveWarmthOffset()` above is the single read path — nothing else
in the engine reads `calibration.offsetLevels` directly once seasonal data
exists for the relevant season. Settings (Section 9.1) shows all three
seasonal values together (not just the currently-active one) so the user
can see the full picture, with a one-line explanation of what "seasonal"
means here (see Section 9.1's copy).

#### 7.5.2 Wind-sensitivity axis

General warmth calibration (running hot/cold overall) and wind sensitivity
specifically are different things — someone can dress accurately for cold,
still-air mornings but consistently underestimate how much a windy stretch
affects them, or vice versa. `WarmthCalibration.windSensitivityOffset`
(Section 3) is a second, independent, smaller-range axis
(±`WIND_SENSITIVITY_OFFSET_CLAMP`) that only ever scales the annotation-
gated wind-tunnel bump in the main engine above — it never touches the base
`warmthLevel` calculation or any other delta. It isn't fed by the same
post-journey feedback prompt as `offsetLevels` (that prompt is about the
overall gear call, not wind specifically); instead, expose it directly in
Settings as a small three-position control ("Less bothered by wind" /
"Average" / "More bothered by wind"), each mapping to a fixed value
(-1 / 0 / +1) rather than a free slider, since there's no natural feedback
loop to learn this one from automatically. See Section 9.1 for the
required explanation copy.

#### 7.5.3 Calibration decay

A calibration value with no recent feedback is stale, not necessarily
wrong, but there's no way to tell the difference without checking — someone
who calibrated "runs warm" from a run of mild autumn mornings and then
stopped giving feedback for four months shouldn't have that value silently
govern a midwinter recommendation. Any bucket (`offsetLevels`, each entry
in `seasonalOffsets`, and `windSensitivityOffset`) whose most recent
contributing feedback is older than `CALIBRATION_DECAY_AFTER_DAYS` (60) is
nudged `CALIBRATION_DECAY_STEP` (0.25) closer to 0 each time the decay
check runs, rather than left frozen indefinitely. Run the check on app
foreground (cheap, local-only — no new background task needed) using
`lastFeedbackAt` as the reference point; Section 12.2's dev menu should
expose a manual "run calibration decay now" trigger so this is testable
without waiting 60 real days. Decay stops once an offset reaches 0 — it
never overshoots into the opposite sign.

### 7.6 Sun and low-light gear

Rain and cold aren't the only conditions worth dressing for — Open-Meteo's
`uv_index` and `is_day` fields (already requested per-leg, Section 2) cover
the other common cases:

```ts
function applySunProtection(
  accessories: LayerPick[],
  available: ClothingItem[],
  outdoorLegs: JourneyLeg[],
  notes: string[]
) {
  // Effective UV per leg reuses the same highReflection offset as the main
  // engine's sunLeg check (Section 7.8) — one composed number, not a
  // separate reflection-specific accessory threshold to keep in sync.
  const effectiveUv = (l: JourneyLeg) => l.weather!.uvIndex + (l.highReflection ? HIGH_REFLECTION_UV_OFFSET : 0);
  const maxEffectiveUv = Math.max(...outdoorLegs.map(effectiveUv));
  if (maxEffectiveUv < HIGH_UV_INDEX) return;
  const sunglasses = available.find(c => c.tags?.includes("sunglasses"));
  accessories.push(sunglasses ?? { fallbackText: "UV is high — sunglasses/a hat recommended", layerType: "accessory" });
  const anyReflective = outdoorLegs.some(l => l.highReflection);
  notes.push(
    anyReflective
      ? `UV index reaching ${Math.round(Math.max(...outdoorLegs.map(l => l.weather!.uvIndex)))} today, higher still with reflection off sand/water`
      : `UV index reaching ${Math.round(maxEffectiveUv)} today`
  );
}

function applyDarknessGear(
  accessories: LayerPick[],
  available: ClothingItem[],
  outdoorLegs: JourneyLeg[],
  notes: string[]
) {
  const anyDarkLeg = outdoorLegs.some(l => l.weather && !l.weather.isDaylight);
  if (!anyDarkLeg) return;
  const reflective = available.find(c => c.tags?.includes("reflective"));
  if (reflective) {
    accessories.push(reflective);
    notes.push("Part of this trip is in the dark — reflective gear picked");
  } else {
    notes.push("Part of this trip is in the dark — consider something reflective or a light, if you own one");
  }
}
```

Both functions only add to `accessories`/`notes` when relevant — most
journeys hit neither, and the card stays uncluttered on a normal daylight,
low-UV commute. `ClothingItem.tags` (Section 3) is how the engine tells a
pair of sunglasses or a reflective vest apart from a plain wool hat — the
onboarding gear checklist (Section 4.1) and Gear CRUD screens should let the
user attach tags when adding an accessory, with `sunglasses`/`reflective`/
`gloves`/`hat`/`scarf`/`socks` offered as quick-select chips rather than
free text, so the engine can actually rely on matching against them. The
same quick-select mechanism applies to jackets/midlayers/bottoms, offering
`cycling` (Section 7.9) and `formal` (Section 7.10) chips there, so
`pickLayer()`'s `preferTags` has something real to match against —
`bottoms` (Section 7.13) reuses the identical two chips rather than
introducing legwear-specific ones.

### 7.7 Unavailable gear

An item that's in the wash, lost, or at the dry cleaner shouldn't keep
getting recommended with false confidence. Every selection function above
(`pickLayer`, the umbrella `find`, the shoe filter) already checks
`isAvailable(item, journey.departTime)` before considering an item a
candidate — this section just covers the UI side: the Gear CRUD screens
(Section 4) need a lightweight "mark unavailable until…" action per item
rather than requiring the user to delete and re-add an item they still own
but can't currently wear. An unavailable item still shows in its Gear list
(greyed out, with the return date) — it's excluded from recommendations,
not from inventory.

The action now includes a reason picker (`unavailableReason`, Section 3):
Laundry / Repair / Lost / Other, each with its own sensible default
turnaround the user can still adjust — Laundry defaults to
`LAUNDRY_DEFAULT_TURNAROUND_DAYS` (2 days, a realistic wash-and-dry cycle),
Repair/Other default to +3 days as before, Lost defaults to no date (open-
ended until the user finds it or deletes the item). Choosing "Laundry"
also resets `wearsSinceClean` to 0 and clears `needsCleaning` (Section
7.16) in the same action — one combined write, since marking something as
being washed and resetting its wear count are really the same event. The
Gear list shows the specific reason rather than a generic "Unavailable"
("In the laundry — back Thursday" vs. "Being repaired — back Thursday").

### 7.8 Feels-like adjustments: wind, sun, and puddles

These signals (Sections 3.4, 5.5) adjust `recommendGear()` without needing
any new API call beyond what Section 2/6.2 already requests. **All of the
adjustments below are hyper-local corrections layered on top of
`apparentTempC` (Section 6.2), not a restatement of general ambient
conditions** — `apparentTempC` already incorporates Open-Meteo's own
wind/humidity/solar model for the general area, so there is no separate
"is it windy today" or "is it sunny today" check here. These only fire when
an `EnvironmentAnnotation` (Section 3.4) says a *specific* street or spot
deviates from that citywide baseline.

- **Wind chill (annotation-gated)** only fires on a leg flagged
  `windEffect === "amplified"` (a wind-tunnel annotation) whose effective
  wind (raw `windKph` × `WIND_TUNNEL_MULTIPLIER`) clears `WIND_CHILL_KPH`.
  This is deliberately separate from `HIGH_WIND_KPH` (the umbrella-rating
  threshold, 30kph, using `windGustKph` — Section 6.2) — wind chill affects
  *layering*, umbrella rating affects *which umbrella survives being
  outside*, and there's no reason those two thresholds or fields need to
  match. **`WIND_CHILL_KPH` is 15, not 20** — corrected from an earlier
  draft. The standard NWS/Environment Canada wind-chill formula shows a
  real, human-noticeable feels-like depression (~2°C) already at around
  15kph of sustained wind at typical Auckland winter temperatures, and
  Auckland's own average wind speed (14–18kph) sits right at that point —
  a threshold at or above the city's average was suppressing a real effect
  on an ordinary day rather than reserving the note for something unusual.
  How often a true effect fires isn't a reason to raise the bar for
  reporting it. One caveat worth carrying forward rather than hiding: that
  formula is formally validated only for ambient temperatures at or below
  ~10°C, and a lot of Auckland's "cool and breezy" mornings sit a few
  degrees past that — treat the resulting `apparentTempC` in that band as a
  well-grounded approximation, not an exact physiological reading, the same
  spirit as Section 5.3's forecast-confidence caveat. The `+1` bump this
  produces is itself scaled per-user by `WarmthCalibration.windSensitivityOffset`
  (Section 7.5.2) — someone who's told the app they're more bothered by
  wind than average gets a slightly larger bump here specifically, without
  changing how any other, non-wind delta behaves.
- **Direct-sun/reflection warming (annotation-gated)** only fires on a leg
  flagged `sunEffect === "exposed"`, when it's actually daylight
  (`isDaylight`) and UV is high (reusing `HIGH_UV_INDEX` — the same
  threshold that already drives sunglasses in Section 7.6, and which
  matches the WHO UV index scale's official "High" band starting at 6).
  It's a one-level warmth reduction, the same nominal magnitude as the
  wind-tunnel bump, so a windy-tunnel-but-sunny-exposed leg can net to no
  change — a simplification worth naming honestly: published outdoor
  thermal-comfort research doesn't agree on whether wind or sun has the
  larger effect (it's highly context-dependent — cloud cover, sun angle,
  wind speed all matter, and different field studies have found each
  effect larger than the other), so treating them as equal-and-opposite
  here is a defensible approximation, not a precisely-measured tradeoff.
  `sun-exposed` annotations don't add an *extra* reduction beyond the
  UV-index check — they exist mainly to override a `shaded` assumption
  that wouldn't otherwise trigger, not to stack with it. A `highReflection`
  leg (Section 3.4/3.5) composes into the *same* check by lowering the
  effective threshold via `HIGH_REFLECTION_UV_OFFSET`, rather than adding a
  second reduction — a beach leg still only ever costs one warmth level,
  it's just easier to trigger than a shaded-city-street leg at the same raw
  UV reading.
- **Puddle risk** is scoped to footwear only, never jacket/umbrella
  choice — by definition it's checked because current conditions are dry
  (a currently-raining leg is already caught by `needsWaterproof`), so
  there's nothing for a jacket to protect against beyond what's already
  handled. It's also intentionally coarse (one boolean per journey, not
  per-leg precision) — see Section 5.5 for why a single
  `recentPrecipMm6h` value is reused across all of a journey's legs.
- **Rain cover** is the one signal here that's informational only — it
  doesn't change *whether* to bring an umbrella (the uncovered part of the
  route still needs one), just adds a note setting expectations for the
  covered stretch.
- All of the notes these adjustments add follow the voice guide (Section
  9.0.1) — naming the specific leg/annotation rather than a generic
  "it'll feel different than expected," since specificity is the entire
  point of this feature.

### 7.9 Stationary waits, cycling exertion, and carry preference

Three related refinements to how the engine reasons about *how* someone is
moving through a journey, not just what the weather is doing — grouped here
since all three touch the same warmup/exertion logic in the core function
above rather than adding an independent adjustment like Section 7.8's.

- **Stationary waits** (`JourneyLeg.isStationary`, Section 3.5, wired in
  Section 5.6): standing on an open platform for a delayed train, or
  waiting in a pickup queue, is outdoor exposure with none of the
  body-heat generation a walking leg assumes. `totalOutdoorStationaryMinutes()`
  totals this time separately from `totalOutdoorExertionMinutes()`, and a
  wait of `STATIONARY_WAIT_MIN_MINUTES` or more in cool-or-colder
  conditions bumps `warmthLevel` up by one — the same direction and
  magnitude as wind chill (Section 7.8), on the reasoning that "cold and
  standing still" behaves more like "cold and windy" than "cold and
  walking." Critically, a stationary leg is *excluded* from the warmup
  discount below — it must never accidentally count toward the minutes
  that make a recommendation lighter.
- **Cycling exertion**: `totalOutdoorExertionMinutes()` evaluates `walk`
  and `cycle` legs against separate thresholds
  (`WARMUP_WALK_MIN_MINUTES` vs. the lower `WARMUP_CYCLE_MIN_MINUTES`),
  since sustained cycling builds body heat faster than walking over the
  same duration — the original single shared threshold undersold how much
  lighter a cyclist can dress for a given temperature. A journey with both
  a walking leg and a cycling leg earns the discount from whichever one
  actually clears its own threshold, and the note names whichever exertion
  type qualified rather than a generic "walking" label. `pickLayer()`
  additionally biases toward a `"cycling"`-tagged jacket or trouser
  (Section 3, `ClothingItem.tags`) when the journey has any cycling
  minutes and `needsWaterproof` is true, since cycling rain gear (a
  cycling-cut waterproof, less bulky at the knees) is a genuinely
  different pick from a standing-still-friendly walking shell.
- **Carry preference** (`CarryPreference`, Section 3, 4.3.1, 9.1): someone
  moving between classes or meetings with a full bag often won't actually
  carry a spare layer even when the engine would otherwise recommend a
  packable one. `recommendGear()` takes the resolved `CarryPreference` as
  a parameter — the caller resolves `journey.carryPreference ??
  <Settings default>` before calling — and when it's `"avoid-spares"`,
  overrides the AC-contrast branch's `requirePackable = true` back to
  `false`, trading the removable-layer strategy for the warmest single
  wearable layer and a note explaining the tradeoff ("Skipping a spare
  layer per your preference — the bus AC may feel cold"). This is a
  deliberate user-chosen override of Section 6.1's AC-contrast logic, not
  a bug in it.
- **Explicitly out of scope**: tracking or suggesting a post-cycling
  change of clothes (e.g. "you'll arrive sweaty") is not a gear
  *recommendation* concern — this app tells you what to wear, not what to
  pack as a spare outfit — and is left out entirely rather than half-built
  as a stray note, keeping the engine's output limited to items it can
  actually resolve from `Inventory`.

### 7.10 Formal-occasion mode

`Journey.formal` (Section 3, set via the Plan-screen toggle in Section
4.3.1) changes what `recommendGear()` optimizes for: appearance-appropriate
items over the usual grip/waterproof-first selection, on the reasoning that
someone dressing for a wedding or a work function would rather carry an
umbrella than show up in technically-optimal but visually-wrong footwear.

- **Shoes**: when `isFormal` is true, the engine looks for an available
  `ShoeItem` with `type === "formal"` *before* falling back to the normal
  grip/waterproof sort — `ShoeType` already includes `"formal"` (Section
  3), so this needed no new data model, only a reordered selection path. If
  the chosen formal shoe isn't waterproof and conditions call for one, a
  note says so explicitly rather than silently downgrading
  weather-appropriateness without explanation — the umbrella is doing the
  weather-protection work in this mode, not the shoe.
- **Layers**: the wind-chill `+1` adjustment (Section 7.8) is suppressed
  when `isFormal` is true — a heavy added layer is more likely to clash
  with the occasion than help, so the engine relies on the umbrella pick
  and a note instead. The AC-contrast and warmup-discount logic are
  unaffected; formal mode changes what's *added* for wind, not the
  baseline warmth calculation.
- `pickLayer()` also biases toward `"formal"`-tagged jackets/midlayers
  (Section 3, `ClothingItem.tags`) the same way it biases toward
  `"cycling"`-tagged ones in Section 7.9, via the shared `preferTags`
  parameter.

### 7.11 Hike engine adjustments

Full context in Section 13.8 (Phase 20) — this subsection covers only how
`recommendGear()` itself changes for a `hike` leg (Section 3, 3.5, 5.7),
since a multi-hour, elevation-varying leg doesn't reduce to a single
`weather` reading the way every other leg type does:

- Wherever the core function reads `l.weather!.apparentTempC`/`.windGustKph`/
  etc. for an ordinary outdoor leg, a `hike` leg instead contributes the
  *worst* (coldest / gustiest) reading across its `hikeSamples[]` array —
  i.e. `minTemp` and `maxGust` fold in `Math.min`/`Math.max` across every
  sample point, not just the leg as a whole, so a summit's colder, gustier
  conditions aren't averaged away by a milder trailhead reading. Note that
  `apparentTempC`'s own wind/humidity/solar model (Section 6.2) is computed
  by Open-Meteo per sample point already, so no separate per-sample
  wind-chill calculation is needed here beyond that fold.
- The warmup discount uses a third exertion threshold,
  `WARMUP_HIKE_MIN_MINUTES` (set higher than both `WARMUP_WALK_MIN_MINUTES`
  and `WARMUP_CYCLE_MIN_MINUTES` — sustained hiking effort still builds
  heat, but elevation gain adds a countervailing cooling effect a flat
  urban walk doesn't have to account for), evaluated against the hike
  leg's total duration rather than folded into
  `totalOutdoorExertionMinutes()`'s walk/cycle split.
- Forecast confidence (Section 5.3) matters more here, not less — hikes
  are disproportionately planned days ahead. When any of a hike leg's
  `hikeSamples[].weather.forecastConfidence` is `medium`/`low`, add a note
  to that effect even though Journey Detail's confidence banner (Section
  9.3) already surfaces it visually, since a multi-hour hike is a worse
  place to be caught by a wrong forecast than a 10-minute commute and
  deserves the redundancy.
- Named constants for this subsection (`WARMUP_HIKE_MIN_MINUTES` and any
  elevation-gain offset the agent tunes in) belong alongside the rest of
  Section 7's threshold block when Phase 20 is implemented, following the
  same "thresholds as named constants, don't touch control flow" rule the
  rest of this section already follows.
- The severe-weather advisory (Section 7.14) already accounts for `hike`
  legs via this same `hikeSamples[]` fold, written now alongside the rest
  of `recommendGear()` even though it stays effectively dead code until
  `mode === "hike"` legs actually exist (Phase 20) — consistent with
  `hikeSamples` itself being in the Phase 1 schema early for the same
  reason (nothing before Phase 20 writes to it, but the shape is right).

### 7.12 Dual-purpose jackets (jacket-absorbs-midlayer)

Some jackets already do a midlayer's job — a rain shell with a built-in
thin puffer lining is the motivating example: it's simultaneously the
`waterproof` pick for a wet leg and warm enough that nothing needs to go
under it. Without this section, `layerPlanForWarmthLevel()` would still
resolve `["midlayer", "jacket"]` at warmth level 3 and `pickLayer()` would
fill both slots independently, telling the user to add a separate midlayer
underneath a jacket that's already doing that job.

- `ClothingItem.substitutesForMidlayer` (Section 3.6) marks an item as
  capable of this. It's a per-item boolean the user sets explicitly in the
  Gear CRUD form when adding/editing a jacket — the engine never infers it
  from `warmth` alone, since a high `warmth` rating on its own doesn't tell
  the engine whether the item is cut/insulated to actually replace a
  separate layer versus just being a heavy jacket meant to go over one.
- After the normal layer resolution (main function, step 4), if a
  `midlayer` slot was resolved *and* the resolved `jacket` is a real owned
  item (not `fallbackText`) with `substitutesForMidlayer: true` *and* its
  own `warmth` already meets or exceeds the leg's target warmth, the
  midlayer is dropped from the final `layers[]` and a note explains why
  ("Your Blue rain shell is warm enough on its own — no separate midlayer
  needed underneath") rather than silently shrinking the recommendation
  with no explanation.
- If the substitutable jacket is unavailable this trip (Section 7.7) or
  wasn't the item actually picked (e.g. a warmer non-substituting jacket
  won the sort instead), the normal two-slot plan applies unchanged — this
  only fires when the specific substitutable item is the one being
  recommended.
- Deliberately scoped narrowly to jacket-absorbing-midlayer only, not a
  general "any item can stand in for any layer" system — see the note in
  `DECISIONS.md` on why this stays a single boolean rather than a more
  general substitution graph, which would be a genuinely different scale
  of change (the same category of decision as the multi-user (Section 2.2)
  and cloud-sync (Section 13.7) scope calls elsewhere in this spec).

### 7.13 Legwear (bottoms)

Before this section, the engine had no concept of trousers/leggings at
all — `ClothingType` covered only torso layers and accessories, despite
`pickLayer()`'s own comments elsewhere referencing a "trouser" as if it
were already a recommendable type. `"bottoms"` (Section 3) fills that gap,
evaluated independently of the base/midlayer/jacket stack in the main
function's step 4.5, since legwear doesn't "layer" the way torso items do
— there's one bottoms slot, not an ordered stack.

- **When it fires**: only two triggers, both narrow on purpose so a normal
  mild/dry commute doesn't get a redundant "regular trousers are fine"
  slot cluttering the card (Section 9.3 omits `Recommendation.bottoms`
  entirely when `undefined`, the same "hide, don't reserve space" pattern
  layers/accessories already use):
  - **Thermal**: `warmthLevel >= BOTTOMS_COLD_WARMTH_LEVEL` (4) — a
    genuine cold snap, the same tier that already triggers the full
    base+midlayer+jacket stack.
  - **Waterproof**: `needsWaterproof && maxGust >= HIGH_WIND_KPH` — reusing
    the exact same gust field and threshold as the umbrella-survival check
    (Section 6.2/7.8). The reasoning: a leg wet *and* windy enough to
    threaten an umbrella is also wet+windy enough that ordinary trousers
    are genuinely miserable, not just a jacket-and-umbrella problem. Plain
    rain without that wind isn't enough on its own — an umbrella already
    covers that case adequately.
- **Selection**: reuses `pickLayer()` directly rather than a separate
  function — `pickLayer(inventory, "bottoms", warmthLevel * 2.5,
  needsWaterproofBottoms, false, journey.departTime, preferTags)`. The same
  `preferTags` array computed for the layers stack (cycling/formal,
  Section 7.9/7.10) applies here too, so a cycling-tagged legging or a
  formal-tagged trouser is preferred the same way a cycling/formal jacket
  already is.
- **`requirePackable` is always `false` for bottoms** — the AC-contrast
  packable requirement (Section 6.1) is specifically about a removable
  torso layer for a bus/train temperature swing; trousers aren't
  reasonably "packable" in the same sense, so this never applies to the
  bottoms slot.
- **Fallback text** falls out of `pickLayer()`'s existing generic fallback
  ("No available bottoms for these conditions") with no extra code needed,
  since `ClothingType` already includes `"bottoms"` end to end.

### 7.14 Severe-weather advisory

Everything in this section up to now only ever changes *what to wear* —
nothing tells the user that today's conditions might mean reconsidering
*whether* to walk or cycle at all, despite the engine already tracking
storm-level `severity` and gust speed. `Recommendation.severeWeatherAdvisory`
(above) closes that gap as a single suggestion sentence, kept deliberately
narrow:

- **Trigger**: any `walk`, `cycle`, or `hike` leg where `severity >=
  SEVERE_WEATHER_SEVERITY` (4, "Stormy") or `windGustKph >=
  SEVERE_GUST_KPH` (60 — well above `HIGH_WIND_KPH`'s 30kph
  umbrella-survival threshold, since this is about the walk/cycle/hike
  itself being unpleasant or unsafe, not just an umbrella surviving it). A
  `hike` leg checks this against the worst reading across its
  `hikeSamples[]` (Section 7.11's established fold), not a single
  `.weather` reading, which hike legs don't populate. Deliberately excludes
  `drive`/`bus`/`train`/indoor legs — a storm is the driver's or transit
  operator's problem on those modes, not a clothing or route-choice one for
  the rider. Hike is included deliberately rather than as an oversight — a
  multi-hour, elevation-varying, exposed leg is arguably the case this
  advisory matters most for, not a marginal one.
- **Not a blocking action**: this is a suggestion surfaced as its own
  banner on Journey Detail (Section 9.3), not a modal, not a re-routing
  prompt, and not folded into `notes[]` (which is about gear reasoning,
  not mode reasoning). The user can plan and depart exactly as before;
  the advisory is informational.
- **Consistent with the app's existing safety stance**: Section 13.8
  (hike mode) already draws an explicit line that this app "recommends
  clothing from the user's own inventory; it is not a hiking safety app."
  This advisory doesn't cross that line — it's one sentence derived from
  data the engine already has, not a live weather-safety monitoring
  feature, live tracking, or anything that implies the app is watching
  out for the user beyond the single planning-time check.
- **Only the worst matching leg is named** — if multiple legs qualify,
  the first one found is used for the sentence (consistent with
  `worstOutdoor`'s "first sufficiently bad match" pattern elsewhere in
  this function); a journey rarely has more than one severe leg, and
  naming all of them would turn one sentence into several.

### 7.15 Hot-weather guidance

The engine is otherwise entirely cold-direction: `warmthLevelFromTemp()`
bottoms out at level 0 for anything at or above `WARM_OUTDOOR_C`, and
level 0 means "no extra layer" with no further guidance — silent on a
genuinely hot, humid Auckland summer day rather than offering anything
positive. `HOT_C` (24°C, deliberately higher than `WARM_OUTDOOR_C`'s 18°C
so this doesn't fire on every merely-mild day) adds a single note when any
outdoor leg's `apparentTempC` reaches it: "Warm enough today that
something breathable and light-colored will feel better than your usual
pick."

- **Note only, not an item pick** — there's no `breathable` attribute on
  `ClothingItem` to match against, so the engine can flag the condition
  honestly but can't resolve a specific breathable item the way it
  resolves a jacket or umbrella. Adding a `breathable` boolean/tag and
  biasing `pickLayer()`'s base-layer sort toward it (the same `preferTags`
  mechanism already used for cycling/formal) is a natural next step if
  this proves not enough, but is left out here deliberately rather than
  half-built — see `DECISIONS.md`.
- Composes normally with the rest of the notes array; a hot, high-UV,
  daylight leg can reasonably show both this note and the sun-protection
  note from Section 7.6 in the same recommendation, since they're
  independent signals.

### 7.16 Wardrobe rotation & wash reminders

Section 3.7 introduces the data shape (`wearsSinceClean`, `lastWornAt`,
`needsCleaning`, `unavailableReason`); this section covers the mechanism
that actually updates it.

```ts
// Called once per completed Journey — the same trigger point as the
// post-journey feedback prompt (Section 4.2) and the RecommendationSnapshot
// freeze (Section 7.3), i.e. departTime + total leg duration has passed.
// NEVER called from inside recommendGear() itself: recommendGear() must
// stay a pure function with no I/O (Section 11.1) and can legitimately be
// called many times against the same still-future Journey (re-planning,
// forecast-drift refreshes, Section 5.2) without each call counting as a
// real-world "wear." `warmOutdoorC` is passed in rather than re-read from
// the raw named constant, so a user's `AdvancedWarmthThresholds` override
// (Section 3.6) is respected here the same way it already is inside
// `recommendGear()` — the call site (Section 7.3) already has this
// resolved value on hand from the same `recommendGear()` call whose output
// is being frozen, so it costs nothing extra to pass along.
async function recordWear(recommendation: Recommendation, journey: Journey, warmOutdoorC: number): Promise<void> {
  const wornItems = [
    recommendation.bottoms,
    recommendation.shoes,
    ...recommendation.layers,
    // Section 7.16 — accessories are otherwise excluded from wear tracking
    // (see the note below), but a sock-tagged item is the one clear
    // exception: it's a real recommended item (Section 7.6 pushes any
    // available non-sunglasses accessory, socks included, once cold enough)
    // and genuinely needs washing as often as a base layer does.
    ...recommendation.accessories.filter(a => "id" in a && a.tags?.includes("socks")),
  ].filter((item): item is ClothingItem | ShoeItem => !!item && "id" in item);
  const sweaty = isSweatyConditions(journey, warmOutdoorC);
  for (const item of wornItems) {
    const wearsSinceClean = (item.wearsSinceClean ?? 0) + 1;
    await updateItemWearTracking(item.id, {
      wearsSinceClean,
      lastWornAt: journey.departTime,
      needsCleaning: sweaty || wearsSinceClean >= WASH_REMINDER_WEAR_COUNT,
    });
  }
}

// Reuses the exact same exertion signals already computed for the warmup
// discount (Section 7.9) — sustained walking/cycling exertion in
// warm-enough conditions is the same "you probably worked up a sweat"
// proxy either way, so this doesn't introduce a second definition of it.
function isSweatyConditions(journey: Journey, warmOutdoorC: number): boolean {
  const walkingMinutes = totalOutdoorExertionMinutes(journey, "walk");
  const cyclingMinutes = totalOutdoorExertionMinutes(journey, "cycle");
  const hasWarmOutdoor = journey.legs.some(l => l.outdoor && l.weather && l.weather.apparentTempC >= warmOutdoorC);
  return hasWarmOutdoor && (walkingMinutes >= WARMUP_WALK_MIN_MINUTES || cyclingMinutes >= WARMUP_CYCLE_MIN_MINUTES);
}
```

- **Accessories (other than socks) and umbrellas are deliberately
  excluded** from `wornItems` — an umbrella doesn't need "washing" the way
  clothing does, and cold-weather accessories like gloves/hats/scarves are
  a lower-value target for this reminder than the layers/bottoms/shoes
  that actually touch skin and generate sweat; left out to keep the
  reminder meaningful rather than noisy. A sock-tagged accessory item is
  the deliberate exception (see `recordWear()` above) — it's exactly the
  kind of item that needs washing as often as a base layer, and singling
  it out by tag is simpler and more honest than either tracking every
  accessory or excluding socks along with gloves/hats for no good reason.
- **`needsCleaning` is a reminder, never an automatic exclusion.** A
  flagged item still gets recommended by `pickLayer()`/the shoe sort until
  the user actually acts on it — nothing in `isAvailable()` (Section 7)
  reads `needsCleaning`. Only `unavailableUntil` excludes an item, and
  that's still only ever set by an explicit user action.
- **"Mark as washing" action** (Gear list badge, Section 4/9.4.1): sets
  `unavailableUntil = now + LAUNDRY_DEFAULT_TURNAROUND_DAYS`,
  `unavailableReason = "laundry"`, resets `wearsSinceClean = 0`, and clears
  `needsCleaning` — one combined write, not three separate ones the user
  has to trigger.
- **Not a rotation algorithm.** This never changes `pickLayer()`'s sort
  order or deprioritizes a recently-worn-but-clean item in favor of an
  equally-suitable one that's been worn less — it only ever tells the user
  "this one probably needs a wash." See Section 3.7 for why active
  rotation was deliberately left out.

---

## 8. Build phases (build in this order)

1. **Scaffold** — Expo + TypeScript project, navigation shell (4 tabs +
   Journey Detail + History + Onboarding stack screens), SQLite schema
   matching Section 3's types (including `RecurrenceRule`, `WarmthCalibration`
   with its seasonal/wind-sensitivity/decay fields (Section 3, 7.5.1-7.5.3),
   `AdvancedWarmthThresholds` (Section 3.6), `SavedRoute`,
   `RecommendationSnapshot`, `EnvironmentAnnotation` (with its
   `high-reflection` effect value), the `hasReliableClimateControl` field on
   `SavedLocation`, the `templateId` / `linkedReturnJourneyId` / `feedback` /
   `savedRouteId` / `recommendationSnapshot` / `waypoints` /
   `carryPreference` / `formal` fields on `Journey`, `isFavorite`/
   `lastUsedAt` on `SavedLocation`, the `unavailableUntil` / `unavailableReason`
   / `tags` / `substitutesForMidlayer` / `wearsSinceClean` / `lastWornAt` /
   `needsCleaning` fields on inventory items (Section 3, 3.7, 7.16) and the
   widened 1-10 `warmth` scale (Section 3.6) rather than the original 1-5
   range, the `"bottoms"` `ClothingType` (Section 3, 7.13), the 5-point
   `GearFeedback` type (Section 3), and the `isStationary` /
   `waitContext` / `highReflection` fields on `JourneyLeg` (`hikeSamples` and
   `HikeRouteSample` can wait for Phase 20, Section 13.8, since nothing
   before then writes to them), plus the indices from Section 3.2), empty
   CRUD screens, the `src/services/` layer skeleton (Section 12.1), and the
   lightweight CI workflow (Section 12.3) — set these two up now so every
   later phase benefits from them rather than retrofitting.
2. **Onboarding + Gear/Locations CRUD** — the first-run flow from Section 4.1
   (permission priming → Home/Work → live demo card → self-report warmth
   question (Section 4.1, 7.5.1) → gear basics with inline photo capture,
   Section 3.3, using the 1-10 warmth slider and jacket-only
   `substitutesForMidlayer` toggle from Section 9.1.2, plus the optional
   fourth bottoms/trousers entry (Section 3, 7.13) → crash-reporting
   opt-in), plus fully working add/edit/delete for all 4 inventory
   categories and saved locations — including tag chips for accessories
   (Section 7.6), the same shared warmth slider/dual-purpose toggle in the
   full Gear CRUD form (Section 4, "Gear" bullet) now including the
   `"bottoms"` `ClothingType` option, photo capture/display
   (Section 3.3), favoriting (Section 4.3), the "Reliable AC/heating here?"
   toggle (Section 4, Locations bullet), and the "mark unavailable until…"
   action with its Laundry/Repair/Lost/Other reason picker (Section 7.7,
   9.4.3) — persisted locally. The wash-reminder badge itself (Section
   7.16, 9.4.3) can be built here too, since it's just UI reading
   `needsCleaning`; it will simply never fire yet, since nothing writes
   `wearsSinceClean`/`needsCleaning` until `recordWear()` exists (Phase 8).
   The live demo card is the one place in this phase
   that needs a real network call (a single Open-Meteo request) ahead of
   Phase 4; everything else stays local/mocked.
3. **Journey planning with mocked data** — Plan screen (including the
   recurrence day-picker, "plan return trip too" toggle, saved-route
   quick-pick row/"save this route" toggle from Section 4.3, and the "Add a
   stop" waypoint affordance, "Formal occasion" toggle, and carry-preference
   chip from Section 4.3.1) wired to a hardcoded `Journey` object, so the
   Journey Detail UI (list + map, per Section 9's fully-specified layout)
   can be built and looks right before real APIs are wired in. The
   waypoint/formal/carry-preference controls only need to write to the
   mocked `Journey` object at this stage — their actual effect on routing
   (Phase 4) and the recommendation engine (Phase 5) comes later.
4. **Live weather + routing** — replace the mock with real Google Routes +
   Open-Meteo calls per Section 5's data flow (requesting `uv_index`,
   `is_day`, `apparent_temperature`, `wind_gusts_10m`, and
   `relative_humidity_2m` alongside the existing fields, per Section 2/6.2),
   including passing `Journey.waypoints` as `intermediates` on the same
   `computeRoutes` call when present (Section 5.5), the offline/failure
   handling in Section 5.1, and the forecast-confidence stamping in
   Section 5.3.
5. **Recommendation engine** — implement Section 7's multi-layer + accessory
   logic (unavailability filtering included from the start, since it's
   cheap to add now vs. retrofitting later) against the user's actual saved
   inventory, surfaced on both Today cards and Journey Detail per the layout
   in Section 9.3–9.4. Includes the cycling-exertion warmup split, the
   `CarryPreference` override, the formal-occasion shoe/layer logic
   (Sections 7.9, 7.10), the `substitutesForMidlayer` dual-purpose-
   jacket resolution (Section 7.12), the `bottoms` legwear slot (Section
   7.13), the severe-weather advisory (Section 7.14), and the hot-weather
   note (Section 7.15) from the start, since all of these read Journey- or
   item-level fields the engine needs to handle regardless of
   how thin the initial inventory is. Build the Settings screen here too
   (theme picker plus the `CarryPreference` default toggle, the
   single-user-scope disclosure line, and the "Advanced" threshold-override
   disclosure from Section 3.6/9.1.1 wired to the resolved-thresholds
   parameter on `recommendGear()`, though it can default to fully collapsed
   and untouched at this phase) — the engine needs a default to fall back
   to before a per-trip override makes sense. Wire the recurring-journey
   materialization logic from Section 3 into the Today tab, plus the "Right
   now" quick-check card and "Leaving now" action from Section 4.2 (per
   Section 4.2's clarification, the reduced path never triggers bottoms,
   the severe-weather advisory, or wear tracking, so don't build those
   paths against it).
6. **Environment annotations & location overrides** — the `EnvironmentAnnotation`
   CRUD flow (Local knowledge screen + in-context map long-press, Section
   4.5, including the `high-reflection` effect type alongside the original
   four), the `past_days`/`recentPrecipMm6h` addition to the existing
   Open-Meteo call, the annotation-matching and climate-override wiring
   (Section 5.5, now also applied to `Journey.waypoints` stops, not just
   origin/destination), and the wind/sun/reflection/puddle/rain-cover
   adjustments to `recommendGear()` (Section 7.8). Sequenced right after the
   recommendation engine specifically because it modifies that engine's core
   warmth calculation rather than sitting alongside it — building it before
   Phase 5 exists would mean writing the adjustments against a function that
   isn't there yet, and leaving it much later would mean revisiting
   `recommendGear()` a second time after Phases 7–9 have already built on
   top of it.
7. **Auckland Transport live data** — bus/train legs pull real departure times
   and delay/alert info, and stationary wait legs (Section 3.5, 5.6, 7.9)
   are inserted ahead of each bus/train leg, sized off the reported delay —
   sequenced here specifically because the wait-leg duration depends on
   this phase's live delay data existing; before this phase there's nothing
   to size a wait leg's duration from beyond the flat 5-minute fallback.
8. **Leave-by notifications** — Section 7.3's scheduled local notifications,
   triggered off both initial planning and recurring-occurrence
   materialization, rescheduled on live delay updates from Phase 7,
   freezing `RecommendationSnapshot` at fire time, and calling
   `recordWear()` (Section 7.16) against that same final `Recommendation`
   so wear tracking and wash reminders start accumulating from here
   onward — this is the first phase where `needsCleaning` can actually
   ever become true.
9. **History** — the read-only History screen from Section 4.4, reading
   real `Journey` rows (including their `recommendationSnapshot`) now that
   Phases 4–8 actually produce them. Straightforward once the data exists;
   sequenced here rather than earlier because there's nothing real to show
   before this point.
10. **Personalization & extended signals** — the 5-point feedback prompt and
    calibration loop including the calibration toast, the seasonal offset
    split, the wind-sensitivity Settings control, and calibration decay
    (Sections 4.2, 7.5, 7.5.1-7.5.3, 9.1.1), sun/darkness gear logic
    (Section 7.6), and the forecast drift re-check +
    notification updates (Section 5.2). This phase depends on Phases 4–8 all
    being live, since it layers on top of real weather data, real
    notifications, and a working recommendation engine.
11. **Polish** — map marker styling for weather badges (including
    `EnvironmentAnnotation` pins, Section 9.1), the per-API offline/
    failure states from Section 5.1 (Routes, Open-Meteo, AT GTFS each have
    distinct fallback UX — implement all three, not just a generic spinner/
    error toggle), accessibility pass per Section 9.6, the voice & copy
    guide (Section 9.0.1) applied as a pass across all existing
    notification/empty-state/toast copy, and the full unit test suite from
    Section 11 (don't defer this to the end — see 11.1 on writing tests
    alongside the functions they cover in earlier phases).
12. **Production readiness** — security hardening, data backup/export
    including the gear-photo zip bundle (Section 3.3), app store submission
    prep including the icon concept (Section 10.4), and opt-in crash
    reporting (Section 10.6). See Section 10 for the full checklist; don't
    start this phase until Phases 1–11 are functionally complete.

Phases 13+ — the weekly recap, shareable conditions card, home screen
widget, Live Activity/ongoing notification, Siri Shortcut/quick tile,
route-learning Plan defaults, hike mode, cloud sync, and the mascot
companion — are fully specified as their own build phases in Section 13,
sequenced to run after Phase 12 rather than left undefined as "someday"
ideas.

---

## 9. Design tokens & component specs (self-contained — no mockup files needed)

This section fully replaces any need for reference JSX mockups. Everything a
coding agent needs to build the Journey Detail UI (and reuse elsewhere) is
specified here directly.

### 9.0 Visual character

The app sits between two references, and should read as neither pure
utility chrome nor a precious lifestyle app:

- **Utilitarian side**: information density and legibility come first — this
  is a screen someone glances at for 3 seconds on their way out the door.
  Flat fills, no gradients or drop shadows, generous hit targets, condition
  states always carry icon + text (Section 9.6) so nothing depends on a
  second of interpretation. Think transit-app clarity: numbers and states
  are the content, chrome gets out of the way.
- **Personal side**: this app is about *your* jacket and *your* shoes, not
  generic advice, and the UI should feel like it knows that — warm accent
  hues (the walk/drive/transit accents are amber/lavender/teal, not
  primary red/green/blue), rounded corners throughout (12px cards, 999px
  icon circles) rather than sharp edges, and copy that talks like a person
  ("Forecast changed: pack a rain shell too," Section 5.2) rather than a
  system log. Gear items keep the user's own names ("Blue rain shell"), not
  generic categories, wherever they're surfaced.
- **In practice**: default to the utilitarian read for layout, density, and
  information hierarchy; default to the personal read for color, copy tone,
  and micro-interactions (the feedback taps, the favorite star). If the two
  ever conflict — e.g. a "delightful" animation that costs a beat of
  glanceability — utilitarian wins, since the core use case (checking gear
  on the way out) is time-pressured.

#### 9.0.1 Voice & copy guide

Every notification, empty state, toast, and error message should read like
the same person wrote it — worth pinning down explicitly, since without a
shared reference each screen's copy tends to drift toward whatever tone its
author defaulted to that day.

- **Talks like someone who's already looking outside for you, not a
  weather service.** Direct and specific, not clinical. "Pack a rain
  shell — light rain from 8am" rather than "Precipitation probability: 60%."
- **Short.** One clause beats two. If a notification needs a semicolon,
  it's two notifications' worth of information — cut one.
- **Confident, not cheerful.** No exclamation points as a default register
  (reserve them, if ever, for something that's genuinely a treat — e.g. a
  rare "no gear needed today" case — not routine confirmations). This app
  is useful at 7am before coffee; it shouldn't perform enthusiasm at that
  hour.
- **No meteorologist jargon** in user-facing copy — "light rain," not
  "40% PoP"; "cold snap," not "isotherm shift." Reserve WMO codes,
  `severity` numbers, and confidence percentages for internal/debug use
  only (Section 12.2's dev menu is a fine place for the literal numbers).
- **Never blame the user or the weather dramatically.** "Forecast
  changed — pack a rain shell too" (Section 5.2), not "Uh oh, the weather
  turned on us!" The app is a calm, competent second opinion, not a
  personality.
- **A few reference lines**, for calibration:
  - Leave-by notification: "Leave by 8:12 to catch the 8:20 train — grab
    your rain shell."
  - Empty state CTA: "No shoes yet — add your first pair."
  - Post-journey feedback: "How was the gear call for your commute today?"
  - Calibration toast: "Noticed you run warm — dialing back a layer next
    time."
  - Onboarding self-report (Section 4.1): "Do you tend to run warm, cold,
    or about average?"
  - Dual-purpose jacket toggle (Section 3.6, 7.12): "Turn this on if this
    jacket is insulated enough on its own — like a rain shell with a
    built-in thin puffer lining."
  - Severe-weather advisory (Section 7.14): "Conditions look severe enough
    that you might want to reconsider cycling today, if you have another
    option."
  - Hot-weather note (Section 7.15): "Warm enough today that something
    breathable and light-colored will feel better than your usual pick."
  - Wash-reminder badge (Section 7.16): "Worn 4 times since last wash."
  - Mark-as-washing confirm (Section 9.4.3): "This'll mark it unavailable
    for about 2 days and reset its wear count."
- **Don'ts, explicitly**: no emoji in body copy (icons already carry that
  role, Section 9.6); no "Oops!" on error states (state what happened and
  what to do next instead); no percentage-based hedging in user-facing text
  ("60% chance") — translate to the `light`/`med`/`high` buckets from
  Section 6 instead, which is already the pattern the rain gauge (9.5)
  uses.

---

### 9.1 Color tokens & theming

Both a dark and a light theme are in scope for v1 — not dark-only. Put both
token sets in `src/theme/tokens.ts` as two flat const objects (`darkTheme`,
`lightTheme`) of the same shape, not per-platform branching.

**Theme selection**: a Zustand store (`useThemeStore`, consistent with the
state choice in Section 1) holds `themePreference: "system" | "light" |
"dark"`, defaulting to `"system"` and read via RN's `useColorScheme()` when
set to `"system"`. Persist the preference in SQLite (one row, alongside
`WarmthCalibration` in Section 3) so it survives app restarts without
depending on the OS reporting the same value every launch. Expose the
control as a segmented 3-option picker in a new **Settings** entry (reached
from the Today tab header, alongside the History icon from Section 4.4) —
this is also the natural home for the crash-reporting opt-in (Section 10.6),
the `WarmthCalibration` display detailed in Section 9.1.1 below, a
two-option `CarryPreference` toggle (Section 3, 4.3.1, 7.9) that sets the
app-wide default before any per-trip override, and the single-user-scope
disclosure line from Section 2.2.

Components read colors via a `useTheme()` hook returning the active token
object — never import `darkTheme`/`lightTheme` directly in a component, so
theme switching doesn't require touching every screen later.

#### 9.1.1 Warmth calibration & advanced thresholds (Settings)

Every slider, rating, and toggle introduced by Section 7.5's calibration
system gets a plain-language, one-line explanation directly in the UI —
never a bare control with only a technical name, per the voice guide
(Section 9.0.1). All of the below sit in a "Warmth" group within Settings,
directly below the theme picker:

- **Calibration summary** (read-only, Section 7.5): "Adjusted from 12
  check-ins" using the global `sampleCount`, plus — once any seasonal
  bucket has samples (Section 7.5.1) — a per-season breakdown directly
  underneath: "Winter: 5 check-ins · Summer: 7 · Other: 0," with one line
  of context above it: "We learn separately for each season, since how you
  dress in winter doesn't always match summer." No editable value here —
  this is transparency, not a control; the offset itself is only ever
  moved by post-journey feedback (Section 4.2).
- **Wind sensitivity** (Section 7.5.2): a segmented 3-option control —
  "Less bothered by wind" / "Average" / "More bothered by wind" — with one
  line above it: "Only changes the extra warmth bump for windy spots
  you've marked (Local knowledge) — doesn't affect your regular
  recommendations." Defaults to "Average."
- **Advanced** (Section 3.6): a collapsed disclosure row labeled "Advanced
  — set exact temperature thresholds," collapsed by default and requiring
  one tap to expand, since this is explicitly a step down from the
  calibration loop for the small minority who want it (Section 3.6). One
  line directly under the disclosure header, always visible even
  collapsed: "Most people get better results from the check-ins above —
  only change these if you want to set the exact cutoffs yourself." Once
  expanded, three numeric steppers (°C, whole-degree increments), each with
  its own one-line context so the number means something without reading
  this spec:
  - "Freezing cutoff" — "Below this, we always recommend maximum warmth,
    no exceptions." (`AdvancedWarmthThresholds.freezingC`, default 2°C)
  - "Cool cutoff" — "Above this, conditions count as mild rather than
    cool." (`.coolUpperC`, default 14°C)
  - "Warm cutoff" — "Above this, we treat it as warm enough to trigger the
    bus/train AC warning in summer." (`.warmOutdoorC`, default 18°C)
  A "Reset to defaults" text link sits under the three steppers, restoring
  all three fields to `undefined` (i.e. back to Section 7's named
  constants) in one tap.

#### 9.1.2 Warmth rating slider (Gear CRUD & onboarding)

One shared component (Section 4.1, 4 "Gear" bullet) used everywhere
`ClothingItem.warmth` (Section 3.6) is set — a horizontal 1-10 stepped
slider, `accentWalk`-filled track, with the two end labels always visible
underneath rather than only on interaction (`caption` size, `textSecondary`):
"1 · barely warmer than a t-shirt" on the left, "10 · heaviest winter coat
you own" on the right. Intermediate values show only the current number
above the thumb while dragging — no per-value labels, since the two
anchors are enough to place an item honestly without needing ten distinct
descriptions. For a jacket (`type: "jacket"` only), a
`substitutesForMidlayer` toggle sits directly beneath the slider with its
own one-line context ("Turn this on if this jacket is insulated enough on
its own — like a rain shell with a built-in thin puffer lining"), hidden
entirely (not shown-disabled) for every other clothing type.

**Dark theme** (unchanged from the original spec):

| Token | Hex | Usage |
|---|---|---|
| `bg` | `#161B26` | Screen background |
| `surface` | `#1F2534` | Cards, list rows |
| `surfaceRaised` | `#2A3142` | Modals, the gear recommendation card |
| `border` | `#323A4D` | Hairlines between legs/cards |
| `textPrimary` | `#F2F4F8` | Headlines, leg labels |
| `textSecondary` | `#9AA3B8` | Timestamps, durations, notes |
| `accentTransit` | `#4FB8AE` | Bus/train legs, transit badges |
| `accentWalk` | `#E8A860` | Walk/cycle/hike legs (Section 13.8) |
| `accentDrive` | `#7C8CE8` | Drive legs |
| `conditionDry` | `#6E7890` | severity 0 (`Dry`, `Overcast`) |
| `conditionLight` | `#F2C94C` | severity 1 (`Light rain`, `Windy`, `Foggy`) |
| `conditionRain` | `#4FA3E3` | severity 2 (`Rain`) |
| `conditionHeavy` | `#3B6FD6` | severity 3 (`Heavy rain`) |
| `conditionStorm` | `#B24FE3` | severity 4 (`Stormy`) |
| `acBadge` | `#5CC8E8` | Indoor AC badge fill |
| `uvBadge` | `#F2994A` | Sun/UV accessory badge fill |
| `feedbackPositive` | `#5FBF7F` | "Just right" feedback tap target |
| `confidenceLow` | `#9AA3B8` | Low-confidence forecast note (reuses `textSecondary` tone, kept as its own token so it can diverge later) |
| `favoriteStar` | `#F2C94C` | Favorited location star fill (Section 4.3) — deliberately reuses `conditionLight`'s hex since both read as "highlighted/attention," but kept as a separate named token since they're conceptually unrelated and may want to diverge |
| `annotationPin` | `#C77DFF` | `EnvironmentAnnotation` map pins (Section 4.5) — one consistent color for all six effect types (Section 3), distinguished from each other by icon glyph (wind/umbrella/sun/leaf/wave) rather than by hue, so this token doesn't multiply into six near-identical purples |

**Light theme** — same token names, same relative contrast/role, hues kept
close to the dark set so switching themes doesn't change what an accent
"means," just its exact value against a light background:

| Token | Hex | Usage |
|---|---|---|
| `bg` | `#F6F7FA` | Screen background |
| `surface` | `#FFFFFF` | Cards, list rows |
| `surfaceRaised` | `#FFFFFF` (with `border`-colored 1px outline, since white-on-off-white needs a seam without shadows — see 9.0) | Modals, the gear recommendation card |
| `border` | `#DDE1EA` | Hairlines between legs/cards |
| `textPrimary` | `#1A1E29` | Headlines, leg labels |
| `textSecondary` | `#5C6478` | Timestamps, durations, notes |
| `accentTransit` | `#2C8F86` | Bus/train legs, transit badges |
| `accentWalk` | `#C97F2E` | Walk/cycle/hike legs (Section 13.8) |
| `accentDrive` | `#5B63C9` | Drive legs |
| `conditionDry` | `#7B8499` | severity 0 (`Dry`, `Overcast`) |
| `conditionLight` | `#B8860B` | severity 1 (`Light rain`, `Windy`, `Foggy`) |
| `conditionRain` | `#2E7CC4` | severity 2 (`Rain`) |
| `conditionHeavy` | `#2953A8` | severity 3 (`Heavy rain`) |
| `conditionStorm` | `#8C3AB0` | severity 4 (`Stormy`) |
| `acBadge` | `#2F9FBE` | Indoor AC badge fill |
| `uvBadge` | `#C97327` | Sun/UV accessory badge fill |
| `feedbackPositive` | `#3F9A5C` | "Just right" feedback tap target |
| `confidenceLow` | `#5C6478` | Low-confidence forecast note (mirrors dark theme's reuse of `textSecondary`) |
| `favoriteStar` | `#B8860B` | Favorited location star fill (mirrors dark theme's reuse of `conditionLight`) |
| `annotationPin` | `#8A3FFC` | `EnvironmentAnnotation` map pins (Section 4.5) — same single-hue-plus-icon approach as dark theme, across all six effect types |

All light-theme accent/condition hues were checked to keep at least 4.5:1
contrast against `#F6F7FA`/`#FFFFFF` for text use and remain distinguishable
from each other for someone with color vision deficiency, consistent with
the "never convey severity by color alone" rule in Section 9.6 — that rule
applies identically in both themes, since icon + label always ships
alongside the color regardless of which theme is active.

Map `classifyWeather()`'s `severity` (0–4) directly to the active theme's
`condition*` tokens via a lookup array — don't branch in the render layer,
and don't branch on theme there either; the lookup array itself is
theme-agnostic since it indexes into whichever token object `useTheme()`
currently returns.

### 9.2 Typography & spacing

- Font: system default (`San Francisco` / `Roboto`) via RN's default — no
  custom font loading needed for v1.
- Scale: `title` 22/bold, `subtitle` 17/semibold, `body` 15/regular, `caption`
  13/regular, `micro` 11/medium (used on badges).
- Spacing unit = 4px. Card padding = 16px (`4 * 4`). Gap between leg rows =
  12px. Screen horizontal margin = 16px.
- Corner radius: 12px for cards, 8px for badges/pills, 999px (full) for the
  weather condition icon circle.

### 9.3 Journey Detail screen layout (top to bottom)

1. **Map** (`react-native-maps`), ~40% of screen height. Route polyline in
   `accentWalk`/`accentTransit`/`accentDrive` per-segment matching each leg's
   mode. A small circular marker at each outdoor leg's midpoint, filled with
   that leg's condition color from 9.1, containing the weather emoji from
   `classifyWeather()`.
2. **Severe-weather advisory banner** (only rendered when
   `Recommendation.severeWeatherAdvisory` is set, Section 7.14) — a
   single-line strip directly under the map, above the forecast-confidence
   banner (this one takes priority — reconsidering the trip matters more
   than a forecast-accuracy caveat), `conditionStorm`-tinted background
   with a ⚠ icon and the advisory text verbatim. Omitted entirely when
   unset, same "don't render a placeholder" pattern as the confidence
   banner below it. No dismiss control — it re-evaluates fresh each time
   the recommendation is recomputed (Section 5.2), rather than persisting
   a dismissed state that could go stale if conditions worsen further.
3. **Forecast confidence banner** (only rendered for `medium`/`low`
   `forecastConfidence`, Section 5.3) — a thin single-line strip directly
   under the map (or under the severe-weather banner, when both are
   present), `confidenceLow` text on `surface` background: "Forecast
   may still change — we'll update this closer to departure." Omitted
   entirely for `high` confidence, not just hidden/collapsed.
4. **Gear recommendation card** (`surfaceRaised`, pinned directly under the
   map/banner(s), not scrollable away):
   - `layers[]` (Section 7) renders as a small **vertical stack**, base at
     the bottom visually working up to jacket on top — 1 to 3 rows depending
     on warmth level, each an icon + item name, or `fallbackText` in
     `textSecondary` italic. On a mild day this stack may be empty; hide the
     whole row rather than showing a blank placeholder.
   - `accessories[]` renders as a single compact row **below** the layer
     stack, only when non-empty (Section 7's `layerPlanForWarmthLevel` plus
     the sun/darkness logic in 7.6 already keep this empty on a normal mild
     daylight commute — don't reserve space for it).
   - `bottoms` (Section 7.13), `shoes`, and `umbrella` render as three
     horizontal slots below that, same fallback-text pattern as before —
     `bottoms` is simply omitted from this row (not shown with fallback
     text) when `undefined`, since most journeys never trigger it.
   - The `notes[]` array renders last as a bulleted list in `caption` size —
     this is where the warmup-discount, AC-contrast, and UV/darkness
     reasoning from Section 7 shows up.
5. **Leg list** — one row per `JourneyLeg`, in `surface` cards with 12px gaps:
   - Left: a 32px circular icon — mode icon (walk/bus/train/car/cycle/hike,
     Section 3) for outdoor legs, or an "AC"/"heated" pill (`acBadge`
     background) for indoor legs with `climate` set (this now includes
     `Journey.waypoints` stops, Section 3.5/4.3.1, which render identically
     to an origin/destination indoor leg — no separate visual treatment). A
     stationary wait leg (`isStationary`, Section 3.5) uses a distinct
     standing-figure glyph rather than the bus/train icon it precedes, so
     it reads as its own thing rather than a mislabeled transit leg.
   - Center: `label` (`subtitle`) + `durationMin` and time range (`caption`,
     `textSecondary`). A stationary leg's `label` follows the voice guide
     (Section 9.0.1) with the specific delay named, e.g. "Waiting at
     Britomart — delay 12 min," sourced from `waitContext` (Section 3.5).
   - Right, outdoor legs only: a small badge — condition icon + `tempC`
     rounded to nearest degree + `windKph` if `> HIGH_WIND_KPH` (Section 7).
     A `hike` leg's badge (Section 13.8) shows the *worst* sample's
     reading from `hikeSamples[]` (Section 7.11), not a single-point value.
   - Bus/train legs additionally show a live-delay pill fed from AT GTFS
     Realtime (Section 5) once Phase 7 is implemented — omit this pill
     entirely (don't render an empty placeholder) until that data exists.
6. **Post-journey feedback strip** (Section 4.2) — only rendered once
   `departTime` + total leg duration has passed and `Journey.feedback` is
   unset. Sits below the leg list, five equal-width tap targets in a
   single row, coldest to warmest left-to-right ("Much too cold" / "Too
   cold" / "Just right" / "Too warm" / "Much too warm," per the 5-point
   `GearFeedback`, Section 3), `feedbackPositive` accent on the middle
   option only, `micro` text size on all five so the row stays one line at
   default font scaling (Section 9.6 governs the larger-text fallback —
   wrap to two rows of three/two rather than truncate labels). Collapses to
   nothing once feedback is given or skipped — don't leave an empty gap.

### 9.3.1 "Right now" card (Today tab)

Visually a smaller, self-contained version of the gear recommendation card
above — same slot layout (layers/bottoms/accessories/shoes/umbrella,
though bottoms/severe-weather/wear-tracking are moot here per Section
4.2's clarification), but no map, no
leg list, and no journey label, just current conditions (temp, condition
icon, UV badge if relevant) and the reduced recommendation from Section 4.2.
A small "as of [time]" caption in `textSecondary` makes clear this is a
snapshot, not a forecast.

### 9.4 Today-tab journey card (compact variant)

Same visual language as the leg list rows, condensed: route summary
("Home → Work"), a horizontal strip of small condition-color dots (one per
outdoor leg, in journey order), and a single-line top recommendation pulled
from `Recommendation.layers` — the outermost/warmest layer's name if
matched (e.g. the jacket, not the base layer, since that's what's visible
on the way out the door), or its fallback text. A small recurrence icon
(↻) appears on the route summary if `journey.recurrence` is set, and a
return-trip icon (⇄) if `linkedReturnJourneyId` is set. Tapping navigates to
the full Journey Detail screen from 9.3.

### 9.4.1 Saved route chips, favorite star, and trip-context controls (Plan / Locations)

- **Saved route chips** (Plan screen, Section 4.3): a horizontal
  `ScrollView` of pill-shaped chips (`surface` background, 8px corner
  radius per 9.2), each showing the route's `label` and a small mode icon.
  Sits directly above the origin/destination pickers. Empty (no
  `SavedRoute`s yet) → the row is omitted entirely, not shown collapsed.
- **Favorite star** (Locations list, Section 4.3): a 20px star icon on the
  right edge of each `SavedLocation` row, filled `favoriteStar` when
  `isFavorite`, outline-only `textSecondary` when not. Tappable
  independently of the row itself (doesn't open edit mode) — toggling it
  should be a single, obvious tap target per the 44×44pt minimum from
  Section 9.6, not a sub-region of a bigger tappable row.
- **"Add a stop" row** (Plan screen, Section 4.3.1): a `textSecondary`,
  `caption`-size "+ Add a stop" affordance directly under the destination
  picker; tapping it inserts a `surface` autocomplete row identical in
  style to the origin/destination pickers, appendable multiple times.
  Each added row gets a small "×" remove control on its trailing edge.
- **Formal occasion toggle** (Plan screen, Section 4.3.1): a standard
  segmented switch, same visual weight as the mode selector, positioned
  directly below it — not styled as an "advanced option," since it's a
  one-tap piece of trip context like anything else on the screen.
- **Carry-preference chip** (Plan screen, Section 4.3.1): a small
  `border`-outlined pill next to the mode selector reading "No preference"
  or "Avoid spares," cycling on tap. Reflects the Settings-level default
  (Section 9.1) until explicitly changed for this trip.

### 9.4.2 History screen layout

- **List** — same row structure as the Today-tab compact card (9.4), plus a
  leading date label (grouped under day headers — "Today," "Yesterday,"
  then full dates), rendered in a plain `FlatList` (no map, no interactivity
  beyond tap-to-open). Rows for journeys with a stored
  `recommendationSnapshot` render normally; rows that had to fall back to a
  recomputed recommendation (Section 4.4) carry a small "recomputed"
  `caption`-size tag in `textSecondary` next to the recommendation text, so
  the distinction is visible without needing to open the row.
- **Detail** — reuses the Journey Detail component from 9.3 with a `readOnly`
  prop that hides the leave-by/"Leaving now"/return-trip-toggle affordances
  per Section 4.4, and swaps the live `Recommendation` for the frozen
  `recommendationSnapshot` fields where present.

### 9.4.3 Gear list: unavailability reason & wash-reminder badges

Two related but visually distinct pieces of state on a Gear-list row
(Section 4, "Gear" bullet; Section 7.7, 7.16), both `caption`-size and both
optional per-item:

- **Unavailability badge** — when `unavailableUntil` is set and still in
  the future, the row dims (60% opacity on the thumbnail/name) and shows a
  small pill reading the specific reason plus return date, sourced from
  `unavailableReason`: "In the laundry — back Thu" / "Being repaired —
  back Mon" / "Lost" (no date, since Lost defaults open-ended) / "Marked
  unavailable — back Wed" for `"other"`. Tapping the pill opens the same
  "mark unavailable until…" sheet pre-filled with the current values, so
  it doubles as the edit affordance rather than needing a separate one.
- **Wash-reminder badge** — independent of the above, shown whenever
  `needsCleaning` is true (Section 7.16) and the item is *not* already
  unavailable (an item already out for laundry doesn't also need a "you
  should wash this" nudge — the two states are mutually exclusive in
  practice, but the wash-reminder badge simply doesn't render if the
  unavailability one already is, so there's no need to special-case the
  overlap in code). `uvBadge`-tinted pill (reusing the existing warm-accent
  token rather than introducing a new one), reading either "Worn N times
  since last wash" (`wearsSinceClean` ≥ `WASH_REMINDER_WEAR_COUNT`) or
  "Might need a wash after that last trip" (flagged by a single sweaty
  journey instead) — whichever reason actually triggered it, not always
  the wear count. Tapping it opens a small confirm sheet: "Mark [item name]
  as in the laundry?" with one line of context — "This'll mark it
  unavailable for about 2 days and reset its wear count." — and a single
  "Mark as washing" button that applies Section 7.16's combined write
  (`unavailableUntil`/`unavailableReason: "laundry"`/`wearsSinceClean: 0`/
  `needsCleaning: false`) in one tap. A "Not yet" dismiss just closes the
  sheet without changing anything — the badge reappears on the next screen
  visit if the underlying flag is still true, since dismissing the sheet
  isn't the same as having actually washed the item.

### 9.5 Rain-intensity gauge (used in the hourly strip on Plan/Today)

A vertical "droplet fill" — a droplet-shaped SVG clipped/masked so a solid
fill rises from the bottom to a height proportional to the rain-intensity
bucket from Section 6 (`none`=0%, `low`=33%, `med`=66%, `high`=100%), filled
in `conditionRain`/`conditionHeavy` depending on bucket. Render one per hour
in a horizontal `ScrollView`, each ~28px wide, with the hour label in
`micro` underneath.

### 9.6 Accessibility

Not optional polish — bake these in during initial component build, since
retrofitting accessibility into already-built screens is far more work:

- **Never convey status by color alone — a general rule, not just for
  weather.** Every place a `condition*` token is used (leg badges, map
  markers, rain gauge) must also carry the weather emoji/icon and the text
  label (`"Rain"`, `"Stormy"`, etc.) — someone with color vision deficiency
  can't distinguish `conditionRain` (#4FA3E3) from `conditionHeavy`
  (#3B6FD6) by hue alone, and both are already specified with icons/labels
  elsewhere in this doc, so this is a "don't drop it in the component," not
  a "design something new." The same rule applies to every other tinted
  element in this doc regardless of token family — worth stating
  explicitly so a future addition doesn't get read as exempt just because
  it isn't a `condition*` token. Already verified compliant as specified:
  the severe-weather advisory banner (9.3) pairs its `conditionStorm` tint
  with a ⚠ icon and full sentence text; the wash-reminder and
  unavailability badges (9.4.3) are text pills stating the actual reason
  and count, not bare color swatches; the forecast-confidence banner (9.3)
  is a full sentence, not a color code. Any new tinted element added in a
  later phase should be checked against this same rule before it ships,
  not assumed fine by analogy.
- **Screen reader labels** (`accessibilityLabel` / `accessibilityRole` on
  every interactive element): leg rows read as one coherent label ("Walk to
  Kingsland Station, 8 minutes, 12 degrees, light rain") rather than forcing
  VoiceOver/TalkBack to piece together icon + text + badge as three separate
  stops. Gear card fallback text should read as an action, not just a
  description ("No umbrella owned — double tap to add one"), matching the
  empty-state CTA pattern from Section 4.1.
- **Dynamic Type / font scaling**: use RN's `allowFontScaling` (default true)
  rather than fixed pixel heights on text containers — verify the leg list
  and gear card don't clip at the largest accessibility text size
  (`Settings → Accessibility → Larger Text` on iOS, roughly 200% of base).
- **Touch targets**: minimum 44×44pt for anything tappable, including the
  compact rain-gauge droplets and Today-tab recurrence/return icons — several
  components in 9.3–9.5 are visually smaller than that and need invisible
  padding to meet the target without changing the visual size.
- **Map alternative**: the map in Journey Detail (9.3.1) is not usable by a
  screen-reader-only user — the leg list below it must be a fully sufficient,
  independently navigable summary of the journey (which it already is by
  spec) so no information is map-only.

### 9.7 Mascot companion (Section 13.9, Phase 21)

- **Placement**: primary instance pinned directly above the "Right now"
  card (9.3.1) on the Today tab, roughly 96×96pt; a smaller ~64×64pt
  instance in the top-right corner of the Journey Detail gear card (9.3),
  so it reads as attached to that card's recommendation rather than
  floating independently.
- **Base art**: a single-character SVG built from a small number of named
  overlay groups (arms, face, jacket-slot, bottoms-slot, umbrella-slot,
  hair/scarf-slot) so `react-native-reanimated` can target each group
  independently for the state transforms in Section 13.9's table, and so
  the paper-doll tint only ever recolors the slot group's `fill`, never
  redraws the base character.
- **Palette-to-swatch mapping**: each `MascotSwatch` value (Section 3) maps
  to one fixed hex in a small lookup table kept alongside the design
  tokens (Section 9.1) — not user-editable beyond picking which named
  swatch — so every possible tint is pre-verified to read clearly against
  the mascot's own outline/shading regardless of theme (light/dark,
  Section 9.1).
- **Swatch picker** (Gear CRUD add/edit form, clothing/shoes/umbrella only,
  Phase 21): a single row of 12 fixed circular swatches (one per
  `MascotSwatch`), `44×44pt` touch targets per Section 9.6, a checkmark
  overlay on the selected one, and a "Skip" text option beside the row —
  explicitly optional, since this is a cosmetic field with a graceful
  neutral fallback (Section 13.9), not something every item needs tagged.
  One line of context above the row: "Pick the closest color — this only
  affects how your companion looks, never what gets recommended."
- **Reduce-motion fallback**: when
  `AccessibilityInfo.isReduceMotionEnabled()` is true, render each state's
  final pose directly with no transform/loop applied — the shiver state
  shows the breath-puff and jitter's end pose held still, the wave shows
  the arm already raised, etc. — rather than skipping the mascot entirely,
  so the outfit/condition information it reflects is still visually present
  for a reduce-motion user, just without the motion itself.
- **Never blocks or delays**: the mascot renders from whatever
  `Recommendation` is already computed — it never introduces its own
  loading state, spinner, or network dependency, and a failure to render
  it (e.g. a corrupt swatch value) should fail silently to the neutral
  placeholder rather than surface an error to the user over what's a pure
  delight feature.

---

## 10. Production readiness: security, backup, app store submission

Don't treat this as an afterthought bullet list — each subsection below has
concrete config the coding agent should actually produce, not just "consider
doing X."

### 10.1 API key security

- **Google Routes API key is billable and must never ship in the client
  bundle as-is.** RN/Expo JS bundles are trivially unpacked, so a key baked
  in via `.env`/`app.config.ts extra` is extractable and abusable (quota
  drain, surprise bill).
  - v1 fix: restrict the Android key to the app's SHA-1 cert fingerprint +
    package name, and the iOS key to the bundle ID, via Google Cloud
    Console's "Application restrictions." This doesn't hide the key but
    prevents it being used outside the app.
  - Preferred fix (do this before wide release, not just app-store review):
    proxy `computeRoutes` calls through a minimal backend (a single
    Cloudflare Worker or Vercel Edge Function is enough) that holds the real
    key server-side and applies basic rate limiting per device. The app
    calls your proxy URL instead of `routes.googleapis.com` directly.
- **AT GTFS subscription key**: same restriction principle — AT's dev portal
  supports per-key rate limits; keep it modest since it's a free tier.
- **Open-Meteo**: no key, no action needed.
- Never log full API responses or keys via `console.log` in production
  builds — strip with `babel-plugin-transform-remove-console` for release
  builds, keep it for dev.

### 10.2 Local data security

- SQLite file lives in `FileSystem.documentDirectory` (see 10.3 — this also
  affects backup behavior). It is **not encrypted at rest by default.**
  Inventory/location data here isn't especially sensitive, but home/work
  addresses are personal — enable SQLCipher (`expo-sqlite` supports it via
  a config plugin) if the agent wants encryption-at-rest; otherwise
  explicitly note in the privacy policy (10.5) that data is stored
  unencrypted on-device.
- Always use parameterized queries (`db.runAsync(sql, [params])`), never
  string-interpolate user input into SQL, even though this is a
  single-user local app — habit worth keeping if sync is added later.
- `expo-location` permission should be requested with `"whenInUse"`, not
  `"always"` — the app has no background use case that justifies always-on
  tracking, and `"always"` triggers extra App Store review scrutiny.

### 10.3 Data backup & export

SQLite in `documentDirectory` is included in each platform's automatic
device backup by default — confirm this is what you want rather than an
accident:

- **iOS**: files under `documentDirectory` are included in iCloud/iTunes
  device backups automatically. No action needed to get this for free,
  but if the DB grows large, Apple may flag it in review — add the
  `NSURLIsExcludedFromBackupKey` flag *only* to any large cached files
  (e.g. downloaded map tiles), never to the SQLite DB itself.
- **Android**: Auto Backup for Apps is on by default for API 23+, but add
  an explicit `dataExtractionRules`/`android:allowBackup` block in
  `app.config.ts`'s `android` field so behavior is intentional rather than
  relying on the platform default silently changing.
- **In-app export (build regardless of the above — it's the part users can
  actually see and trigger)**: a "Export my data" action in a Settings
  screen that serializes `Inventory` + `SavedLocation[]` +
  `WarmthCalibration` + `AdvancedWarmthThresholds` + `Journey[]` (including
  each one's `recommendationSnapshot`) to a `data.json`,
  bundles it with the `gear-photos/` folder (Section 3.3) into a single zip
  via `expo-file-system`, and shares it with `expo-sharing` (AirDrop,
  email, Drive, wherever the user picks). Pair with an "Import data" action
  that reads a picked zip (`expo-document-picker`), unzips it, upserts
  `data.json` contents by `id`, and copies photo files back into
  `documentDirectory`, so users can move data between devices or recover
  after a reinstall — including their gear photos, not just the text
  fields — without waiting on OS-level backup timing.
  - **Worth calling out specifically**: `WarmthCalibration` and
    `AdvancedWarmthThresholds` were easy to leave out of an earlier,
    narrower version of this export scope that only covered `Inventory`/
    `SavedLocation` — but by the time Section 7.5's seasonal/wind-
    sensitivity calibration and Section 3.6's threshold overrides exist,
    that's real, hard-won personalization state (weeks of feedback,
    potentially) that a user would otherwise silently lose on reinstall
    with no way to know it happened. Include it from the start rather than
    retrofitting once someone notices their calibration reset.
  - `Journey[]` history is included for the same reason — otherwise
    "Export my data" reads as covering "your data" while quietly excluding
    the History screen's entire contents (Section 4.4), which would be a
    misleading omission given the export flow's advertised purpose.
- Out of scope for v1, but design for it: keep all IDs as UUIDs (not
  auto-increment ints) so a future cloud-sync phase doesn't require an ID
  migration.

### 10.4 Build & submission config

- Use **EAS Build** (`eas.json` with `development`/`preview`/`production`
  profiles) and **EAS Submit** for both stores — avoid manual Xcode/Android
  Studio archive builds, they don't reproduce reliably.
- `app.config.ts` must set, at minimum:
  - `ios.bundleIdentifier` / `android.package` (reverse-DNS, e.g.
    `com.yourname.commuteweather`)
  - `version` + platform build numbers (`ios.buildNumber`,
    `android.versionCode`) bumped every submission
  - App icon (1024×1024 source, Expo generates the rest) and splash screen
    — see the icon concept below; don't leave this as a placeholder
    gradient-and-glyph default
  - Permission usage strings — these are mandatory copy, not boilerplate:
    `NSLocationWhenInUseUsageDescription` should say *why* ("to set your
    current location as a journey starting point"), not just "location
    access required"
- **App icon concept**, translating the utilitarian/personal character
  from Section 9.0 into a mark rather than leaving "make an icon" totally
  open-ended: a single, simple silhouette (an umbrella or a jacket — pick
  one, don't combine both into a busier mark) rendered flat and geometric
  (utilitarian — reads clearly at 40px on a home screen, no gradient or
  photographic rendering), filled in one of the app's own warm accent hues
  from Section 9.1 (`accentWalk`'s amber is a reasonable default — personal,
  distinct from the blue/green most weather apps default to) against the
  dark `bg` token as background. Avoid literal weather iconography
  (sun/cloud combos) for the icon specifically — that's exactly what every
  generic weather app's icon looks like, and the whole point of this app is
  that it's not that.
- iOS: fill in the **Privacy Manifest** (`PrivacyInfo.xcprivacy`, required
  since 2024 for apps using location and network APIs) declaring the
  location API usage reason code and confirming no data is sold/shared
  with third parties beyond the weather/routing/transit API calls needed
  to function.
- Both stores require a **privacy policy URL** even for a single-user app
  with no accounts — host a static page (can be a single markdown file
  rendered via GitHub Pages) covering: what's collected (location, saved
  addresses), where it's stored (on-device, exported data is user-controlled),
  which third parties see it (Google Routes, Open-Meteo, AT GTFS — all
  receive coordinates/timestamps to fulfill the route/weather/transit
  request, no ad networks or analytics SDKs in v1), and crash reporting
  (off by default, opt-in only, no personal data included when enabled —
  see Section 10.6).
- **Store listing copy** — both stores need a short description; draft one
  that leads with the differentiator instead of a generic feature list,
  since "recommends your actual jacket, not generic advice" (this document's
  own opening line) is the thing that distinguishes this from any weather
  app. Also state the Auckland transit/season scope from Section
  2.1 in the description itself, not just discoverable after download —
  a reviewer or user who expects nationwide transit support and doesn't get
  it is a 1-star review, not a bug report.
- Use **TestFlight** (iOS) and the **Internal Testing track** (Google Play)
  before any public submission — both catch permission-prompt and crash
  issues review would otherwise reject on.

### 10.5 Crash reporting (opt-in)

Useful for debugging real-world issues post-launch, but the privacy-first
posture in 10.4 means this can't be silently bundled the way it is in most
apps:

- Default **off**. No crash SDK initializes and no data leaves the device
  until the user explicitly turns it on.
- Surface the choice during onboarding (Section 4.1) as a skippable step
  after the gear-basics step, framed honestly: "Help fix crashes — send
  anonymous crash reports if the app fails? You can change this anytime in
  Settings." Defaulting the toggle itself to *off* even on that screen (an
  opt-in checkbox, not an opt-out one) is what makes this actually opt-in
  rather than opt-out-with-extra-steps.
- Also expose the same toggle in the Settings screen introduced in Section
  9.1, next to the theme picker, so the choice isn't onboarding-only.
- Any provider with a free/generous tier and no PII-by-default works (e.g.
  Sentry's Expo SDK) — the specific vendor is an implementation detail, but
  wire it so `Sentry.init()` (or equivalent) only runs when the stored
  preference is `true`, not with a no-op DSN when off, so no telemetry
  connection is made at all while the user hasn't opted in.
- Scrub location coordinates and saved-location labels from crash context
  before sending — a stack trace doesn't need "Home" address to be useful
  for debugging a null-pointer in the recommendation engine.

### 10.6 Pre-submission checklist

- [ ] No console logging of API keys or full network payloads in release builds
- [ ] Google Routes + AT keys restricted (10.1)
- [ ] Google Cloud budget alert configured on the Routes API project (2.1)
- [ ] Location permission set to "when in use," with a real usage string
- [ ] Privacy policy URL live and linked in both store listings, crash
      reporting disclosed as opt-in (10.5)
- [ ] Crash reporting confirmed off by default on fresh install; toggling it
      on in Settings actually initializes the SDK (and off, actually doesn't)
- [ ] `PrivacyInfo.xcprivacy` present (iOS)
- [ ] Export/Import data flow tested round-trip (delete app, reinstall, import)
- [ ] Offline fallback (Section 5.1) verified for all three APIs — Routes,
      Open-Meteo, and AT GTFS each toggled off independently, not just
      airplane mode for all three at once
- [ ] Schema migrations (3.1) tested against a fixture DB from the previous
      released version, not just a fresh install
- [ ] Unit test suite (Section 11) passing, `classifyWeather()` and
      `recommendGear()` coverage in particular
- [ ] Light/dark/system theme toggle verified on both platforms (9.1)
- [ ] Version/build numbers bumped from any prior submission

---

## 11. Testing strategy

Testing isn't a single phase at the end — write tests alongside the code
they cover, in the same phase from Section 8 that introduces it. This
section defines what to test and with what tool; it doesn't add a new phase
to Section 8, it fills in what "done" means within the phases already there.

### 11.1 Unit tests (Jest, via `expo test` / `jest-expo` preset)

Prioritize pure functions with real branching logic and no I/O — cheap to
test, high value, and exactly the functions most likely to have an
off-by-one or wrong-threshold bug that's invisible until a specific weather
code or temperature shows up in production:

- **`classifyWeather()` (Section 6)** — table-driven test over the full WMO
  code range including boundary codes (45/48, 51, 61, 95), the `mm > 4`
  branch inside the rain case, and the `windKph > 25` branch. Written in
  Phase 4 (Live weather + routing), alongside the function itself.
- **`getSeason()` / `acFeelsCold()` (Section 6.1)** — boundary months
  (Nov→Dec, Feb→Mar, May→Jun, Aug→Sep) and the three season × `hasWarmOutdoor`
  combinations. Written in Phase 5.
- **The annotation-matching point-radius check (Section 3.4)** — cases
  just inside/outside `radiusM`, the same-category-multiple-matches case,
  the conflicting-category (closest-wins) case, and the additive
  `high-reflection` composition case (a leg matching both `sun-exposed` and
  `high-reflection` lowers the effective UV threshold rather than stacking
  two separate deltas). Written in Phase 6, alongside the matching function
  itself.
- **`totalOutdoorExertionMinutes()` / `totalOutdoorStationaryMinutes()`
  (Section 7.9)** — a stationary leg must never be counted by the former
  and must be counted by the latter; walking and cycling minutes must be
  attributed to the correct mode when a journey has both; boundary cases at
  `WARMUP_WALK_MIN_MINUTES` / `WARMUP_CYCLE_MIN_MINUTES` /
  `STATIONARY_WAIT_MIN_MINUTES` / `STATIONARY_WAIT_WINDY_MIN_MINUTES`,
  including the case where a stationary leg's wind flips it onto the
  shorter windy threshold (Section 7.9). Written in Phase 5, alongside the
  main engine.
- **`warmthLevelFromTemp()` reads `apparentTempC`, not `tempC` (Section
  6.2)** — a fixture where `apparentTempC` and `tempC` diverge (e.g. a cold,
  humid, breezy reading vs. a mild, still one at the same raw temperature)
  must produce different `warmthLevel` outputs, confirming the engine
  actually uses the feels-like field and hasn't silently reverted to raw
  temperature. Written in Phase 5.
- **Umbrella wind-rating uses `windGustKph`, not `windKph` (Section 6.2,
  7.8)** — a fixture with high sustained wind but a modest gust (and the
  reverse: modest sustained wind with a sharp gust) must confirm the
  umbrella decision follows the gust figure, not sustained wind. Written
  in Phase 5.
- **Wind-tunnel/sun-exposed deltas are annotation-gated only (Section
  6.2/7.8)** — a fixture with genuinely windy or sunny `apparentTempC`
  inputs but *no* matching `EnvironmentAnnotation` on any leg must NOT
  apply an additional envDelta beyond what `apparentTempC` already
  reflects, confirming the earlier general-ambient-check double-counting
  bug stays fixed. Written in Phase 6, alongside the annotation-matching
  wiring.
- **`recommendGear()` and its layering/accessory/calibration/environmental
  logic (Section 7)** — this is the highest-value target in the app:
  table-driven cases across warmth levels, the AC-contrast adjustment,
  the annotation-gated wind-chill and sun-warming deltas including the
  case where they net to zero (Section 7.8), the apparent-temperature
  divergence note's threshold (`APPARENT_TEMP_DIVERGENCE_NOTE_C`), the
  puddle-risk shoe override, sun/darkness accessory selection (7.6),
  unavailable-gear filtering (7.7), the calibration offset (7.5) nudging
  output, the cycling-vs-walking warmup split, the stationary-wait
  aggravating factor (including its windy/calm threshold split), the
  `carryPreference` override of `requirePackable` (7.9), and the
  formal-mode shoe/wind-chill overrides (7.10). Written incrementally as
  each sub-feature lands in Phases 5, 6, and 10 — don't defer this to
  Phase 11.
- **`pickLayer()`'s targetWarmth scale matches the widened 1-10
  `ClothingItem.warmth` range (Section 3.6, 7)** — a fixture with items at
  the old scale's former boundary values (e.g. warmth 2 and 4 on the old
  1-5 scale, now 4 and 8) must resolve against `warmthLevel * 2.5`, not the
  pre-widening `* 1.25` multiplier — this is exactly the kind of stale
  constant a rescale can leave behind unnoticed. Written in Phase 5,
  alongside the rest of the layer-resolution tests.
- **`substitutesForMidlayer` drops the midlayer slot only when it should
  (Section 3.6, 7.12)** — cases: a substitutable jacket whose `warmth`
  meets the target drops the midlayer and adds the explanatory note; the
  same jacket below its target warmth does *not* drop the midlayer; a
  substitutable jacket that's unavailable this trip (Section 7.7) falls
  back to a normal two-slot plan; a non-substituting jacket never triggers
  this path regardless of its `warmth` value. Written in Phase 5.
- **Seasonal calibration split (Section 7.5.1)** — `resolveWarmthOffset()`
  must return the current season's own offset once that season has at
  least one sample, and fall back to the global `offsetLevels` when it
  doesn't; feedback given in one season must never alter another season's
  bucket. Written in Phase 10, alongside the seasonal-offset wiring.
- **Wind-sensitivity axis is isolated (Section 7.5.2)** — a fixture with a
  non-zero `windSensitivityOffset` must change the wind-tunnel envDelta
  specifically (clamped to ±`WIND_SENSITIVITY_OFFSET_CLAMP`) and must NOT
  change the base `warmthLevel`, the sun-warming delta, or any other part
  of the recommendation. Written in Phase 10.
- **5-point `GearFeedback` mapping (Section 3, 7.5)** — each of the five
  values must move the relevant offset (global and seasonal) by the
  correct signed multiple of `WARMTH_CALIBRATION_STEP`
  (`FEEDBACK_STEP_MULTIPLIER`), `"just_right"` must leave both offsets
  unchanged while still updating `lastFeedbackAt`, and the ±2 clamp must
  hold even from repeated `"much_too_*"` feedback. Written in Phase 10.
- **Calibration decay (Section 7.5.3)** — a fixture with `lastFeedbackAt`
  older than `CALIBRATION_DECAY_AFTER_DAYS` must move every affected
  offset (global, each seasonal bucket, wind-sensitivity) by
  `CALIBRATION_DECAY_STEP` toward 0 and must never overshoot past 0 into
  the opposite sign; a fixture within the decay window must be left
  unchanged. Written in Phase 10.
- **Advanced threshold overrides (Section 3.6, 7)** — a fixture with a
  custom `AdvancedWarmthThresholds.coolUpperC` (or the other two fields)
  must change `warmthLevelFromTemp()`'s output at the new boundary and
  leave the default named constants themselves untouched for a fixture
  with no override supplied. Written in Phase 5, alongside the Settings
  "Advanced" section.
- **Bottoms (legwear) selection (Section 7.13)** — table-driven cases
  across both triggers independently: `needsWaterproofBottoms` firing only
  when *both* `needsWaterproof` and `maxGust >= HIGH_WIND_KPH` hold (not
  either alone — a fixture with high gust but dry conditions, and the
  reverse, must both leave `bottoms` undefined); `needsThermalBottoms`
  firing only at `warmthLevel >= BOTTOMS_COLD_WARMTH_LEVEL`; a mild dry
  fixture leaving `Recommendation.bottoms` `undefined` rather than a
  fallback-text object; and `preferTags` (cycling/formal) actually
  reaching `pickLayer()`'s `"bottoms"` call the same way it reaches the
  layers stack. Written in Phase 5.
- **Severe-weather advisory (Section 7.14)** — boundary cases at
  `SEVERE_WEATHER_SEVERITY` and `SEVERE_GUST_KPH` independently (either
  alone must trigger it); a fixture where the only severe leg is
  `drive`/`bus`/`train`/indoor must leave `severeWeatherAdvisory`
  `undefined`; a fixture with multiple qualifying legs must still produce
  exactly one sentence, not one per leg. Written in Phase 5.
- **Hot-weather note (Section 7.15)** — boundary at `HOT_C`, confirming it
  is distinct from and stricter than `WARM_OUTDOOR_C` (a fixture at, say,
  20°C must trigger AC-contrast-relevant "warm" logic but NOT the hot-
  weather note; only a fixture at/above 24°C triggers the note). Written
  in Phase 5.
- **Wear tracking (`recordWear()`, `isSweatyConditions()`, Section
  7.16)** — a fixture confirms `recordWear()` is never invoked by any
  `recommendGear()` test (it's a separate function with its own I/O,
  Section 11.1's "no I/O" rule for `recommendGear()` itself); increments
  `wearsSinceClean` for every real (non-`fallbackText`) item in
  `bottoms`/`shoes`/`layers` and explicitly does NOT touch
  `accessories`/`umbrella`; sets `needsCleaning` at the
  `WASH_REMINDER_WEAR_COUNT` boundary and independently via
  `isSweatyConditions()` (a single sweaty journey below the wear-count
  threshold must still flag it); `isSweatyConditions()` boundary cases
  mirror the existing `WARMUP_WALK_MIN_MINUTES`/`WARMUP_CYCLE_MIN_MINUTES`
  boundaries plus the `hasWarmOutdoor` gate. Written in Phase 8, alongside
  the `recordWear()` wiring.
- **`forecastConfidence()` (Section 5.3)** — the three lead-time buckets and
  their boundaries (48h, 120h).
- **Schema migrations (Section 3.1)** — each migration function run against
  a fixture DB shaped like the previous version, asserting the expected
  post-migration columns/rows. Written the same phase the migration ships.
  Specifically covers: the `ClothingItem.warmth` 1-5 → 1-10 backfill
  (Section 3.6) produces exactly `old_value * 2` for every existing row,
  never a dropped/renamed column; that pre-existing `Journey.feedback`
  values of `"too_warm"`/`"too_cold"`/`"just_right"` — the original
  3-point `GearFeedback` set — remain valid under the widened 5-point type
  with no migration needed for that column, since the new value set is a
  strict superset of the old one; and that existing rows with
  `unavailableUntil` set but predating `unavailableReason` (Section 3.7)
  read as `undefined`/"other" without error, rather than the migration
  needing to backfill a guessed reason it can't actually know.

Target: every function above has tests written before Phase 11 (Polish),
since Phase 11 is where the checklist in 10.6 expects the suite to already
be passing, not where it starts getting written.

### 11.2 Integration / manual test plan

Some flows are cheaper to verify end-to-end by hand than to mock — note
these explicitly so they're not silently skipped:

- **Offline/failure paths (Section 5.1)** — toggle each of the three APIs
  off independently (e.g. a debug menu flag that forces `computeRoutes`,
  Open-Meteo, or AT GTFS to fail) and confirm the specific fallback UX for
  that API, not just "the app didn't crash."
- **Forecast drift (Section 5.2)** — hard to test on a real device clock;
  cover it with a debug-only "simulate forecast change" action that swaps a
  saved journey's stored weather and triggers the re-check logic manually,
  rather than waiting hours for a background fetch to fire.
- **Notification behavior (Section 7.3, 5.2)** — verify on both a physical
  iOS and Android device (simulators are unreliable for local notification
  timing), including the "update in place, don't duplicate" behavior when a
  forecast-drift re-check changes the recommendation.
- **Recurring journey materialization (Section 3)** — create a recurring
  journey, advance device date across a few of its scheduled days, and
  confirm exactly one occurrence row is written per active day with no
  duplicates on repeated app opens.
- **Theme switching (Section 9.1)** — toggle system/light/dark and confirm
  every screen re-renders with the correct token set, including the map
  markers and rain-gauge droplets, which are the components most likely to
  have a hardcoded color that was missed.
- **Export/Import round-trip (Section 10.3)** — already on the
  pre-submission checklist; run it earlier than final submission too, since
  it's cheap to break silently as new fields get added to `Inventory`,
  `WarmthCalibration`, or `Journey`. Specifically assert calibration state
  (including seasonal offsets and any `AdvancedWarmthThresholds` override)
  and `Journey` history actually round-trip, not just `Inventory` — this
  is the scope that was easy to under-cover when the export flow was
  originally just "gear and locations."
- **Multi-stop waypoint routing (Section 3.5, 4.3.1, 5.5)** — plan a journey
  with 2-3 waypoints and confirm Google Routes returns the expected
  segmented legs, each waypoint's `hasReliableClimateControl` override
  applies correctly, and the gear recommendation reflects the worst
  conditions across the whole multi-stop trip, not just the final leg.
- **Stationary wait leg sizing (Section 5.6, 7.9)** — with a debug menu
  flag simulating an AT GTFS delay, confirm a wait leg is inserted ahead of
  the affected bus/train leg with the correct duration, and that it never
  contributes to `totalOutdoorExertionMinutes()`'s warmup-discount
  eligibility.
- **Wash-reminder end-to-end flow (Section 7.16, 9.4.3)** — plan and
  "complete" (via the dev-menu date fast-forward, Section 12.2) enough
  journeys against a single jacket to cross `WASH_REMINDER_WEAR_COUNT`,
  confirm the Gear-list badge appears with the correct wear count, tap
  through "Mark as washing," and confirm the item is both greyed out with
  the laundry reason/return date shown *and* excluded from the next
  recommendation until that date passes. Separately, plan one sweaty-
  conditions journey (warm + sustained exertion) and confirm the badge
  appears immediately regardless of wear count.
- **Severe-weather advisory banner (Section 7.14, 9.3)** — a debug-menu
  weather override (Section 12.2) forcing a walk/cycle leg to storm
  severity or a gust above `SEVERE_GUST_KPH`, confirming the banner
  renders above the forecast-confidence banner (not below), is absent for
  an equally severe drive/bus/train leg, and disappears again once the
  override is cleared and the recommendation recomputes.

### 11.3 What's explicitly out of scope for v1

Full E2E automation (Detox/Maestro) is a reasonable post-v1 investment once
the app has more than one contributor, but isn't required to ship v1 — the
unit tests in 11.1 plus the manual pass in 11.2 are the v1 bar for test
*coverage*. That's a different question from whether tests run
automatically at all — a lightweight CI pipeline (lint + typecheck + the
Jest suite on every push, no device farm involved) is cheap enough to be
in scope for v1 and is covered in Section 12.3. Note the distinction
explicitly so "should we set up Detox" doesn't become an undiscussed
scope-creep decision mid-build, while basic CI doesn't get skipped by
being lumped in with it.

---

## 12. Developer workflow & CI

Process scaffolding that pays for itself quickly on a project this size —
none of it is required for the app to function, but each item below removes
a class of bug or slowdown that otherwise gets rediscovered the hard way.

### 12.1 Services layer

Covered in Section 5.4: one module per external API under `src/services/`
with a consistent typed result shape, rather than ad hoc `fetch` calls
scattered across screens. Beyond the performance/fallback benefits already
described there, this is also what makes the dev-menu failure toggles
(12.2) and the unit-test mocking (Section 11.1) simple — there's exactly
one seam per API to intercept, not one per screen that happens to call it.

### 12.2 Debug/dev menu

Section 11.2's manual test plan assumes a few things are toggleable that
aren't otherwise reachable from the UI — worth building as an actual
gated screen rather than staying theoretical:

- Force any of the three services (12.1) to return an error, to exercise
  the fallback UX from Section 5.1 on demand instead of needing to
  actually be offline or waiting for a real rate limit.
- Trigger the forecast-drift re-check (5.2) manually against a chosen
  saved journey, instead of waiting for the background-fetch schedule.
- Fast-forward the "current date" used by recurrence materialization
  (Section 3) and History's date filter, to test multi-day recurring
  journey behavior without waiting real days.
- Reset onboarding state and clear the crash-reporting/theme preferences
  (Sections 9.1, 10.5), to re-test first-run flows without reinstalling.
- Simulate an AT GTFS Realtime delay of a chosen number of minutes on a
  selected bus/train leg, to exercise the stationary wait-leg sizing logic
  (Section 5.6, 7.9) without waiting for a real-world delay to occur.

Gate this behind `__DEV__` (or an EAS `development`/`preview` build
profile per 10.4) so it never ships reachable in a production build —
shake-to-open or a long-press on the Settings screen title are both
common, low-effort entry points.

### 12.3 Lightweight CI

A GitHub Actions workflow (or equivalent) running on every push/PR:

1. `tsc --noEmit` (typecheck)
2. lint (ESLint config matching whatever the Expo template ships)
3. `jest` (the full suite from Section 11.1, including migration tests)

This is deliberately not the E2E/device-farm CI scoped out in 11.3 — no
Detox, no simulator boot, just static checks and unit tests, which stay
fast (seconds, not minutes) and catch most of what actually breaks between
commits: a migration that silently drops data, a `classifyWeather()`
boundary that regressed, a typo that TypeScript would have caught. Cheap
enough to set up in Phase 1 (Section 8) and leave running for the rest of
the build rather than bolting on later.

---

## 13. Extended feature specs (build after v1 core — Phases 13+)

These are fully specced features, not a wishlist — build them in this order
once Phases 1–11 (Section 8) are functionally complete, the same way
Section 8 sequences the v1 core. Each spec below gives an agent enough to
actually implement it, not just a one-line idea to scope later.

### 13.1 Phase 13 — Weekly recap card

A read-only aggregate over data the app already has (`Journey`, `History`,
`GearFeedback`) — no new external calls, no new persisted tables beyond one
small tracking row.

- **Trigger**: a card at the top of the Today tab (above the "Right now"
  card, Section 4.2) every Monday, generated once and cached — check a
  `lastRecapWeekStart` row (own SQLite row) on Today-tab focus; if the
  current ISO week differs from the stored one and today is Monday, compute
  and store a fresh recap; otherwise reuse the cached one for the rest of
  the week rather than recomputing on every focus.
- **Query**: all `Journey` rows with `departTime` in the previous Mon–Sun
  window. Compute: total journey count, count grouped by top-level
  `classifyWeather().label` per journey (using the first outdoor leg's
  weather as representative), and the most-recommended gear item name from
  each journey's `recommendationSnapshot` (Section 3), counted by
  frequency.
- **Copy** (per the voice guide, Section 9.0.1): "Your week: 3 rainy
  commutes, your rain shell got 4 uses." Keep it to one line; if there's
  nothing notable (e.g. fewer than 2 journeys that week), don't show the
  card at all rather than rendering a thin "1 commute" line.
- **Dismissable**: a small close (×) that hides it until next Monday's
  regeneration — store dismissal against the same `lastRecapWeekStart` row
  so it doesn't reappear on every app open once dismissed.
- **Empty history**: if `History` has fewer than 2 weeks of data, don't show
  the recap yet — a recap over 1–2 journeys total isn't a real pattern.

### 13.2 Phase 14 — Shareable "Right now" conditions card

Turns the existing "Right now" card (Section 4.2, 9.3.1) into something
that can leave the app as an image.

- Add `react-native-view-shot` (new tech-stack row). A share icon on the
  "Right now" card renders the card's existing view (or a slightly
  restyled export-specific version, if the live card's tap targets don't
  translate well to a static image — e.g. drop the refresh affordance)
  to a PNG via `captureRef`, then hands it to `expo-sharing`'s share sheet.
- **Export-specific styling**: include a small wordmark/attribution line
  at the bottom ("via Commute Weather Planner") — this is the one piece of
  UI in the whole app whose entire purpose is being seen by someone who
  doesn't have the app yet, so it's worth the one deliberately
  non-utilitarian flourish, consistent with the "personal" half of Section
  9.0's character rather than the utilitarian half.
- No new data — this reuses the "Right now" card's existing
  `classifyWeather()` + reduced `recommendGear()` output (Section 4.2)
  as-is; the only new code is the capture-and-share plumbing.
- Test manually (Section 11.2) on both platforms — `react-native-view-shot`
  has historically had platform-specific quirks with transparent
  backgrounds and safe-area insets that are easy to miss in a quick check.

### 13.3 Phase 15 — Lock-screen / Live Activity & Android ongoing notification

The highest-frequency moment in the app — checking gear on the way out —
currently requires opening it. This phase surfaces it at the OS level.

- **iOS**: a Live Activity (`ActivityKit`, requires a native widget
  extension target — same `expo-dev-client` + config-plugin path as the
  home screen widget in 13.4, not achievable in Expo Go) started when a
  leave-by notification (Section 7.3) fires, showing the top gear
  recommendation and countdown to `departTime` on the Lock Screen and
  Dynamic Island. End the Activity automatically once `departTime` +
  first-leg duration passes, or if the user taps "Leaving now" (Section
  4.2) — whichever comes first.
- **Android**: no direct Live Activity equivalent — use an ongoing,
  low-priority foreground-service notification (`expo-notifications` with
  `sticky: true` and a fixed `identifier` so it updates in place rather
  than stacking) covering the same leave-by-to-departure window, showing
  the same recommendation summary. Dismissable by the user at any time
  (don't fight the swipe-to-dismiss — this is a convenience, not a
  persistent nag).
- **Update source**: both should re-render if the forecast-drift re-check
  (Section 5.2) changes the recommendation while the window is active —
  reuse that phase's "update in place, change the leading line" behavior
  rather than a separate notification.
- **Scope check before starting**: confirm current Expo SDK support for
  Live Activities (`expo-live-activity` or equivalent config plugin) at
  build time, since this corner of the Expo ecosystem moves faster than
  this spec can track — if no maintained plugin exists yet, a bare
  `expo-dev-client` + hand-written `ActivityKit` Swift target is the
  fallback, not a reason to skip the feature.

### 13.4 Phase 16 — Home screen widget

Full spec for the widget scoped out of v1 in Section 7.4.

- **iOS**: `WidgetKit` extension (Swift), added via `expo-dev-client` +
  a config plugin (e.g. `@bacons/apple-targets` or hand-rolled). **Android**:
  `react-native-android-widget`, which does support building the widget
  UI in JS/React.
- **Content**: next-up journey's route summary + top gear recommendation +
  departure countdown, reusing the exact data shape the Today-tab compact
  card (Section 9.4) already renders — the widget should be a thin
  presentation layer over data that's already computed for the Today tab,
  not a second recommendation pipeline.
- **Refresh**: iOS `WidgetKit` timeline entries recomputed on the same
  cadence as the forecast-drift re-check (Section 5.2) — piggyback on that
  existing background-fetch trigger rather than scheduling a second one.
  Android widget updates via `updatePeriodMillis` (system-throttled to
  ~30min minimum regardless of what's requested) plus a manual refresh
  broadcast whenever the app itself updates a journey's weather.
- **Empty state**: if there's no upcoming journey, show a compact "no
  journeys planned — open app to plan one" rather than a blank widget.
- **Theming**: widget respects the same light/dark/system preference as
  the in-app Settings toggle (Section 9.1) — iOS `WidgetKit` gets this via
  the system color scheme automatically; Android needs the stored
  preference read explicitly since a home-screen widget isn't inside the
  app's own React tree.

### 13.5 Phase 17 — Siri Shortcut / Android quick settings tile

Zero-tap access to the "Right now" card's existing reduced recommendation —
new entry point, not new logic.

- **iOS**: an App Intent (`AppIntents` framework, iOS 16+) exposing
  "What should I wear right now?" as a Siri-invokable and Shortcuts-app
  action. Requires a native module (no pure-JS/Expo-managed path) — the
  intent handler calls the same reduced `recommendGear` path the "Right
  now" card uses (Section 4.2) and returns a short spoken/displayed summary
  ("Rain shell and boots — light rain expected").
- **Android**: a Quick Settings Tile (`TileService`, native Kotlin/Java,
  added via a config plugin or bare module) that opens directly to a
  rendered "Right now" result — Android's Quick Settings tiles are tap
  targets that open the app, not voice/text responders like an App Intent,
  so parity here means "one tap from the shade to the answer," not literal
  feature-for-feature parity with iOS.
- **Both require a custom dev client** (`expo-dev-client`), not Expo Go, to
  build and test — flag this explicitly before starting, since it changes
  the local dev workflow for whoever picks up this phase.

### 13.6 Phase 18 — Route-learning Plan defaults

Extends the v1 baseline (Section 4 already defaults Plan's origin to Home
and time to now) with a second, higher-confidence default learned from
actual usage.

- **Signal**: `SavedRoute.lastUsedAt` plus a new `dayOfWeekUsage: number[]`
  field (7-length array, one count per weekday, incremented each time that
  `SavedRoute` is used) added to the `SavedRoute` model (Section 3) via an
  additive migration (Section 3.1).
- **Behavior**: on opening Plan fresh, if today's weekday has a
  `SavedRoute` with a `dayOfWeekUsage` count for that day at least 3 and
  clearly dominant (≥2× the next-highest route's count for that day),
  surface it as a one-tap suggestion banner above the normal chip row —
  "Usual Tuesday route: Home → Work?" — rather than requiring the user to
  find and tap the chip themselves. Declining it (tapping elsewhere) just
  dismisses the banner for that session; it doesn't penalize the count.
- **Cold start**: with fewer than 3 uses on a given weekday, show nothing
  extra — the existing v1 chip row (Section 4.3) is enough until there's a
  real pattern to learn from.

### 13.7 Phase 19 — Cloud sync / multi-device

The largest scope increase on this list — genuinely a different
architecture tier (accounts, a backend, conflict resolution) rather than a
UI feature layered on existing local logic. Sequenced last deliberately.

- **Backend**: a managed BaaS (Supabase or Firebase) rather than a
  hand-rolled server — this is a single-developer app and a managed auth +
  Postgres/Firestore layer avoids building session management and a REST
  API from scratch.
- **Auth**: email/passwordless magic-link (avoids a password-reset flow to
  build/maintain) or Sign in with Apple/Google, matching whichever the
  chosen BaaS supports with the least custom code.
- **Sync model**: last-write-wins per row, keyed on the UUIDs Section 10.3
  already committed to for exactly this reason. Push local changes on
  write (already-optimistic per Section 5.4, so this just adds a network
  write behind the existing optimistic local write), pull remote changes
  on foreground + a periodic background sync. Don't attempt field-level
  merge — row-level last-write-wins is enough for single-user data that's
  rarely edited concurrently across devices (this isn't a collaborative
  app), and anything fancier is scope the app doesn't need.
- **Local-first stays true**: SQLite remains the source of truth for
  rendering; sync is a background reconciliation against it, not a
  replacement for it — the app must still fully function offline exactly
  as it does in v1, with sync resuming silently when connectivity returns.
- **Migration for existing users**: on first sign-in, upload the existing
  local SQLite data as the initial cloud state (a one-time push, not a
  merge, since there's nothing to merge against yet) rather than asking
  the user to re-enter anything.
- **Privacy policy update required**: Section 10.4's privacy policy draft
  needs a new section once this ships — a cloud account changes "stored
  on-device only" to "stored on-device and synced to \[BaaS provider]," and
  that's a material change the existing policy language doesn't cover.

### 13.8 Phase 20 — Hike mode

The `hike` `TravelMode` (Section 3), `HikeRouteSample` sampling
(Section 3.5, 5.7), and `recommendGear()` adjustments (Section 7.11) are
already specced in their respective sections — this is the assembly and
scoping spec that ties them together as a build phase, the furthest
scenario from the app's core commute-planning assumptions and accordingly
the most involved addition in this document.

- **Why it's here, not in v1**: Open-Meteo is queried for a single lat/lng
  at ground level everywhere else in the app; a hike gains elevation over
  several hours, and temperature/wind at a summit can differ meaningfully
  from the trailhead forecast. Representing that properly needs a new
  sampling strategy (Section 5.7), a new mode-specific warmup curve
  (Section 7.11), and an offline-first posture stronger than Section 5.1's
  existing fallback assumes — three genuine sub-projects, not a quick
  extension of the `walk` mode.
- **Plan screen**: `hike` sits behind a "More modes" overflow on the mode
  selector (Section 4, Phase 3 note) rather than cluttering the
  day-to-day walk/drive/bus/train/cycle row, since it's a meaningfully
  less frequent trip type for most users.
- **Confidence matters more, not less**: hikes are disproportionately
  planned days ahead — exactly the case Section 5.3's `forecastConfidence`
  degrades hardest for. The confidence banner (Section 9.3) and the
  in-card note from Section 7.11 both apply, deliberately redundant with
  each other given the stakes of a multi-hour trip caught by a wrong
  forecast.
- **Offline-first is closer to a requirement than a nice-to-have** here,
  unlike the general case in Section 5.1: add a "download for offline"
  action on Journey Detail for `hike` journeys specifically, fetching and
  caching the full route + all `hikeSamples[]` weather before departure.
  Section 5.1's existing 30-day cached-route fallback assumes a *previous*
  journey exists between the same two points — a first-time hike route has
  nothing to fall back to, so this phase can't simply inherit that
  mechanism unmodified.
- **Explicitly out of scope, even within this phase**: water/food
  tracking, trail difficulty ratings, GPS breadcrumb recording, and any
  kind of live tracking or safety check-in feature. This app recommends
  clothing from the user's own inventory; it is not a hiking safety app,
  and building toward that would dilute rather than extend the core pitch.
  If a future contributor wants those features, they belong in a
  separate, explicitly-scoped phase of their own — the same discipline
  Section 13.7 applies to cloud sync.
- **Testing**: extend Section 11.1's `recommendGear()` table-driven cases
  to cover a `hike` leg with multiple `hikeSamples[]` at varying
  elevation/temp, confirming `minTemp`/`maxGust` correctly fold across all
  samples rather than just the first or last. Extend Section 11.2's manual
  plan with an offline-download-then-airplane-mode walkthrough for a
  cached hike journey.

### 13.9 Phase 21 — Mascot companion

A small, illustrated character that reacts to today's weather and wears a
tinted version of whatever `recommendGear()` (Section 7) actually picked —
purely a delight/personality layer with zero effect on any recommendation
logic. Scoped deliberately to two tiers of a three-tier idea that was
considered (see `DECISIONS.md` for why the third tier — generating a
lookalike garment from the item's own uploaded photo — is logged as
explicitly deferred rather than attempted here).

- **Why it's its own phase, not folded into Polish (Phase 11)**: this
  needs real character art (a base mascot illustration plus a small set of
  clothing-slot overlay shapes) that this spec cannot produce — it's a
  genuine external design-asset dependency, the same category of blocker
  as the app icon concept in Section 10.4, just larger in scope. It also
  introduces two new libraries (`react-native-svg`,
  `react-native-reanimated`, Section 1) that nothing before this phase
  needs, so there's no reason to pull them in earlier.
- **Where it renders**: one shared component, fed by a small pure selector
  function (`mascotStateFor()`, in its own `src/lib/mascot.ts` — not
  `recommend.ts`, since this is presentational mapping, not recommendation
  logic), reused in two places:
  - **Primary**: pinned above the "Right now" card (Section 9.3.1) on the
    Today tab, reflecting current conditions — this is the highest-traffic
    surface in the app and the most natural home for a persistent
    companion.
  - **Secondary**: a smaller version on Journey Detail (Section 9.3),
    reflecting that specific journey's `Recommendation` rather than
    current conditions, so a journey planned for tomorrow's colder
    afternoon shows the mascot dressed for *that*, not right now.
- **Animation states — mapped from signals the engine already computes,
  nothing new derived**:

  | State | Trigger | Motion |
  |---|---|---|
  | Idle | default | gentle bob + slow blink loop |
  | Wave | on screen focus/mount | one-shot arm-raise, then falls back to idle |
  | Shiver | `warmthLevel >= BOTTOMS_COLD_WARMTH_LEVEL` (Section 7.13's existing genuine-cold-snap threshold) | small rapid side-to-side jitter + visible breath puff |
  | Sun-squint | `HIGH_UV_INDEX` met (Section 7.6) | eyes narrow, one hand shading brow |
  | Umbrella-huddle | `Recommendation.umbrella` is a real item (Section 7) | mascot holds the (tinted, Section 13.9 below) umbrella overlay, slight forward-lean |
  | Wind-blown | any leg flagged `windEffect === "amplified"` past `WIND_CHILL_KPH` (Section 7.8) | hair/scarf-overlay streams sideways, looping |
  | Warm/fanning | `HOT_C` met (Section 7.15) | one hand fanning, subtle sweat-drop blink |

  Priority when multiple apply (e.g. cold *and* windy): reuse the same
  "worst case wins, don't stack" instinct as `notes[]` ordering elsewhere
  in Section 7 — shiver + wind-blown can compose (both are physically
  compatible poses), but shiver and warm/fanning are mutually exclusive by
  construction (`warmthLevel` and `HOT_C` can't both be true for the same
  leg), so no conflict-resolution logic is actually needed beyond what the
  engine already guarantees.
- **Outfit tinting ("paper doll")**: a small fixed library of overlay
  shapes (jacket, bottoms, umbrella — matching the mascot's own visible
  slots) tinted at render time from the corresponding recommended item's
  `color` (`MascotSwatch`, Section 3), via SVG `fill`. Slot priority
  mirrors the layers stack's own visual priority (Section 9.3): jacket
  overlay shown if `Recommendation.layers` resolved one, else midlayer,
  else base; `bottoms` and `umbrella` are independent slots shown whenever
  those fields are set. **Graceful fallback is required, not optional**:
  the vast majority of existing inventory items will have no `color` set
  (it's a Phase 21-only field, Section 3) — an unset color renders a
  neutral grey placeholder shape rather than guessing a color or omitting
  the overlay entirely, so the mascot never looks broken for a user who
  hasn't gone back to tag their wardrobe with colors.
- **Gear CRUD swatch picker** (Section 9.7): the `color` field's UI —a
  small fixed swatch row, not a free color picker — appears in the
  add/edit form starting this phase. `color`/`MascotSwatch` (Section 3)
  ship via this phase's own additive migration (Section 3.1), the same
  precedent `hikeSamples`/`HikeRouteSample` already set for Phase 20 —
  added exactly when the feature that needs them lands, not pre-added in
  Phase 1 and left dormant for twenty phases.
- **Accessibility (must satisfy Section 9.6, not a separate bar)**: the
  mascot is purely decorative — `accessibilityElementsHidden`/
  `importantForAccessibility="no"` on the whole component, since every
  piece of information it conveys (condition, temperature, what's
  recommended) is already fully available through the existing accessible
  gear card and leg list text (Section 9.3, 9.6). It must never become a
  screen-reader trap or a color-only signal in its own right. Respect the
  OS-level reduce-motion setting
  (`AccessibilityInfo.isReduceMotionEnabled()`) by dropping to a single
  static pose per state — no idle bob, no wave, no looping wind animation
  — rather than ignoring that preference the way a purely-cosmetic feature
  is most likely to be overlooked.
- **Explicitly out of scope, even within this phase**: generating a
  lookalike garment from the item's own uploaded photo (segmentation/
  overlay or AI-generated restyling) — logged in `DECISIONS.md` as a
  separate, larger idea that was deliberately not attempted here, the same
  discipline Section 13.7/13.8 apply to cloud sync and hike-mode scope
  respectively. Also out of scope: more than the seven states above (no
  night-mode pajamas, no seasonal costume changes, no purchasable/
  unlockable cosmetics) — this is a weather companion, not a
  collectible-avatar system.
- **Testing**: `mascotStateFor()` is a pure function — table-driven tests
  covering each state's trigger boundary (reusing the exact same fixture
  temperatures/UV/wind values already used for the equivalent
  `recommendGear()` tests, Section 11.1, so the two never drift apart on
  what counts as "cold" or "hot"), the shiver/wind-blown composability
  case, and the neutral-grey fallback when `color` is unset on every
  tinted slot. Manual: toggle the OS reduce-motion setting and confirm the
  mascot drops to static poses without any animation library warnings.
