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

