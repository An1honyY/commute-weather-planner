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
