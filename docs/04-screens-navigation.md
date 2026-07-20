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

