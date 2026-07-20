# AGENTS.md — Commute Weather Planner

This file is the entry point for any coding agent working on this repo. The
full spec was originally one long document; it's now split into focused
files under `docs/` so you can load only what a given task needs instead of
the whole thing. **Read this file first, always** — then follow the pointers
below to the specific doc(s) a task requires.

> One-liner: a React Native (Expo) app that plans a journey and recommends
> *your own* wardrobe/gear items — not generic advice — based on per-leg
> weather and indoor climate exposure.

---

## 0. Before you write any code

Read these three in full, every session, regardless of task — they contain
constraints that silently invalidate work if missed:

- **`docs/00-overview.md`** — what this app is, one paragraph.
- **`docs/08-build-phases.md`** — the mandatory build order. Do not build
  the recommendation engine before Journey/Inventory data exists to feed
  it, do not build Phase 6 (environment annotations) before Phase 5 (the
  engine it modifies) exists, etc. If you're picking up a task, figure out
  which phase it belongs to before starting.
- **`DECISIONS.md`** — a log of deliberate design calls that look like gaps
  or bugs but aren't (e.g. the severe-weather advisory is intentionally a
  single suggestion sentence, not a safety feature; Tier 3 mascot rendering
  was deliberately deferred, not forgotten). Check it before "fixing"
  something that looks like an oversight — if it's logged here, it's a
  scope boundary, not a bug. Add a new entry any time you make a similar
  judgment call.

Then skim these two "always true" constraints — they affect almost every
phase:

- v1 is **Auckland-only** (public transit + Southern-Hemisphere season
  detection) and **single-user** (one wardrobe, one person) — by design,
  not an oversight. See `docs/02-external-apis.md` §2.1–2.2. Don't
  "helpfully" generalize either without a separate scoped task.
- SQLite migrations are **additive-only** (new tables/nullable columns,
  never drop/rename in place). See `docs/03-data-models.md` §3.1.

---

## 1. File index

| File | Covers (spec section) | Read when you're... |
|---|---|---|
| `docs/00-overview.md` | Intro | Always (context) |
| `docs/01-tech-stack.md` | §1 Tech stack | Setting up deps, choosing a library |
| `docs/02-external-apis.md` | §2 External APIs, regional/single-user scope | Wiring Google Routes, Open-Meteo, AT GTFS; billing setup |
| `docs/03-data-models.md` | §3 Data models, schema versioning, indices, gear photos, annotations | Touching `src/types/index.ts`, SQLite schema, migrations |
| `docs/04-screens-navigation.md` | §4 Screens & navigation, onboarding, favorites/saved routes, History, Local knowledge | Building any screen or nav flow |
| `docs/05-data-wiring.md` | §5 Screen-to-data wiring, offline handling, forecast drift/confidence, caching | Connecting screens to APIs/services |
| `docs/06-weather-classification.md` | §6 `classifyWeather`, `CLIMATE_BY_MODE`, season/AC contrast, apparent-temp rationale | Weather classification logic |
| `docs/07-recommendation-engine.md` | §7 `recommendGear()` and all its sub-logic (notifications, calibration, sun/dark gear, stationary waits, cycling, formal mode, hike) | **The core engine** — `src/lib/recommend.ts` |
| `docs/08-build-phases.md` | §8 Build phase order (Phases 1–12) | Planning what to build next |
| `docs/09-design-system.md` | §9 Design tokens, voice/copy guide, component layouts, accessibility | Any UI/styling work |
| `docs/10-production-readiness.md` | §10 API key security, backup/export, store submission, crash reporting | Pre-release hardening |
| `docs/11-testing-strategy.md` | §11 What to unit test, manual test plan, out-of-scope | Writing tests (do this alongside the code, not after) |
| `docs/12-dev-workflow-ci.md` | §12 Services layer, dev menu, CI | Setting up `src/services/`, debug tooling, CI config |
| `docs/13-extended-features.md` | §13 Phases 13–21 (post-v1: recap card, share card, Live Activity, widget, Siri/tile, route learning, cloud sync, hike mode, mascot companion) | Anything after Phase 12 is done — don't pull these forward |
| `DECISIONS.md` | Log of deliberate scope/design calls | Before "fixing" anything that looks like a missing feature or inconsistency — check it's not already a logged decision |

---

## 2. Build order cheat sheet

Follow `docs/08-build-phases.md` exactly; the short version, with which docs
each phase touches:

1. **Scaffold** → `01`, `03` (schema), `12` (services skeleton, CI)
2. **Onboarding + Gear/Locations CRUD** → `03`, `04`
3. **Journey planning, mocked data** → `04`, `09` (Journey Detail layout)
4. **Live weather + routing** → `02`, `05`
5. **Recommendation engine** → `07`, `09` (render layout), `03` (Settings fields)
6. **Environment annotations & location overrides** → `03` §3.4, `05` §5.5, `07` §7.8
7. **Auckland Transport live data** → `02`, `05` §5.6, `07` §7.9
8. **Leave-by notifications** → `07` §7.3
9. **History** → `04` §4.4, `09` §9.4.2
10. **Personalization & extended signals** → `07` §7.5–7.6, `05` §5.2
11. **Polish** → `09` §9.6 (a11y), `09` §9.0.1 (copy pass), `11` (tests)
12. **Production readiness** → `10`
13+ → `13` (only after 1–12 are functionally complete)

---

## 3. Key file destinations in the actual codebase

Per the spec, these are the intended source paths — keep new code aligned
with them so future tasks (and other agents) can find things:

- `src/types/index.ts` — all data models (`docs/03-data-models.md`)
- `src/lib/recommend.ts` — `recommendGear()` and its named constants
  (`docs/07-recommendation-engine.md`)
- `src/lib/weather.ts` (or co-located in `recommend.ts`) — `classifyWeather`,
  `getSeason`, `acFeelsCold` (`docs/06-weather-classification.md`)
- `src/services/` — one module per external API, typed `{ data } | { error }`
  result shape (`docs/12-dev-workflow-ci.md` §12.1, `docs/05-data-wiring.md` §5.4)
- `src/theme/tokens.ts` — `darkTheme` / `lightTheme` token objects
  (`docs/09-design-system.md` §9.1)
- `migrations/NNN_description.ts` — additive-only, numbered
  (`docs/03-data-models.md` §3.1)

---

## 4. If a task spans multiple docs

Most real tasks touch 2–3 files (e.g. "add the umbrella wind-rating check"
touches `07` for logic, `03` for the `UmbrellaItem`/`WeatherSnapshot` shape,
and `09` for how it renders). Read all of them before writing code — the
spec cross-references sections deliberately (e.g. §7.8 explicitly says which
constant to reuse rather than inventing a new one), and skipping a
referenced doc is the most likely way to duplicate or contradict existing
logic.
