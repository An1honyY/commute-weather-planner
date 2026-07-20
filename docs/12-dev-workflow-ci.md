## 12. Developer workflow & CI

Process scaffolding that pays for itself quickly on a project this size —
none of it is required for the app to function, but each item below removes
a class of bug or slowdown that otherwise gets rediscovered the hard way.

### 12.1 Services layer

Covered in Section 5.4: one module per external API under `src/services/`
with a consistent typed result shape, rather than ad hoc `fetch` calls
scattered across screens. Beyond the performance/fallback benefits already
described there, this is also what makes the dev-menu failure toggles
(12.2) and the unit-test mocking (Section 11.1) simple — there's exactly
one seam per API to intercept, not one per screen that happens to call it.

### 12.2 Debug/dev menu

Section 11.2's manual test plan assumes a few things are toggleable that
aren't otherwise reachable from the UI — worth building as an actual
gated screen rather than staying theoretical:

- Force any of the three services (12.1) to return an error, to exercise
  the fallback UX from Section 5.1 on demand instead of needing to
  actually be offline or waiting for a real rate limit.
- Trigger the forecast-drift re-check (5.2) manually against a chosen
  saved journey, instead of waiting for the background-fetch schedule.
- Fast-forward the "current date" used by recurrence materialization
  (Section 3) and History's date filter, to test multi-day recurring
  journey behavior without waiting real days.
- Reset onboarding state and clear the crash-reporting/theme preferences
  (Sections 9.1, 10.5), to re-test first-run flows without reinstalling.
- Simulate an AT GTFS Realtime delay of a chosen number of minutes on a
  selected bus/train leg, to exercise the stationary wait-leg sizing logic
  (Section 5.6, 7.9) without waiting for a real-world delay to occur.

Gate this behind `__DEV__` (or an EAS `development`/`preview` build
profile per 10.4) so it never ships reachable in a production build —
shake-to-open or a long-press on the Settings screen title are both
common, low-effort entry points.

### 12.3 Lightweight CI

A GitHub Actions workflow (or equivalent) running on every push/PR:

1. `tsc --noEmit` (typecheck)
2. lint (ESLint config matching whatever the Expo template ships)
3. `jest` (the full suite from Section 11.1, including migration tests)

This is deliberately not the E2E/device-farm CI scoped out in 11.3 — no
Detox, no simulator boot, just static checks and unit tests, which stay
fast (seconds, not minutes) and catch most of what actually breaks between
commits: a migration that silently drops data, a `classifyWeather()`
boundary that regressed, a typo that TypeScript would have caught. Cheap
enough to set up in Phase 1 (Section 8) and leave running for the rest of
the build rather than bolting on later.

---

