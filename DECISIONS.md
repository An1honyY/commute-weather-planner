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
