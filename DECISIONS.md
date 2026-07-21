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
