# DECISIONS.md — spec deviations & judgment calls

Append-only. One entry per deliberate deviation from, or judgment call
within, the docs in `docs/`. Don't edit or delete past entries — if a
decision is later reversed, add a new entry that supersedes it and says so.

---

## 2026-07-19 — Advanced warmth threshold overrides (Section 3.6, 9.1.1)

**What**: added an opt-in "Advanced" Settings section exposing
`FREEZING_C` / `COOL_UPPER_C` / `WARM_OUTDOOR_C` (Section 7) as directly
editable numbers (`AdvancedWarmthThresholds`, Section 3.6), collapsed by
default.

**Why this needed a decision**: Section 7.5 explicitly rejected exposing
these thresholds directly, on the stated reasoning that "nobody will tune
correctly" — the feedback-driven calibration loop was chosen instead as
the only mechanism for personalizing warmth. This is a direct reversal of
that stated position, not an extension of it.

**Resolution**: kept the feedback loop as the default and primary path for
the vast majority of users — nothing about Section 7.5's calibration
system changed. The override is narrow, off/collapsed by default, requires
an explicit tap to expand, and ships with in-UI copy that actively points
back at the calibration loop ("Most people get better results from the
check-ins above"). Treated as a small, explicitly-scoped escape hatch for
power users who want it, not a replacement for the learned-offset approach.

---

## 2026-07-19 — `substitutesForMidlayer` scoped to jacket-absorbs-midlayer only (Section 3.6, 7.12)

**What**: added a single boolean field on `ClothingItem` letting one jacket
stand in for both itself and a midlayer, rather than building a general
mechanism for any item to substitute for any layer slot.

**Why this needed a decision**: the motivating case (a rain shell with a
built-in thin puffer lining) generalizes fairly naturally to "any item
could substitute for any other layer type" — e.g. a heavy midlayer that's
warm enough to skip a base layer, or a pair of trousers that's also
technically a base layer. That's a materially larger change: a general
substitution graph across all four `ClothingType`s, conflict rules for
when two substitutions overlap, and UI for expressing arbitrary
substitution relationships rather than one fixed toggle.

**Resolution**: scoped narrowly to the single case that was actually
requested and is genuinely common (a jacket doing double duty as its own
midlayer). Explicitly flagged in Section 7.12 as the same category of
scope decision as the multi-user (Section 2.2) and cloud-sync (Section
13.7) exclusions — a future contributor who wants general substitution
should give it its own fully-specced pass rather than extending this
boolean informally.

---

## 2026-07-20 — Hot-weather guidance kept as a note, not an item-matching feature (Section 7.15)

**What**: added a single note ("something breathable and light-colored
will feel better") when `apparentTempC >= HOT_C`, with no corresponding
`breathable` attribute on `ClothingItem` and no attempt to resolve a
specific item the way jackets/umbrellas/bottoms are resolved.

**Why this needed a decision**: every other piece of guidance in this
engine resolves to an actual owned item — that's the app's whole pitch
("recommends your real wardrobe, not generic advice"). A bare text note
with no matching item is a real inconsistency with that pitch, not a
neutral choice.

**Resolution**: accepted the inconsistency deliberately rather than
half-building a `breathable` tag/attribute system under time pressure. The
engine is otherwise entirely cold-direction (every threshold, every
constant, every piece of item-matching logic is about adding warmth), and
retrofitting a properly-considered hot-weather item-matching path — tag
taxonomy, `pickLayer()` changes, UI for tagging existing base-layer items —
deserves its own scoped pass rather than a rushed bolt-on here. Flagged
directly in Section 7.15's prose as a known gap and a natural next step,
not silently left implicit.

---

## 2026-07-20 — Severe-weather advisory is a single suggestion sentence, not a safety feature (Section 7.14)

**What**: added `Recommendation.severeWeatherAdvisory`, a one-sentence
suggestion to reconsider walking/cycling when a leg crosses
`SEVERE_WEATHER_SEVERITY` or `SEVERE_GUST_KPH`.

**Why this needed a decision**: it would be easy for this feature to grow
scope-creep toward something that reads as a genuine safety system — live
monitoring, push alerts as conditions change mid-journey, blocking the
"Plan journey" button, or integrating actual weather-warning feeds. None
of that was asked for, and this app has no business implying a level of
protective monitoring it doesn't actually do.

**Resolution**: deliberately kept to the same shape as every other note
in this engine — one sentence, computed once at planning/recompute time,
non-blocking, no persistence or dismissal state, no re-notification
mid-journey beyond the existing forecast-drift recompute (Section 5.2)
already re-running this same check. Explicitly tied in Section 7.14's
prose to the same stance Section 13.8 (hike mode) already states plainly:
this app recommends clothing from the user's own inventory, it is not a
safety app, and this advisory doesn't cross that line just because it
touches the word "severe."

---

## 2026-07-20 — Mascot companion built to Tier 1+2 only; photo-derived garment generation deferred (Section 13.9)

**What**: specced a mascot companion with weather-matched animations
(Section 13.9's state table) and swatch-based color tinting of its
clothing overlays (`ClothingItem.color`/`MascotSwatch`, Section 3) —
Phase 21. A third idea was considered and explicitly not specced: having
the mascot wear a lookalike rendering of the user's actual photographed
garment, either by segmenting/overlaying the real photo or by generating a
stylized illustration from it.

**Why this needed a decision**: the three ideas were proposed together as
one feature request, and it would have been easy to either half-build the
third tier alongside the first two, or silently drop it without saying so.
Both are worse than deciding explicitly.

**Resolution**: built Tiers 1 (animation) and 2 (swatch-color tinting)
fully — both are cheap, fully local/offline, and need no new runtime
dependency beyond two well-established RN libraries. Tier 3 was deferred,
for concrete reasons rather than "sounds hard": photo-segmentation-and-
overlay rarely produces a garment that convincingly wraps a 2D character's
pose without significant per-item illustration work, and AI-generated
restyling requires a per-item network call to an image-generation
service — cost, latency, and a hard network dependency that cuts directly
against this app's local-first design (Section 5.1, 5.8) for a purely
cosmetic feature. Treated as the same category of scope call as cloud
sync (Section 13.7) and hike mode's safety-feature boundary (Section
13.8) — a genuinely separate project, not a natural extension of Tiers
1+2, and one a future contributor should scope on its own rather than
bolt onto this phase.

---

## 2026-07-20 — Locations CRUD uses text/number fields, not map pin-drop or Places search (Section 4, "Locations" bullet)

**What**: Phase 2's `SavedLocation` add/edit form (`src/screens/locations/LocationForm.tsx`) takes label, address, and lat/lng as plain text/number inputs, rather than the "map pin drop or address search" the spec describes.

**Why this needed a decision**: both real alternatives have a hard dependency Phase 2 doesn't have yet. Address search means Google Places autocomplete, which is explicitly Phase 4 work (`docs/02-external-apis.md` §2, `docs/04-screens-navigation.md` §4 "Plan" bullet) — billing setup and the debounced-autocomplete wiring aren't in scope this early. Map pin-drop means `react-native-maps`, which has no web target; importing it here would break the web dev-mode smoke-check this project has been using to verify each phase in the browser (`expo start --web`), for a screen that doesn't strictly need a map to be functional.

**Resolution**: kept `SavedLocation` CRUD fully functional with text/number fields for now. `react-native-maps` gets its first real use in Phase 3 (Journey Detail's map, `docs/08-build-phases.md` phase 3), which is also the natural place to decide how to handle its web-target gap (conditional rendering, a web-only placeholder, etc.) once and reuse that pattern here too, rather than solving it twice. Address search moves to Phase 4 alongside the rest of the live-API wiring it actually depends on. Revisit this form once both exist rather than half-wiring either ahead of its dependencies.

---

## 2026-07-20 — Onboarding gate uses an explicit completed flag, not the "no Inventory/no SavedLocation" check (Section 4.1)

**What**: `needsOnboarding` (read in `App.tsx`/`RootNavigator`) is driven by a new `app_settings.onboarding_completed` flag (`src/db/repositories/settings.ts`), set once the onboarding flow finishes — skipped or not — rather than by querying whether any Inventory/SavedLocation rows exist yet.

**Why this needed a decision**: Section 4.1 defines "first launch" as "no `Inventory` rows and no `SavedLocation` rows at all," but the same section also says "a user can skip straight through and land on an empty Today tab; that's fine." Taken literally, the first definition means onboarding re-triggers on every subsequent launch for a user who skipped every step, since the data-presence condition is still true — which contradicts landing on Today being "fine." The two statements are in tension as written.

**Resolution**: read the first statement as describing *when onboarding is first shown*, and the second as the actual desired steady-state behavior afterward, and bridged the gap with an explicit flag rather than re-deriving "have we shown onboarding" from data that a fully-skipped run never writes. `needsOnboarding` is `!onboarding_completed`, set true unconditionally when the user reaches the end of the flow (finished or skipped through). This is a one-line interpretive call, not a structural change — worth flagging since a future contributor reading Section 4.1's data-presence sentence in isolation might "fix" this back to the literal reading and reintroduce the loop.

---

## 2026-07-20 — Plan screen's date/time picker is plain text fields (Section 4, "Plan" bullet)

**What**: `src/screens/plan/PlanScreen.tsx`'s "When" section is two text inputs (`YYYY-MM-DD`, `HH:mm`), defaulting to now, rather than a native date/time picker widget.

**Why this needed a decision**: `docs/01-tech-stack.md`'s dependency table doesn't include a date/time picker library (`@react-native-community/datetimepicker` or similar), and React Native itself dropped its old built-in `DatePickerIOS`/`DatePickerAndroid` components years ago — there's no picker available without adding a new dependency the spec doesn't call for. Same shape of gap as the map/geocoding decision above (Locations CRUD), and resolved the same way.

**Resolution**: plain text fields for now, matching the lat/lng precedent already set for `SavedLocation`. Functionally complete — `departTime` still parses correctly and defaults to "now" per §4.3 — just not the polished picker UI the spec's wording implies. Revisit if/when a date-picker dependency is deliberately added to the tech stack (most naturally alongside Phase 4's other UI-polish passes), rather than pulling one in ad hoc mid-Phase-3 for a single field.

---

## 2026-07-20 — Bus/train journeys with waypoints skip indoor dwell legs (Section 5.5)

**What**: `src/lib/planJourney.ts`'s `stepsToAssembledLegs()` only interleaves a waypoint's indoor dwell leg (`Journey.waypoints`, §3.5/§4.3.1) into the leg list for walk/cycle/drive modes. A bus/train journey with waypoints still routes through them (they're passed to Google as `intermediates`), but the resulting leg list has no separate indoor stop for them.

**Why this needed a decision**: Google's Routes API returns one leg per hop for WALK/BICYCLE/DRIVE (`origin→wp1`, `wp1→wp2`, …), which lines up 1:1 with our per-hop leg model — clean to interleave. TRANSIT mode instead returns one flat `steps[]` list for the whole trip mixing WALK/TRANSIT sub-segments, with no documented hop boundary once waypoints are involved, and (per Google's docs, unverified here — no live API key this session, see the Phase 4 kickoff conversation) transit routing's support for intermediate waypoints at all is uncertain. Guessing at hop boundaries from step count would be fragile.

**Resolution**: scoped narrowly — waypoints still fully affect the *route itself* (Google still routes through them), just not our leg list's presentation of them as separate indoor stops, for transit specifically. A multi-stop transit errand (bus to the bank, then the pharmacy, then work) is a narrow combination for a commute app; if it turns out to matter, revisit once a real Routes API key is available to confirm how Google actually behaves here, rather than guessing further now.

---

## 2026-07-21 — Phase 5's recommendGear() omits the annotation-gated wind/sun deltas and puddle risk (Section 7.8)

**What**: `src/lib/recommend.ts`'s Phase 5 `recommendGear()` implements Section 7 in full except the `windLeg`/`sunLeg` envDelta block and puddle-risk shoe override from Section 7.8. The stationary-wait aggravation (also introduced in the same "step 1.5" code block in Section 7's reference implementation, but covered by Section 7.9 rather than 7.8) is included now, not deferred.

**Why this needed a decision**: Section 7's reference code presents wind-tunnel, sun-exposure, and stationary-wait as one contiguous adjustment step, citing both §7.8 and §7.9 together — reading it in isolation, all three look like Phase 5 work. But `docs/08-build-phases.md`'s Phase 6 description explicitly lists "the wind/sun/reflection/puddle/rain-cover adjustments to `recommendGear()` (Section 7.8)" as Phase 6 work, with stated reasoning: those adjustments only ever fire when a leg is flagged `windEffect`/`sunEffect`/`highReflection`/`puddleRisk` — fields that don't exist yet because Phase 6 is what wires the `EnvironmentAnnotation` matching (and puddle risk's `recentPrecipMm6h`, needing the `past_days` Open-Meteo parameter Phase 6 also adds) that sets them. Writing that block now would be genuinely dead code, unlike the `hikeSamples`-in-Phase-1-schema precedent (that shape gets *read* correctly once Phase 20 exists; §7.8's block wouldn't even have real inputs to read until Phase 6).

**Resolution**: split by data dependency, not by section number. Stationary-wait aggravation needs only `JourneyLeg.isStationary` and `WeatherSnapshot.windKph`/`apparentTempC`, both real since Phase 4 — included in Phase 5. Wind-tunnel/sun-exposure/reflection/puddle-risk need annotation-matching and `recentPrecipMm6h`, both Phase 6 — deferred there, exactly as `docs/08-build-phases.md` Phase 6 already describes, so Phase 6 only has to *add* that block to an already-built function rather than reconcile a conflicting reading.

---

## 2026-07-21 — Annotation UI simplifications: no embedded-map repositioning, no swipe-to-delete, stepped radius chips, no row map thumbnails (Section 4.5)

**What**: Phase 6's `EnvironmentAnnotation` UI deviates from §4.5's wording
in four small ways: (1) editing an annotation from the Local knowledge list
repositions via lat/lng number fields, not "a small embedded map"; (2) list
rows delete via a per-row ✕ button (plus a delete action inside the edit
form), not swipe-to-delete; (3) the radius control is a stepped chip row
(50/100/150/200/250/300m, default 100), not a continuous 50–300m drag
slider; (4) list rows show an effect icon, not "a small static map
thumbnail centered on it."

**Why this needed a decision**: each is the same shape of gap already
logged for earlier phases rather than a new judgment: `react-native-maps`
has no web target (breaking the browser smoke-check this project verifies
every phase with — the exact reasoning in the "Locations CRUD uses
text/number fields" entry), no slider or swipe-gesture dependency is in
`docs/01-tech-stack.md`'s table (the same reasoning as the WarmthSlider
stepped-segments and plain-text date-picker entries), and a static map
thumbnail per row would need either a Maps Static API call (billing, a new
network dependency for pure decoration) or a live embedded map per row.

**Resolution**: kept every §4.5 behavior — add-in-context via map
long-press with live radius-circle preview (native), edit/delete/review
from the list, per-effect placeholder copy, the 4.1 empty state — with
those four presentation details simplified to match the established
precedents. The map long-press add flow itself IS built with the real
map circle preview, since Journey Detail's native map already exists;
only the list/edit screen avoids map dependencies. Revisit alongside the
same future pass the Locations entry already anticipates (if a map
pin-drop/slider dependency is ever deliberately added).

---

## 2026-07-21 — AT GTFS Realtime lookup keys are best-effort, not real AT GTFS ids (Section 5.6, Phase 7)

**What**: `transitService.getRealtimeDelay()` (`src/services/transitService.ts`)
makes a real network call to AT's trip-updates feed and matches a
`stop_time_update` by `routeId`/`stopId`. Those two values, as threaded
through from `routesService.ts`'s Google Routes parsing into
`planJourney.ts`, are Google's own route short name (`transitLine.nameShort`)
and departure-stop display name (`stopDetails.departureStop.name`) — not
AT's actual GTFS `route_id`/`stop_id`, which are separate internal
identifiers Google's transit response doesn't expose.

**Why this needed a decision**: Section 5.6 describes sizing the wait leg
"from the AT GTFS Realtime scheduled-vs-actual delta for that specific
departure," which in a fully-correct implementation means matching the
exact `trip_id` AT's feed uses. Building that match properly would require
importing and indexing AT's static GTFS feed (stops.txt/routes.txt/trips.txt)
to resolve Google's names/short codes to AT's real ids — a standalone data
pipeline, not a small addition to this phase, and the same order of scope
as the multi-user (§2.2) and cloud-sync (§13.7) exclusions already logged
here.

**Resolution**: implemented the service call for real (real fetch, real
auth header, real JSON parsing, proper `ServiceResult` error mapping) using
the best-effort name-based keys as-is, rather than leaving the whole
integration stubbed or half-faking a static-GTFS lookup under time
pressure. A mismatch (the very likely case until a real ids-resolution
pass exists) simply produces "no matching entity found," which
`getRealtimeDelay()` maps to the same `unreachable` result AT being
genuinely down would produce — §5.6 point 2's flat 5-minute fallback
already covers that path correctly, so the user-facing behavior degrades
gracefully rather than breaking. Revisit once a real AT subscription key
and static GTFS import are both in place to verify actual field shapes,
the same "unverified — no live key this session" caveat already logged for
the Google Routes waypoints-transit entry above.

**Also**: `RealtimeDelay.stopType` ("platform" vs "street-stop", used for
`JourneyLeg.waitContext`) is inferred purely from travel mode — trains
always "platform," buses always "street-stop" — rather than from GTFS stop
metadata, since the realtime trip-updates feed carries no `location_type`
data (that's static-GTFS territory too). A reasonable default per §5.6
point 1's own wording ("inferred from the AT GTFS stop type if available,
**otherwise default to transit-stop**"), just a smarter default than a
blanket transit-stop for both modes.

---

## 2026-07-21 — Phase 8 (leave-by notifications): freeze/recordWear via a
Journey-Detail fallback and a foreground listener, not a background task;
recurrence-pause cancellation deferred (no UI exists to pause one)

**What**: `src/lib/leaveBy.ts` implements §7.3/§7.16's "freeze
`RecommendationSnapshot` and call `recordWear()` at leave-by time" via two
triggers, not a single one: (1) `App.tsx` registers
`Notifications.addNotificationReceivedListener`, which fires the freeze
when the scheduled notification is actually delivered while the app
process is alive (foreground or backgrounded); (2) `JourneyDetailScreen`
calls `freezeIfDue()` on every load as a fallback, covering the case where
the app was fully killed and the listener never ran. `freezeIfDue()` is
idempotent (guarded by `recommendationSnapshot` already being set), so
either trigger firing first is fine.

**Why this needed a decision**: Expo's managed workflow (this project's
tech stack, `docs/01-tech-stack.md`) has no reliable way to run JS and
write to SQLite at a precise future moment when the app isn't running —
that needs a native background-task extension (`expo-dev-client` +
`expo-task-manager`/`BGTaskScheduler`), the same category of native-
complexity gap already logged for the home screen widget (§7.4) and
deferred there for the same reason. Silently shipping only the
listener-based path would mean wear tracking/History snapshots simply
never populate for a killed-app scenario, which is a real and common case
for a commute app (phone locked, app swiped away overnight).

**Resolution**: `RecommendationSnapshot`'s own doc comment already
anticipates exactly this gap — "frozen at leave-by time... or on first
History view of a past journey missing one" (`docs/03-data-models.md`)
— so the fallback isn't a new invention, it's implementing a case the
spec's own data model comment already called for. Journey Detail (not
History, which is still Phase 9's empty shell) is where it's wired for
now since it's the only screen currently reading real past Journeys;
revisit once Phase 9 builds History proper to make sure it also benefits
(it will, automatically, once History reads through `getJourney`/the same
repository layer — no additional wiring anticipated, but worth confirming
then).

**Also**: §7.3 also calls for cancelling a scheduled notification when the
user deletes a Journey or "turns off a recurrence's `active` flag." A
minimal delete-journey action (confirm-then-delete) was added to Journey
Detail specifically to make the deletion half of this reachable — no such
action existed anywhere before this phase. The recurrence-pause half is
**not** wired: no screen in any phase through Phase 7 exposes editing or
pausing an existing `RecurrenceRule.active` flag (Plan screen only sets
`active: true` once, at creation), so there is no UI trigger to attach a
cancellation call to. Building a recurrence-management screen is out of
Phase 8's stated scope ("Leave-by notifications"); revisit alongside
whichever future phase adds recurring-journey editing.

---

## 2026-07-21 — Fixed web bundling (`metro.config.js`), added `withTimeout()` as a defense-in-depth backstop, not the primary fix

**What**: added `metro.config.js` registering `"wasm"` on
`resolver.assetExts`, and extracted `App.tsx`'s inline startup-timeout
helper into `src/lib/withTimeout.ts`, applying it to every onboarding
step's DB write (`Step2HomeWork`, `Step4GearBasics`, `Step5CrashReporting`,
`OnboardingScreen.finish`).

**Why this needed a decision**: earlier in this project's history, `expo
start --web` failed to bundle at all with "Unable to resolve
./wa-sqlite/wa-sqlite.wasm" (`expo-sqlite`'s web backend imports a `.wasm`
binary Metro's default asset-extension list doesn't recognize), which was
treated as a pre-existing, unfixable environment limitation and worked
around with `App.tsx`'s `withStartupTimeout` — a timeout+fallback around
the *startup* `getDb()`/`isOnboardingCompleted()` calls only. That
narrower guard meant every *other* DB write in the app (onboarding steps,
eventually every screen) still hung indefinitely and silently on web,
which is what actually surfaced as "the crash-reporting Done button
doesn't work."

**Resolution**: the wasm resolution failure turned out to be a one-line
Metro config gap, not a structural web-incompatibility — pushing `"wasm"`
onto `resolver.assetExts` fixes bundling outright, and once fixed,
`expo-sqlite`'s web backend (OPFS-based) worked correctly with no
COOP/COEP-related errors in this dev environment (contrary to
`App.tsx`'s original comment speculating that headers would also be
needed — they weren't, at least not for local `expo start --web`).
**The `withTimeout()` extraction is kept anyway**, applied more broadly
than before, as a defense-in-depth backstop — a DB call hanging for some
other reason (a different browser's OPFS quirks, a future regression)
should still degrade to "onboarding step didn't save, but the button
isn't stuck" rather than freezing the UI silently, the same reasoning
`App.tsx`'s original guard was built on. This is belt-and-suspenders, not
a substitute for the real fix.

---

## 2026-07-21 — Phase 9 (History): JourneyDetailScreen now prefers `recommendationSnapshot` over a live recompute whenever one exists, not just when opened read-only from History

**What**: `GearRecommendationCard` gained a second render path (`snapshot: RecommendationSnapshot` prop, alongside its existing `recommendation: Recommendation` prop), and `JourneyDetailScreen` now renders from `journey.recommendationSnapshot` whenever it's set, falling back to the live `useRecommendation()` result only when it isn't — for every journey the screen opens, not only ones opened `readOnly` from the new History screen.

**Why this needed a decision**: docs/09-design-system.md §9.4.2 only describes this swap for History's detail view ("reuses the Journey Detail component from 9.3... swaps the live Recommendation for the frozen recommendationSnapshot fields where present"), which reads as History-scoped. But the Phase 8 entry above already flagged this exact gap and said it would resolve "automatically" once Phase 9 built History — that framing assumed Journey Detail would end up branching on `readOnly`/History-origin specifically. On inspection, `RecommendationSnapshot`'s doc comment (docs/03-data-models.md) states its purpose plainly: it exists so any past-journey view "reads this instead of re-running the live engine" — that's about the journey being in the past, not about which screen happens to be showing it. Gating the swap behind `readOnly` would leave a real bug: viewing an old journey directly (not through History — e.g. a `linkedReturnJourneyId` link, or Today's list before a journey's flagged past) would keep recomputing against whatever the inventory looks like *now*, silently misrepresenting what was actually recommended at leave-by time — exactly the drift `recommendationSnapshot` was built to prevent.

**Resolution**: scoped the swap to "does a snapshot exist," not "is this screen read-only" — the two are related but not identical (a journey can have a snapshot independent of being opened from History). `readOnly` itself stays narrow, used only to hide the return-trip Pressable (the one piece of UI §4.4 says doesn't apply to a past journey). Severe-weather/confidence banners still read the live `recommendation`, since `RecommendationSnapshot` doesn't carry those fields — a narrower, separate gap this pass doesn't attempt to close.

---

## 2026-07-21 — Phase 10 (Personalization): forecast drift re-check (§5.2) runs on app/screen foreground only, not the 3h/30min OS-scheduled background task; dev-menu triggers (§12.2) not built

**What**: `src/lib/forecastDrift.ts`'s `checkForecastDrift()` re-fetches weather and recomputes `recommendGear()` for a still-upcoming Journey, but is only ever invoked from two foreground triggers: `App.tsx`'s `AppState` "active" listener (checking every Journey departing within the next 24h) and `JourneyDetailScreen`'s existing focus effect (checking the one Journey currently open, alongside its existing `freezeIfDue()` fallback call). Similarly, `src/lib/calibration.ts`'s `runCalibrationDecayIfDue()` (§7.5.3) runs from the same `AppState` listener rather than a scheduled background job, and no dev-menu screen (§12.2) exists to trigger either manually.

**Why this needed a decision**: §5.2 describes "background-scheduled re-fetch... at a fixed lead time before departure: 3 hours out... and again at 30 minutes out," using `expo-task-manager` + `expo-background-fetch` for the 3-hour check specifically, with a foreground check as a stated supplement, not the primary mechanism. Building the real OS-scheduled version needs the same native background-task extension already identified as out of scope for this Expo-managed-workflow project — logged for §7.4 (home screen widget) and, most directly, the Phase 8 entry above for §7.3/§7.16's freeze/recordWear point, which resolved the identical gap ("Expo's managed workflow has no reliable way to run JS... at a precise future moment when the app isn't running") the same way: foreground-triggered coverage now, native extension deferred.

**Resolution**: applied the exact precedent the Phase 8 entry already set, rather than re-deciding it — foreground checks (on app open/resume and on Journey Detail focus) cover real usage (a commuter opens the app before leaving, which is when this matters most), while the unattended 3h/30min-before-departure case for a Journey the user never reopens is not covered without the native extension. `runCalibrationDecayIfDue()` and `checkForecastDrift()` are both written as plain exported functions specifically so a future `§12.2` dev-menu screen (itself not yet built — no dev menu exists anywhere in the app through Phase 10) can call them directly once it exists, rather than needing rework then. Revisit alongside whichever future phase adds `expo-dev-client` for the widget/leave-by gaps, since all three would share the same native background-task investment.

---

## 2026-07-21 — Phase 11 (Polish): the full §9.1 dark/light theme retrofit was built now, not deferred further; gear-card fallback text stays non-interactive (no "tap to add" wiring); rain-intensity gauge (§9.5) not built

**What**: Three related but separate calls made while working through Phase 11's design-system bullet (`docs/08-build-phases.md` phase 11, "map marker styling for weather badges... §9.1"):

1. Built out the theme system §9.1 actually describes — `src/theme/{tokens,useThemeStore,useTheme}.ts` plus a repo-wide retrofit of every screen/component's hardcoded hex colors to read `useTheme()`/`getStyles(theme)` — rather than treating Phase 11 as only the map-marker/annotation-pin styling its build-phase bullet names explicitly. `SettingsScreen.tsx` had an inline comment from Phase 5 stating plainly that "full app-wide re-theming... is Phase 11 Polish," so this wasn't a scope expansion, it was picking up a deferral this codebase had already flagged for itself.
2. Left `GearRecommendationCard.tsx`'s fallback text (e.g. "No suitable umbrella owned or available — consider a wind-rated one") as plain, non-interactive `Text`. §9.6 says gear-card fallback text "should read as an action... matching the empty-state CTA pattern" ("No shoes yet — add your first pair," which *is* a tappable `Pressable` on the Gear list screens). Read literally, this implies each fallback slot (layers/accessories/bottoms/shoes/umbrella) should be tappable and navigate to the relevant Gear add form.
3. Did not build the rain-intensity droplet gauge from §9.5 ("used in the hourly strip on Plan/Today") — it doesn't exist anywhere in the app; there's no hourly forecast strip on either screen to attach it to in the first place.

**Why these needed a decision**: (1) is a scope call, not a compliance gap, so it's logged for visibility rather than as a deviation. (2) and (3) are both real, spec-stated pieces of UI that are genuinely missing, surfaced while doing the §9.6 accessibility pass this same phase — worth being explicit that they were seen and left, not missed. Wiring (2) properly means `GearRecommendationCard` (currently a pure presentational component fed a computed `Recommendation`/`RecommendationSnapshot`, reused identically by the live Journey Detail view and History's frozen read-only view) taking an optional navigation callback per slot, routing to five different Gear add forms (jacket/midlayer/base, umbrella, shoes, bottoms, accessories) — a real feature addition, not an accessibility-label fix, and one that has to make a call about what "tap to add" even means from History's frozen, read-only context. (3) needs an hourly-forecast data source and UI (an "hourly strip") that Plan/Today don't currently have at all — building the droplet visual without that surrounding strip would be a decoration with nothing to attach to.

**Resolution**: (1) shipped in full this phase. (2) and (3) deferred — logged here rather than silently left as an unstated gap now that they've been specifically noticed during the accessibility pass. `GearRecommendationCard`'s existing fallback copy (already specific per-item guidance, e.g. naming the umbrella wind-rating shortfall) still reads reasonably as information even without being tappable, so this isn't a broken experience today, just short of the letter of §9.6's "double tap to add one" example. Revisit (2) as its own scoped pass — deciding History's read-only case first — and (3) alongside whichever future phase adds an hourly forecast strip to Plan/Today (not currently on any phase's list through Phase 12).

**Update, same day**: both (2) and (3) were picked up as follow-on scoped passes shortly after this entry, superseding the "deferred" resolution above for those two items — see the two entries immediately below.

---

## 2026-07-21 — §9.5 rain-intensity gauge: built as a Plan-screen-only hourly strip, not Plan+Today

**What**: Added `src/components/RainGauge.tsx` (the droplet-fill SVG, `react-native-svg` `ClipPath`, buckets none/low/med/high per `docs/06-weather-classification.md` §6's exact thresholds — probability < 20% → `none`, then precip < 0.5mm → `low`, ≤ 4mm → `med`, else `high`) and `src/components/HourlyStrip.tsx` (a horizontal `ScrollView` of gauges), wired into `PlanScreen.tsx` directly under the date/time fields, reading the selected origin + selected departure time. Not added to Today's "Right now" card.

**Why this needed a decision**: §9.5 says the gauge is "used in the hourly strip on Plan/Today," naming both screens, but doesn't specify whether that means one shared strip surfaced in two places, two independent strips, or just imprecise wording. Today's "Right now" card has its own explicit spec (§9.3.1: "no map, no leg list, no journey label, just current conditions... and the reduced recommendation" — a deliberately minimal single-point snapshot), which an hourly forward-looking row doesn't fit conceptually; Plan, by contrast, is exactly where knowing "does it rain in the next few hours" changes what the user actually does (pick a different departure time, grab an umbrella before leaving). Building both would mean either duplicating the fetch/render logic or over-engineering a shared abstraction for a second placement whose spec grounding is genuinely ambiguous.

**Resolution**: shipped as a `HourlyStrip` used once, on Plan, anchored to the currently-selected origin and departure time (omitted entirely — not a placeholder — when no origin is chosen yet or the typed date/time is invalid, same "don't render a placeholder" pattern used throughout this app). `src/services/weatherService.ts` gained `getHourlyForecast()`, a single-location sibling to the existing per-leg `getForecast()`, since Open-Meteo's response already includes the full hourly array — `getForecast()` was just discarding all but the nearest reading per point, so no new request shape was needed, only a new extraction path (`fetchOpenMeteoHourly()` factored out and shared between the two). Revisit adding a second strip to Today's card if a future pass decides §9.3.1's "just current conditions" framing should change — that's a scope call for whoever touches Today next, not implied by this entry.

---

## 2026-07-21 — Gear-card fallback text wired to "tap to add" (§9.6), scoped to the live recommendation only

**What**: `GearRecommendationCard.tsx`'s fallback slots (layers/accessories/bottoms/shoes/umbrella) now navigate to the matching Gear add form when tapped — `src/navigation/types.ts` gained a `GearAddTarget` param threaded through `MainTabParamList.Gear` → `GearScreen` → `ClothingList`/`ShoeList`/`UmbrellaList` → `ClothingForm`'s new `initialType` prop, triggered from `JourneyDetailScreen.tsx`'s live `recommendation` render path only.

**Why this needed a decision**: the entry above already laid out the two open questions — how "tap to add" should behave in History's frozen `snapshot` view, and whether it's worth the cross-screen navigation wiring at all. Resolved: `snapshot` mode stays non-interactive, since a past journey's frozen recommendation has nothing meaningful to "add" retroactively — `RecommendationSnapshot` doesn't even carry the `layerType`/slot-kind information needed to build a target. The live `recommendation` path does carry that information (`LayerPick`'s fallback shape already includes `layerType: ClothingType`), so wiring it there is a direct, non-speculative implementation of §9.6's literal example ("No umbrella owned — double tap to add one").

**Resolution**: implemented via `FallbackText`, a small module-level component (not nested in the card's render body, to avoid recreating it every render) that renders a plain `Text` when no `onAddGear` callback is supplied (the `snapshot` path never passes one) and a `Pressable` with an action-phrased `accessibilityLabel` when it is. `GearScreen`'s auto-open-add-form logic uses React's render-time "adjusting state when a prop changes" pattern rather than `useEffect` + `setState`, since this codebase's ESLint config enforces the `react-hooks/set-state-in-effect` rule (React 19) — the same pattern already established for `ClothingList`/`ShoeList`/`UmbrellaList`'s own auto-open props.

---

## 2026-07-21 — Phase 12: SQLite left unencrypted at rest; disclosed in the privacy policy instead of adding SQLCipher

**What**: `expo-sqlite`'s database file stays plain (no SQLCipher config plugin added), per §10.2's own explicit escape hatch ("enable SQLCipher if the agent wants encryption-at-rest; otherwise explicitly note in the privacy policy that data is stored unencrypted on-device").

**Why this needed a decision**: SQLCipher for `expo-sqlite` requires a config plugin that changes the native build (a `expo prebuild`/custom dev client dependency), which is the same category of native-complexity gap already logged repeatedly in this file (background tasks for §7.3/§7.4/§5.2) — it can't be verified against a real native build in this environment, and this app's managed-workflow precedent throughout has been to avoid native config-plugin additions that can't be smoke-tested here.

**Resolution**: took the spec's own named alternative — data stays unencrypted on-device, and `PRIVACY_POLICY.md` (added this phase, at repo root alongside `DECISIONS.md` rather than under `docs/`, which is reserved for the numbered build-spec files per `AGENTS.md`'s file index) states this plainly under "where it's stored." The data itself (home/work addresses, gear inventory) is personal but not high-sensitivity (no payment info, no third-party accounts), consistent with §10.2's own framing ("isn't especially sensitive, but... personal"). Revisit if a future phase already requires a custom dev client for another reason (e.g. the widget/background-task work flagged elsewhere in this file), since SQLCipher would then be a much smaller incremental addition to a build that already needs prebuild.

---

## 2026-07-21 — Phase 12: crash reporting wired as a real conditional gate with a local no-op provider, not a live Sentry SDK install

**What**: `src/lib/crashReporting.ts` exports `initCrashReportingIfEnabled()`, called once from `App.tsx` on startup and again from `SettingsScreen`'s toggle handler, reading the existing `crash_reporting_enabled` setting (already persisted since Phase 2's onboarding step). It calls through a small `CrashReportingProvider` interface (`init`, `captureException`, `close`) rather than importing `@sentry/react-native` directly.

**Why this needed a decision**: `docs/01-tech-stack.md` names "Sentry's Expo SDK (or equivalent)" and §10.5 describes gating `Sentry.init()` behind the stored preference. Installing the real native Sentry SDK needs a DSN from a real Sentry project this session has no account for, and — same reasoning as the SQLCipher entry just above — a native module addition that can't be exercised against a real native build (or even confirmed to bundle cleanly for the `expo start --web` smoke check this project relies on) in this environment. Shipping `Sentry.init(undefined)` or a hardcoded placeholder DSN would be worse than not wiring it: it would silently fail or, worse, actually transmit to whatever project a placeholder DSN happened to resolve to.

**Resolution**: built the real conditional-gating logic and scrub step (§10.5's location/label-scrubbing requirement) against a `CrashReportingProvider` interface, with a `NoopCrashReportingProvider` as the only implementation wired in for now — so the on/off preference, the "never initializes when off" guarantee, and the "no telemetry connection at all while opted out" property are all real and testable today. Swapping in `@sentry/react-native` later is a one-file change (`src/lib/crashReporting.ts`'s provider selection) once a real DSN exists, not a redesign. Explicitly not the same as "crash reporting isn't built" — the toggle, the init/no-init behavior, and the scrubbing are all implemented and unit-tested; only the actual telemetry transport is deferred pending a real vendor account.

---

## 2026-07-21 — Phase 12: bundle identifier is a placeholder; `PrivacyInfo.xcprivacy` is a best-effort draft, not Apple-verified; Google Cloud/App Store Connect/Play Console steps left as an explicit manual checklist

**What**: `app.json` sets `ios.bundleIdentifier`/`android.package` to `nz.co.commuteweatherplanner.app` — an invented reverse-DNS identifier, since no real organization/developer account identifier was specified anywhere in this project. `ios.privacyManifests` is filled in with a reasonable declaration (no tracking, precise-location collected for app functionality, not linked to identity) but does not attempt to declare Apple's "required reason API" entries (`NSPrivacyAccessedAPITypes`) for the specific system APIs `expo-sqlite`/`expo-file-system`/their transitive dependencies actually touch. `PRODUCTION_CHECKLIST.md` (added this phase) explicitly separates what's done in-code from what needs a real Google Cloud Console / App Store Connect / Google Play Console login to complete (key restrictions, budget alerts, hosting+linking the privacy policy URL, actually submitting a build).

**Why this needed a decision**: bundle/package identifiers can't be changed after a store listing is created against them, so inventing one is a real, consequential placeholder, not a cosmetic default — flagging it explicitly (rather than silently picking something and moving on) means whoever actually submits notices it before it's locked in. The `NSPrivacyAccessedAPITypes` declarations specifically require knowing the exact "required reason" API categories the final compiled binary touches, which in practice Apple determines from the actual linked frameworks — guessing at this without a real Xcode archive to check against risks writing a plausible-looking but wrong manifest, which is worse than clearly marking it unverified. Similarly, key restriction (needs a release keystore's SHA-1, which only exists after a real EAS build), budget alerts, and privacy-policy hosting are all actions inside third-party consoles this session has no credentials for and, more fundamentally, aren't code — no amount of repo work substitutes for someone with account access clicking through Google Cloud Console.

**Resolution**: shipped everything that's actually expressible as repo config (eas.json build profiles, app.json's bundle IDs/permissions/privacy manifest skeleton/icon, PRIVACY_POLICY.md content, STORE_LISTING.md draft copy, the crash-reporting gate, the export/import flow) as real and complete, and used `PRODUCTION_CHECKLIST.md` to make the remaining external-dashboard steps an explicit, itemized handoff rather than an implied "done" or a silently missing gap. Revisit the bundle identifier specifically before any real submission, since changing it later means a new store listing, not an edit.

---

## 2026-07-21 — "Paua Pop" visual identity redesign: full palette overhaul, requested and approved through a multi-round design review before any code changed

**What**: `src/theme/tokens.ts`'s `darkTheme`/`lightTheme` are rewritten from the original muted amber/teal/lavender scheme to "Paua Pop" — pōhutukawa pink, pāua teal/violet, kōwhai gold — and the app icon is replaced with an NZ-outdoors bucket hat illustration. This is a deliberate, requested visual identity change, not a bug fix or scope interpretation — logged here per this file's own header ("one entry per deliberate deviation... within the docs"), since it reverses specific named color values and an icon concept that were themselves spec'd in `docs/09-design-system.md` and `docs/10-production-readiness.md`.

**Why this needed a decision**: the original palette and umbrella/jacket icon concept were both explicit, considered spec content (§9.1's table, §10.4's icon-concept paragraph), not placeholders — replacing them is a real spec change, and the docs needed to change with the code rather than drifting out of sync with what's actually in `tokens.ts`.

**Resolution**: before touching any code, the new direction went through six rounds of visual review as published design pitches (palette + logo mark shown side by side, then full app-screen mockups, then live user feedback on the hat's shape/style across several iterations, then a "calm the UI down" pass, then a weather-reactive-tint concept, then the user's own reference artwork for the final mark) — each round's output was screenshotted and checked before presenting it, and the user picked/refined the direction explicitly at each step rather than this being an unreviewed unilateral change. Only once a specific final direction was approved ("time to update the files!") did `tokens.ts`, the icon assets, and `docs/09-design-system.md` actually change. `docs/09-design-system.md` §9.0/§9.1/§9.1.3 and `docs/10-production-readiness.md`'s icon-concept paragraph were updated in the same pass as the code, not left to drift.

---

## 2026-07-21 — §9.0's "no drop shadows" rule reversed to shadow-based card elevation, per explicit request

**What**: `cardElevationStyle()` (`src/theme/tokens.ts`) replaces the border used on `RightNowCard`, `JourneyCard`, and `GearRecommendationCard` with a shadow (`shadowColor`/`shadowOffset`/`shadowOpacity`/`shadowRadius`, plus `elevation` for Android). §9.0's original text stated plainly: "Flat fills, no gradients or drop shadows."

**Why this needed a decision**: this is a literal, named reversal of an existing utilitarian-side principle, not a new component pattern layered alongside it — worth flagging explicitly rather than quietly overwriting the rule's own stated reasoning (glanceability/information density first).

**Resolution**: implemented exactly as asked ("instead of borders around content box components, just make the boxes stand out a little with shadows") — one shared `cardElevationStyle()` helper so every card gets identical elevation rather than each screen inventing its own shadow values, tuned separately per theme (`shadowOpacity: 0.35` dark / `0.1` light, since a light-mode shadow needs far less opacity to read as "lifted" rather than "smudged"). §9.0's text was updated to describe the new rule rather than left contradicting the code. The light theme's `surfaceRaised` still keeps its `border`-colored 1px outline on top of the shadow — that one wasn't about "no shadows," it's the pre-existing "white-on-off-white needs a seam" fix, which the shadow alone doesn't fully solve at every brightness/OS shadow-rendering combination.

---

## 2026-07-21 — Weather-reactive Today-tab tint scoped to the Today tab only, not Journey Detail

**What**: `useWeatherTheme()` (`src/theme/useWeatherTheme.ts`) — the mood-based tint (§9.1.3) — is wired into `TodayScreen`/`RightNowCard`/`JourneyCard` only. Journey Detail's map/leg list/`GearRecommendationCard` still read the plain `useTheme()` base palette regardless of that journey's own weather.

**Why this needed a decision**: the underlying idea ("the colours of the screen... reflect the weather/temperature of the journey") generalizes naturally to any screen showing weather-linked content, and Journey Detail is the screen with the most per-leg weather detail already on it — leaving it out could read as an oversight rather than a choice.

**Resolution**: scoped narrowly to what was actually designed and approved across the pitch rounds — every mockup shown was the Today tab specifically, using the *current* conditions (the "Right now" card's own weather reading) to set one mood for the whole screen. Journey Detail has a materially different shape of problem: a journey can span legs at very different temperatures (a cold morning walk into a warm afternoon return), so "which leg's mood wins" needs its own design decision (most naturally the current/nearest-upcoming leg, mirroring how the "Right now" card already prioritizes current conditions) that was never actually put in front of the user for approval. Revisit as a follow-on scoped pass rather than guessing at that answer now — `useWeatherTheme()` already accepts any single `WeatherSnapshot`, so wiring it into Journey Detail later needs no rework of the hook itself, just a decision about which leg's snapshot to pass it.

---

## 2026-07-21 — App icon traced from a user-supplied SVG rather than drawn from scratch

**What**: `assets/icon.png`, `android-icon-foreground/background/monochrome.png`, and `favicon.png` are generated from an SVG the user pasted directly into the conversation (after two earlier from-scratch attempts — a smooth-curve line icon and a straight-line/faceted rebuild — were both explicitly rejected as not matching the intended hat shape). The illustration's exact paths/fills/highlight details are reproduced unmodified; only the crop (tightened to the hat's bounding box), background (composited onto the app's own `bg` token instead of the source file's cream background), and a separate outline-only render (for `android-icon-monochrome.png`, Android 13+'s single-color themed-icon layer) were added.

**Why this needed a decision**: this is the app's primary brand mark generated from a third party's (the app owner's) supplied artwork rather than built from the spec's own icon-concept paragraph — worth recording that the source is external-supplied, not authored for this project from the §10.4 concept, in case the artwork's provenance/license ever needs checking before a real store submission.

**Resolution**: reproduced the supplied illustration exactly rather than "improving" or restyling it further, per the explicit instruction ("just try copy this attached image exactly") that followed two rejected from-scratch attempts. Flagged one real limitation rather than shipping it silently, before it was implemented: at very small render sizes (roughly under 30-40px — the range iOS uses for Settings/Spotlight-sized icon variants, well below the 1024px master or even the 48px favicon), this illustration's fold-line/highlight detail starts to blur into an unclear blob rather than a crisp glyph. It reads clearly from the favicon size (48px) up, which covers every place this repo actually renders it (`icon.png`, the Android adaptive-icon layers, `favicon.png`) — the small-OS-chrome case is a real but currently theoretical limitation worth knowing about before a real store submission, not something this pass needed to solve, since nothing in the app currently renders the mark smaller than that.

---

## 2026-07-21 — Onboarding collapsed to a single "where are you?" step; Home/Work, gear basics, and notification permission moved to a postponable setup checklist on Today

**What**: replaced the original 6-screen onboarding wizard (location-permission priming → Home/Work → live demo card → gear basics with self-report warmth → crash-reporting opt-in → notification permission) with one screen, `Step1Location.tsx` — use current location, type an address (real Google Places autocomplete, not the old lat/lng text fields), or skip outright. Finishing it (any path) drops the user straight onto Today. The gear-basics and notification-permission screens keep their exact original implementation but move to `src/screens/setup/` as standalone stack screens (`SetupGearBasics`, `SetupNotifications`) reached from a new dismissible `SetupChecklist` on the Today tab, not forced in sequence. The crash-reporting step is dropped entirely — it already defaulted off and was already changeable in Settings, so forcing it in onboarding added friction without adding a real choice. `LocationForm.tsx` (the full Locations CRUD add/edit form, previously plain lat/lng text fields per the 2026-07-20 "Locations CRUD uses text/number fields" entry) also gained the same real Places autocomplete, with lat/lng demoted to a collapsed "Advanced" section — closing that entry's deferral now that a `placesService.ts` exists to close it with.

**Why this needed a decision**: this is a direct, requested reversal of Section 4.1's explicit "5-step onboarding stack" (itself already amended once by this file's "Onboarding gate" entry) and Section 4's "Locations" bullet's plain-text-field precedent — not a bug fix or an ambiguous-wording judgment call. The request was explicit: demote lat/lng to a power-user setting, add real address autocomplete, let a user reach a working "simple weather app" experience with only a general location, and replace the rest of forced onboarding with postponable, resumable hints.

**Resolution**: built `placesService.ts` (Google Places API (New) autocomplete + place details, reusing `EXPO_PUBLIC_GOOGLE_ROUTES_API_KEY` rather than a second env var — see docs/02-external-apis.md) and a shared `AddressAutocomplete` component, used by both the new onboarding step and `LocationForm.tsx`. The captured onboarding location is stored as a new lightweight `app_settings.default_location` (lat/lng/label), deliberately *not* a `SavedLocation` — it's a fallback centre-point for `useRightNow()`'s "Right now" card (inserted into its existing device-GPS → Auckland fallback chain, now three-deep), not a place worth offering in Plan's origin/destination pickers. `SetupChecklist.tsx` computes each hint's done-state live from real data (any `SavedLocation`/`Journey`/inventory row; actual OS notification-permission status) rather than a stored flag, so it self-heals if the user adds things outside the checklist and never needs a second source of truth to stay in sync — "Not now" dismissals are the one thing that does need persisting (`dismissed_setup_tasks`, reset via a new Settings row), since indefinite postponement has no data-driven "done" state of its own. `docs/04-screens-navigation.md` §4.1 and `docs/02-external-apis.md`'s API table were updated in the same pass; `docs/03-data-models.md` was not touched, since `app_settings` is already documented there as a generic key/value table, not enumerated key-by-key.

**Left open**: Plan screen's origin/destination pickers still only search saved locations (`SavedLocationPicker.tsx`) — the free-text Google Places search Section 4's "Plan" bullet describes was never built (logged in the 2026-07-20 "Locations CRUD" entry as deferred to "Phase 4," but Phase 4 shipped without it). `placesService.ts`/`AddressAutocomplete` now exist and could close that gap directly, but wiring waypoints/origin/destination through free-text search is a separate, scoped UI change this pass didn't attempt — revisit as its own follow-on rather than folding it in here.

**Closed later the same day** — see the entry below.

---

## 2026-07-21 — AddressAutocomplete error visibility + race guard; map pin-drop closes the last "Locations CRUD" deferral

**What**: two follow-ups to the onboarding rework above, done in the same session once real usage surfaced a couple of gaps. First, `AddressAutocomplete.tsx` now (a) shows a distinct message when a search genuinely fails — network down, rate-limited, or Places unreachable — instead of looking identical to "no results found," and (b) tracks a per-search request id so a slow, stale response can't overwrite a faster, more recent one's results if the user types quickly. Second, a new `LocationPickerMap` component (native `react-native-maps` + a `LocationPickerMap.web.tsx` placeholder, same platform-split pattern `JourneyMap.tsx`/`JourneyMap.web.tsx` already established for the web dev-preview gap) lets a user tap-or-drag a pin instead of typing an address or raw coordinates, wired into both `LocationForm.tsx` and onboarding's `Step1Location.tsx` alongside the existing GPS/typed-address/skip paths. Confirming a pin calls a new `placesService.reverseGeocode()` (Google Geocoding API, same shared key) to fill in a human-readable address automatically.

**Why this needed a decision**: the map picker specifically closes the second half of the 2026-07-20 "Locations CRUD uses text/number fields, not map pin-drop or Places search" entry — that entry deferred map pin-drop because `react-native-maps` had no web target and no established workaround existed yet at Phase 2. Phase 3 (`JourneyMap.tsx`) later solved exactly that problem with a `.web.tsx` platform-split file, but nobody went back to retrofit `LocationForm.tsx` with it once it existed — this pass does, on the reasoning that a marker on a map is a friendlier way for a regular (non-technical) user to say "here" than typing decimal coordinates, which was the original spec's own framing for why map pin-drop was wanted in the first place (Section 4, "Locations" bullet).

**Resolution**: `LocationPickerMap` is a self-contained `Modal` (matching `SavedLocationPicker.tsx`'s existing self-contained-modal convention) rather than a bare map view the caller wraps — callers just pass `visible`/`initialCoords`/`onConfirm`/`onClose`. The web fallback (at the time this entry was written) was close-only, no map to drop a pin on — **superseded 2026-07-22, see the entry below: web now has a real map too.** Reverse geocoding failure is non-fatal — the pin's coordinates are still set and usable even if no address comes back, matching the same "coordinates are the source of truth, the label is best-effort" posture the rest of this form already had.

---

## 2026-07-21 — Closed three more long-standing gaps: Plan-screen free-text search, recurring-journey pause, and the §12.2 debug menu

**What**: asked "did we defer anything else?" after the entries above, then asked to close what's actually closeable without external/manual access (no GCP console, no real device build, no App Store history). Three real, code-only gaps got fixed in one pass:

1. **`SavedLocationPicker.tsx`** (the origin/destination/waypoint picker used throughout Plan) now embeds `AddressAutocomplete` — typed text filters the existing favorites-first saved-location list client-side *and* searches Google Places live, matching Section 4's "autocomplete against saved locations first... then free text via Google Places" exactly. A selected Places result becomes an ephemeral `SavedLocation`-shaped object (`id: newId()`, never persisted) rather than a real row — the same synthetic-location pattern `useRightNow.ts`'s "Current location" journey already established, so `planJourney.ts`'s `SavedLocation`-typed pipeline needed zero changes to accept it. This closes the "Left open" note two entries above.
2. **Journey Detail** now shows a "Repeats Mon, Wed, Fri — Pause/Resume" row for any journey that's part of a recurring series (the journey itself if it holds the `RecurrenceRule`, or its template fetched via `templateId` otherwise), toggling `RecurrenceRule.active` and cancelling that instance's scheduled leave-by notification when paused. `materializeTodaysJourneys()` already correctly skipped inactive templates and was already unit-tested for it (Phase 8) — the Phase 8 DECISIONS.md entry's own words were "no UI trigger to attach a cancellation call to," and this is that trigger, nothing more (still not a full recurring-journey *editing* screen, which that same entry ruled out of scope).
3. **The §12.2 debug/dev menu** — force any of the three `src/services/` modules to return a chosen error (exercising §5.1's offline fallback without a real outage), simulate an AT GTFS Realtime delay, manually run §5.2's forecast-drift check against any upcoming journey, and reset onboarding/theme/crash-reporting/default-location state to retest first-run flows without reinstalling. New `src/lib/devOverrides.ts`, one `if (__DEV__) {...}` check added at each service's single existing seam (§12.1's own stated design goal — "exactly one seam per API to intercept").

**Why these needed a decision**: none were bugs — each was a previously-logged, real gap (two explicitly named "Left open"/"no UI trigger" in earlier entries, one an entire unbuilt spec section) rather than something newly discovered. Closing them is a direct judgment call about scope, not a fix.

**Resolution / left open**:
- (1) and (2) are complete as scoped. (1)'s one honest limitation: a never-saved Places result has no stable id, so §5.1's 30-day cached-route-reuse fallback (keyed on `origin.id`/`destination.id`) can never match it — acceptable, since there's no identity to match against, not a bug.
- (3) is **not** fully built: §12.2 point 3, "fast-forward the current date used by recurrence materialization and History's date filter," was deliberately skipped. Every other point is a self-contained toggle read at one seam; this one needs every `new Date()` call site currently standing in for "now" (`materializeToday.ts`, `HistoryScreen`, `TodayScreen`, `leaveBy.ts`, and others) rewritten to read through one shared, overridable clock instead — a real cross-file refactor with real regression risk (a missed call site silently keeps reading the real clock and produces confusing, inconsistent dev-menu behavior), not proportionate to bundle in alongside four independent, low-risk toggles. Also chose a `__DEV__`-gated, visible "Debug menu" row in Settings over §12.2's "shake-to-open" suggestion — the spec offers shake-to-open and long-press as equally-valid examples ("common, low-effort entry points"), and a tappable row is easier to actually use while developing with no production-exposure difference, since `__DEV__` compiles to a literal `false` (and is dead-code-eliminated) in release builds either way.
- Still open after this pass, unchanged from the earlier "did we defer anything else" answer: the OS-scheduled background-task versions of forecast drift / leave-by freeze / the home screen widget (native `expo-dev-client` extension needed, ruled out of scope for this stack), the real Sentry telemetry transport (needs a real vendor account), and the manual/external `PRODUCTION_CHECKLIST.md` items (GCP console access, a real device/Xcode build, real prior-release artifacts to diff against) — none of these are closeable from inside this session regardless of effort.

---

## 2026-07-22 — Real web map picker (react-leaflet + OpenStreetMap); real navigation iconography

**What**: two requested polish passes on top of everything above. First, `LocationPickerMap.web.tsx` — previously a "map picker unavailable on web, use address search or Advanced coordinates" placeholder (2026-07-21 entry above) — is now a real, independently-implemented map: `react-leaflet` + OpenStreetMap tiles, click-or-drag a custom pin (inline SVG, no external marker-image assets), same header/hint/confirm layout as the native version. Second, `MainTabs.tsx`'s bottom-tab icons and Today/Locations header buttons (previously React Navigation's unstyled default tab icon and plain `<Text>Settings</Text>`/`<Text>History</Text>` buttons — that file's own comment had flagged this as a stand-in since Phase 1) now use a real 7-glyph icon set (`NavIcon.tsx`, same stroke-only/24×24-viewBox convention `ClothingTypeIcon.tsx` established), with tab-bar tint/background wired to theme tokens via `screenOptions`.

**Why these needed a decision**: web-map-picker's approach (Leaflet+OSM vs. Google Maps JavaScript API) and the "Settings gets a sliders icon, not a cog" call (Section 9.2.1 above) are both judgment calls with real alternatives, not mechanical fixes.

**Resolution**:
- **Map provider**: chose `react-leaflet` + OpenStreetMap tiles over adding Google Maps JavaScript API as a fourth Google Maps Platform product. Both are viable, but OSM tiles are free/keyless with no budget-alert exposure (docs/02-external-apis.md §2's existing billing-safety-net concern for the Google key), and this project has already shown a preference for free/keyless options where one exists (Open-Meteo over a paid weather API). `react-native-maps` genuinely has no web target at all — this is a real, separate implementation for web, not a shim.
- **CSS delivery**: Leaflet's stylesheet is required for the map to render correctly at all (tile positioning, marker anchoring, control layout) — vendored verbatim into `leafletCss.ts` and injected as an inline `<style>` tag at runtime, rather than `import "leaflet/dist/leaflet.css"` (no established precedent in this project for Metro bundling raw CSS imports — the existing `metro.config.js` precedent, `assetExts.push("wasm")`, solves a different problem and wasn't confirmed to extend cleanly to CSS-as-asset without a real production web build to verify against) or a CDN `<link>` (an unnecessary runtime dependency for something that should otherwise work fully offline once bundled). Verified interactively via Playwright: zoom controls, the custom marker, click-to-move, drag-to-move, and the confirm→reverse-geocode→finish-onboarding flow all work end-to-end; only the OSM tile imagery itself didn't load in the sandboxed dev environment used to verify this (outbound network to `tile.openstreetmap.org` blocked there, same class of restriction as this same sandbox's Open-Meteo calls) — a real deployed build has normal internet access and wasn't expected to hit this.
- **Icon set**: 7 glyphs (today/plan/locations/gear/settings/history/localKnowledge) previewed in isolation (a standalone HTML/SVG page, screenshotted) before wiring into the real app, given hand-authored SVG path coordinates are genuinely risky to get right blind — same lesson as this session's earlier bucket-hat-icon rounds, applied proactively this time instead of after a rejected attempt. Settings uses a sliders/equalizer glyph rather than a literal gear-cog specifically to avoid reading as a second reference to the "Gear" (clothing) tab — the two features share an unfortunate English-language collision ("gear" the settings metaphor vs. "Gear" the clothing inventory) that a literal cog icon would have made worse, not better. Locations' tab icon and Local knowledge's header icon intentionally share the same pin silhouette (Local knowledge's has an added sparkle badge) for visual continuity with `LocationPickerMap`'s own dropped-pin marker, rather than three unrelated pin designs across the app.

---

## 2026-07-22 — Gear icon redrawn from a traced reference SVG; screen-edge whitespace increased 16px → 20px

**What**: two more corrections on the same nav-polish thread. First, the "gear" (hanger) icon above — a hand-drawn hook — went through two more rejected freehand attempts (a curl, then a circle-loop) before the user supplied a reference SVG directly and said to stop guessing coordinates and use it verbatim. `NavIcon.tsx`'s `kind === "gear"` branch now renders that reference path (own viewBox, filled, only the color changed) instead of hand-drawn stroke primitives — the one filled glyph in an otherwise stroke-only set. Second, "buttons and borders are too close to edges": every screen/list/form's screen-edge padding or margin (previously a hardcoded `16` in ~20 separate `StyleSheet.create` calls, no shared constant existed) is now `20`; `MainTabs.tsx`'s bottom tab bar gained explicit `paddingTop`/`paddingBottom: 8`, and the header icon-button row's `gap` went `4`→`8` with a small trailing margin.

**Why this needed a decision**: (1) is a direct instruction to stop iterating and use the supplied asset as-is — not a judgment call, but worth logging *why* the two prior attempts failed (both were reasonable-looking in isolated preview screenshots but still read as "wrong" once the user compared them to a real hanger — hand-tracing a recognizable object from memory is fundamentally riskier than it looks, even with a preview step, when the reference itself was never actually consulted). (2) is a judgment call about scope: which `16`s are "screen-edge distance" (bump) versus "card-internal padding" (leave alone, per docs/09-design-system.md §9.2's own distinction between the two).

**Resolution**: screen-edge padding/margin values were bumped one full step on the existing 4px spacing grid (16→20, `4*5`) everywhere they represent distance from a screen/card/form to the *screen* edge — every `Tab`/`Stack` screen's outer container or list `contentContainerStyle`, `JourneyDetailScreen.tsx`'s several per-section `paddingHorizontal`/`margin` values (it has no single wrapping container), `GearRecommendationCard.tsx`'s card `margin` (not its `padding`), and both `LocationPickerMap` header rows. Left untouched: card-*internal* padding (`RightNowCard` 16px, matching §9.2's card-padding spec; `JourneyCard`/list-row "cards" already at 12px — a pre-existing, unrelated inconsistency not part of this complaint) and `Step1Location.tsx`'s `24px` (already more generous than the old 16px default, correctly proportioned for a single centered onboarding screen, not a list/form). `docs/09-design-system.md` §9.2 updated to `20px` to match. `GearScreen.tsx`'s internal Vehicles/Clothing/Shoes/Umbrellas sub-tab strip was deliberately left flush-edge — that's a full-bleed segmented control (each button already centers its own label within an equal `flex: 1` share), a different, intentional pattern from a screen/card margin, not an oversight.

---

## 2026-07-22 — Corrected the whitespace pass: header buttons need text, not just icons; fixed real button-padding and tab-bar-label bugs the screen-edge bump didn't touch

**What**: the screen-edge whitespace bump above solved the wrong-shaped problem in three specific ways the user then corrected:

1. **Header buttons went icon-only in the same pass** (see the iconography entry above) — the user wants text labels there, not just icons. `TodayHeaderButtons`/`LocalKnowledgeButton` (`MainTabs.tsx`) now render `<Text>Settings</Text>`/`<Text>History</Text>`/`<Text>Local knowledge</Text>` again, with proper `paddingHorizontal` this time (the pre-icon version had none).
2. **A real, separate bug**: the bottom tab bar's labels were being clipped — not just the "Today" label's descender, but (once actually measured) nearly the whole label down to a 7px-tall sliver. Root cause, confirmed via computed styles in a headless-browser inspection: React Navigation's default web tab-bar label wrapper renders with a fixed `height: 7px; overflow: hidden` that `tabBarLabelStyle`'s `fontSize`/`lineHeight` do not control on this platform — this session's earlier `paddingTop`/`paddingBottom`/`height` additions to `tabBarStyle` never had a chance to fix it, since the constraint lives on the inner label element, not the bar. Fixed by bypassing React Navigation's built-in label rendering entirely — each `Tab.Screen` now supplies its own `tabBarLabel` render function (a small `TabLabel` component with an explicit `lineHeight: 14`) instead of relying on `options.title` + `tabBarLabelStyle`.
3. **The actual "buttons too close to edges" example** the user meant all along: the empty-state "+ Add clothing" (and four siblings — Locations, Vehicles, Shoes, Umbrellas) CTA button had `paddingVertical` but no `paddingHorizontal` at all. It went unnoticed in the screen-edge pass because it only manifests visually inside an `alignItems: "center"` empty-state wrapper, where the button hugs its own text width instead of stretching — with zero horizontal padding, the border sits flush against the text. The screen-container padding bump was a real, separate improvement, but it didn't touch this — button-internal padding and screen-edge margin are two different things.

**Why this needed a decision**: (1) and (3) are direct corrections, not judgment calls. (2) is logged because it's a genuine platform bug independent of anything in scope for a "polish" pass, worth a permanent fix and record so a future pass doesn't reintroduce it by going back to `options.title`/`tabBarLabelStyle`.

**Resolution**: `addButton` in `LocationsScreen.tsx`, `ClothingList.tsx`, `ShoeList.tsx`, `UmbrellaList.tsx`, and `VehicleList.tsx` all gained `paddingHorizontal: 20`, matching the screen-edge unit. Verified all three fixes with the same headless-browser screenshot method used throughout this session — the tab bar labels render fully now (confirmed via `getComputedStyle` before/after, not just a visual glance, given how easy this specific bug was to miss by eye at a quick screenshot size), header buttons show real words, and the Gear tab's "+ Add clothing" button now has visible padding on all sides.

---

## 2026-07-22 — Header buttons back to icons, and Settings gets an actual cog

**What**: one more reversal in the same header-button thread — the text-label correction above got overridden again: icons for the header buttons after all, and specifically a real cog/gear-wheel glyph for Settings instead of the sliders icon this session chose earlier (see the nav-iconography entry above, "Settings uses a sliders/equalizer glyph rather than a literal gear-cog specifically to avoid reading as a second reference to the 'Gear' tab"). `TodayHeaderButtons`/`LocalKnowledgeButton` render `NavIcon` again; `NavIcon.tsx`'s `"settings"` case is now two concentric circles + 8 short radial ticks (a standard cog silhouette — center hole, ring, teeth), previewed in isolation against three candidate tooth styles/counts before wiring in, same as every other hand-drawn icon this session.

**Why this needed a decision**: this directly overrides the "avoid the Gear-tab collision" reasoning from the nav-iconography entry — worth flagging explicitly since a future pass might otherwise "fix" it back to sliders on the same reasoning that motivated it the first time. That reasoning wasn't wrong on its own terms, it was just not what was wanted here: an explicit ask for a cog beats an inferred-but-unstated risk of icon confusion.

**Resolution**: cog icon shipped as specified; icon-only header buttons restored. If the Settings/Gear visual-collision concern ever actually causes real user confusion, that's a reason to revisit the *Gear tab's* icon or label, not to quietly walk Settings back to sliders again.

---

## 2026-07-22 — Settings cog traced from a second reference SVG; the bucket-hat mark finally shown inside the app, not just as the OS icon

**What**: two more corrections. First, even the hand-drawn cog above wasn't quite right — the user supplied a second, more detailed reference SVG (a real "Settings" cog with 8 rounded/scalloped teeth, `stroke="#1C274C"`) and asked for it directly, same lesson as the hanger icon: stop hand-drawing recognizable objects, trace the reference. `NavIcon.tsx`'s `"settings"` case now renders that path verbatim (`stroke-width` kept at the reference's own `1.5` rather than forced to this file's usual `~1.8`, since it's copied geometry, not redrawn), with only the color swapped from the reference's hardcoded `#1C274C` to the `color` prop.

Second: "what happened to my bucket hat icon? it should be always shown in the left of the header" — the 2026-07-21 mascot-icon redesign (see that entry) only ever produced OS-level assets (`app.json`'s icon/adaptive-icon/favicon); it was never actually placed anywhere inside the app's own UI, which reads as "disappeared" from the user's side even though the assets always existed. Fixed by cropping `assets/android-icon-foreground.png` (the transparent-background Android adaptive-icon layer, not the opaque `icon.png`) down to its real content bounding box — that source has generous invisible padding baked in for Android's icon-mask safe zone, which would otherwise render as a tiny hat lost inside a mostly-empty box at header size — saved as `assets/header-logo.png`, and wired into `MainTabs.tsx` via `screenOptions.headerLeft` so it appears at the left of the header on all 4 main tabs (not per-screen, so it can't be forgotten on a future tab addition).

**Why this needed a decision**: (1) is the same class of correction as the hanger/first-cog rounds — logged for the pattern, not because it's a new judgment call. (2) is worth recording because the root cause (a real asset that was built but never actually surfaced in-app) is an easy mistake to repeat: "the icon exists in `assets/`" and "the icon is visible somewhere a user will see it" are different claims, and this session conflated them for nearly a full day of work before it was caught.

**Resolution**: both shipped as described; no native-only limitation here (unlike `LocationPickerMap`'s map, `<Image>` with a bundled asset works identically on web and native, verified via the same headless-browser screenshot method used throughout this session).

---

## 2026-07-22 — "Repeats" scoped to Leave-by mode only, not Leave-now/Arrive-by

**What**: the Plan screen's "When" section became a three-way Leave now /
Leave by / Arrive by selector (replacing a single date/time pair that was
always implicitly "leave at"). The existing "Repeats" toggle, which
materializes a recurring `RecurrenceRule.departTimeOfDay` daily, is now
only shown when "Leave by" is selected.

**Why this needed a decision**: "Leave now" has no fixed daily clock time
to repeat — "leave right away, every weekday" isn't a coherent recurrence.
"Arrive by" does have a plausible recurring interpretation ("get to work by
9am every weekday"), but materializing it correctly would mean re-solving
the arrival→departure estimate fresh each morning (duration/traffic vary
day to day), which the recurrence-materialization pipeline (Today tab)
doesn't do today — it just reads `departTimeOfDay` as a fixed string. That's
a separate, larger feature, not a natural extension of this change.

**Resolution**: Repeats is gated to `timeMode === "leave-by"` in
`PlanScreen.tsx`. Recurring "arrive by" journeys are out of scope until the
materialization pipeline can re-solve per-occurrence.

---

## 2026-07-22 — No drive-mode "short dash to the car" umbrella workaround (yet)

**What**: while making umbrella-fallback copy context-aware (rain-shell
substitute, covered-route note), a "you're driving, so you'll only be
exposed for a quick dash to the car" workaround was considered and
rejected for now.

**Why this needed a decision**: it's not buildable with what the pipeline
currently tracks. `planJourney.ts`'s `outdoor` flag is only ever true for
walk/cycle/stationary-wait legs — a `"drive"` leg is never `outdoor`, so no
weather is ever fetched for a pure-drive journey and `recommendGear()`'s
umbrella section (gated on `worstOutdoor`) never even evaluates for one.
Reacting to "you're driving" would need a synthetic walk-to-car leg
modeled into the route, which is a separate, larger routing change, not a
copy tweak.

**Resolution**: left out. If drive-mode weather/gear awareness is ever
built, this is the natural place to add the workaround.

---

## 2026-07-22 — Bottoms recommendation expanded from cold/wet-only to always-on

**What**: `recommendGear()`'s bottoms pick (`§7.13` in the docs) previously
only fired when conditions were wet+windy enough for rain trousers, or cold
enough for thermal ones — otherwise `Recommendation.bottoms` stayed
`undefined` and the card showed nothing. It's now unconditional, matching
how `shoes` already behaves: warm weather prefers a `"shorts"`/`"skirt"`
tagged item, cold prefers `"trousers"`, mild has no strong preference.

**Why this needed a decision**: the docs (`§7.13`) only ever described the
cold/wet trigger — always showing a bottoms row is a real behavior change,
not a bug fix, and worth a record so a future pass doesn't "restore" the
narrower gating thinking it regressed. The cold/wet-specific *notes* (rain
trousers warning, thermal fallback wording) still only fire under their
original conditions — only the unconditional *pick* is new.

**Resolution**: `TagChips.tsx` gained a `BOTTOMS_TAG_OPTIONS` set
(`shorts`/`skirt`/`trousers`/`cycling`/`formal`), wired into
`ClothingForm.tsx` for `type === "bottoms"` items. `pickCandidate()` in
`recommend.ts` is now called unconditionally for bottoms, with
`preferTags` chosen from `warmthLevel`.

---

## 2026-07-22 — Web `JourneyMap` closes the last native-only-map gap

**What**: `JourneyMap.web.tsx` was a placeholder (`"Map preview (native
only)"`) ever since Phase 3, because `react-native-maps` (the native
file's dependency) has no web target at all. It's now a real,
independently-implemented map — `react-leaflet` + OpenStreetMap tiles,
route polyline, per-stop pins, per-leg condition badges, and the
annotation-radius preview circle — mirroring `LocationPickerMap.web.tsx`'s
identical solution to the identical gap on a different screen.

**Why this needed a decision**: this was flagged as a hard technical wall
in earlier entries ("`react-native-maps` has no web target," repeated
across the Locations-CRUD, annotation-UI, and map-picker entries above) —
worth recording explicitly that it never actually was one; the wall is
`react-native-maps` specifically, not "maps on web" in general, and this
session closes the one remaining case nobody had gotten around to yet.

**Resolution**: `pinDivIcon`/`conditionDivIcon` factored out of
`LocationPickerMap.web.tsx`'s local `markerIcon()` into a new shared
`leafletIcons.ts` (both web maps now import from there, avoiding a second
copy of the same inline-SVG pin). Long-press annotation capture (no mouse
equivalent) maps onto a plain click, same substitution
`LocationPickerMap.web.tsx` already established for drag-vs-click. Framing
uses `map.fitBounds()` across all stops rather than a fixed zoom, since a
route can span much further than a single picked pin.

---

## 2026-07-22 — Location-picker pin seeded from the user's real location, not always Auckland

**What**: `LocationPickerMap` (native + web) previously opened on a
hardcoded Auckland-CBD fallback (`{ lat: -36.8485, lng: 174.7633 }`)
whenever the caller didn't already know real coordinates — i.e. every "add
a new location" and onboarding's map-pick path — regardless of whether the
user's actual location was knowable. `useRightNow.ts` (the Today weather
card) already had a GPS → saved-default-location → Auckland fallback
chain solving the identical problem; the picker just never reused it.

IP-based geolocation was raised as a possible extra fallback ahead of
Auckland, specifically avoiding a third-party API if possible. No such
option exists: resolving an IP to a location fundamentally requires either
an external lookup service or a bundled geo-IP database, both outside
"no third party" scope, and GPS (already covered) is strictly more
accurate than either would be. The chain stays GPS → saved default →
Auckland.

**Why this needed a decision**: reusing `useRightNow.ts`'s chain required
extracting it into a shared, callable function first (previously inlined
in that hook) — a small refactor, not just a picker-side fix. The
IP-geolocation question also needed an explicit answer rather than silent
omission, since it was asked about directly.

**Resolution**: new `src/lib/approximateLocation.ts` exports
`resolveApproximateLocation()`; `useRightNow.ts` now calls it instead of
its own inline copy. Both `LocationPickerMap.tsx`/`.web.tsx` call it
whenever `initialCoords` isn't supplied, showing a brief loading spinner
in place of the map until it resolves (simpler than re-centering an
already-mounted map, and typically near-instant — an SQLite read or an
already-granted GPS fix). A resolved real location also opens a bit more
zoomed out than the Auckland fallback (native `latitudeDelta`/
`longitudeDelta` `0.08` vs `0.05`; web `zoom={12}` vs `13`) — room to drag
to a nearby spot without immediately panning, which the generic Auckland
starting point doesn't need.

---

## 2026-07-22 — Live place-name label while dragging the pin, debounced against Geocoding cost

**What**: the location picker never told the user what place they were
pointing at until after confirming — no feedback while dragging/clicking,
and onboarding's "Use my current location" GPS button labeled its result
the bare string `"Current location"` since it never reverse-geocoded at
all. Both now resolve and show a real place name: the picker live-updates
a label as the pin settles, and the GPS button reverse-geocodes before
calling `onDone`, falling back to the old generic string only if that
lookup fails.

**Why this needed a decision**: `reverseGeocode()` is a billable Google
Geocoding API call — firing it on every intermediate drag/click position
(rather than once the pin has actually settled) would multiply cost for
no benefit, so this needed a deliberate debounce, not just a naive
"call it on every marker move."

**Resolution**: both `LocationPickerMap.tsx`/`.web.tsx` wait 700ms after
the marker stops changing before calling `reverseGeocode`, with a
request-id guard (same pattern `AddressAutocomplete.tsx` already uses) so
a slow, stale response can't overwrite a faster, more recent one's label.
`onConfirm` now optionally passes the already-resolved label through to
its caller (`LocationForm.tsx`, `Step1Location.tsx`), which reuse it
instead of calling `reverseGeocode` a second time on confirm — only
falling back to a fresh call if the live resolution never completed (e.g.
a very fast confirm tap).

---

## 2026-07-22 — Journey Detail's map draws the real route, not a straight line

**What**: both `JourneyMap.tsx` (native) and the new `JourneyMap.web.tsx`
only ever drew a straight `Polyline` through `stops` (origin/waypoints/
destination) — never the actual road/track-following geometry, even
though Google Routes already returns real per-leg polylines and this app
already decodes them elsewhere (`conditionMarkersFor()` calls
`decodePolyline()` just to find each leg's midpoint). This wasn't a
Leaflet/web limitation — the native map had the identical gap, since
neither version was ever given the real geometry to draw.

**Why this needed a decision**: fixing this meant deciding how to handle
legs with no polyline of their own (indoor waypoint dwells, synthesized
stationary waits) when concatenating per-leg geometry into one path,
rather than a single code change.

**Resolution**: `JourneyDetailScreen.tsx` now builds
`journey.legs.flatMap((leg) => leg.polyline ? decodePolyline(leg.polyline) : [])`
and passes it to both `JourneyMap` implementations as a new `routePath`
prop, which they draw instead of the straight `stops` line (falling back
to the old straight-line behavior only if `routePath` is empty — e.g. no
live route data). Legs without their own polyline simply contribute
nothing to the path rather than a straight-line bridge — the points
immediately before/after them are already at essentially the same
location (the stop/wait point), so the combined line still reads as
continuous.

---

## 2026-07-22 — Fixed: new-location map picker opened on "Null Island," not Auckland

**What**: `LocationForm.tsx`'s "Add a location" flow opened the pin-drop
map centered at `(0, 0)` — a point in the Gulf of Guinea — instead of
seeding from the user's approximate location (or the Auckland fallback)
like every other picker entry point already did.

**Why this needed a decision**: worth recording because the actual root
cause was two bugs stacked on top of each other, and the more interesting
one wasn't in the map code at all. `LocationForm.tsx` computes
`initialCoords` for the picker from its `lat`/`lng` text fields via
`Number(lat)`/`Number(lng)` — but `Number("")` evaluates to `0`, not
`NaN`. For a brand-new location, those fields start empty, so the
existing `!Number.isNaN(latNum)` check passed and `initialCoords` was
explicitly `{ lat: 0, lng: 0 }` — which `LocationPickerMap` correctly (by
its own logic) treated as "the caller already knows real coordinates,"
skipping `resolveApproximateLocation()` entirely rather than falling back
to it. Diagnosed by temporarily logging `resolveApproximateLocation()`'s
internal branches — the giveaway was that opening the picker produced no
log output at all, meaning the resolution chain was never even called for
this entry point, only for onboarding's map-pick path (which never passes
`initialCoords`). The same `Number("")` bug also affected `canSubmit`,
meaning a location could theoretically be saved with `(0, 0)` coordinates
if a user filled in label/address but never set real coordinates.

**Resolution**: added a `hasValidCoords` check in `LocationForm.tsx` that
requires the `lat`/`lng` fields to be non-empty strings (`.trim() !== ""`)
in addition to the existing NaN check, used for both `initialCoords` and
`canSubmit`. Separately, `approximateLocation.ts`'s
`resolveApproximateLocation()` and the GPS-only `useCurrentLocation()` in
`Step1Location.tsx` both now treat an exact `(0, 0)` result from GPS or
the saved `default_location` setting as invalid and fall through to the
next source in the chain — a genuine defense-in-depth measure independent
of the `LocationForm.tsx` bug, since some browsers/WebViews are known to
resolve geolocation with `(0, 0)` instead of rejecting when the underlying
location provider fails silently.
