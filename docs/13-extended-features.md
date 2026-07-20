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
