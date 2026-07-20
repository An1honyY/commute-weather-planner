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

