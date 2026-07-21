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
   as originally spec'd: permission priming → Home/Work → live demo card →
   self-report warmth question (Section 4.1, 7.5.1) → gear basics with
   inline photo capture, Section 3.3, using the 1-10 warmth slider and
   jacket-only `substitutesForMidlayer` toggle from Section 9.1.2, plus the
   optional fourth bottoms/trousers entry (Section 3, 7.13) → crash-
   reporting opt-in.
   > **Superseded 2026-07-21** — Section 4.1 now specs a single "where are
   > you?" onboarding step, with Home/Work, gear basics, and notification
   > permission moved to a postponable setup checklist on Today and
   > crash-reporting opt-in dropped to Settings-only; see DECISIONS.md. The
   > self-report/warmth-slider/substitutesForMidlayer implementation
   > details above didn't change, only when that flow is reached.

   Also built this phase: fully working add/edit/delete for all 4
   inventory categories and saved locations — including tag chips for
   accessories
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

