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

