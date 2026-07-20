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

