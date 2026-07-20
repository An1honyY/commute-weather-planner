## 6. Weather + climate classification (port directly from the working mockups)

```ts
function classifyWeather(code: number, mm: number, windKph: number) {
  if (code >= 95) return { label: "Stormy", icon: "⛈", severity: 4 };
  if (code >= 61) return mm > 4
    ? { label: "Heavy rain", icon: "🌧", severity: 3 }
    : { label: "Rain", icon: "🌧", severity: 2 };
  if (code >= 51) return { label: "Light rain", icon: "🌦", severity: 1 };
  if (code === 45 || code === 48) return { label: "Foggy", icon: "🌫", severity: 1 };
  if (code === 3) return { label: "Overcast", icon: "☁", severity: 0 };
  if (windKph > 25) return { label: "Windy", icon: "💨", severity: 1 };
  return { label: "Dry", icon: "☀", severity: 0 };
}

// Default indoor climate per mode — refine later if AT exposes vehicle data
const CLIMATE_BY_MODE = {
  walk: null,
  cycle: null,
  drive: null,      // treat car interior as unconditioned by outside weather
  bus: "ac",
  train: "ac",
  indoor: "ac",      // offices, supermarkets, shops
} as const;
```

This table is a **default guess, not a fact** — a journey's origin/
destination `SavedLocation.hasReliableClimateControl` (Section 3.4), when
set, always overrides it for that leg. See Section 5.5 for exactly where
that override is applied during wiring.

Rain-intensity gauge (used for the hourly strip UI): `none` if probability < 20%,
`low` if precip < 0.5mm/hr, `med` if 0.5–4mm/hr, `high` if > 4mm/hr.

### 6.1 Season + AC contrast

Auckland is Southern Hemisphere, so seasons are shifted relative to the
`Intl`/calendar defaults an agent might assume. Derive season from the
journey's `departTime`, not from device locale:

```ts
export type Season = "summer" | "winter" | "shoulder";

const SUMMER_MONTHS = [12, 1, 2];   // Dec–Feb
const WINTER_MONTHS = [6, 7, 8];    // Jun–Aug
// Mar–May and Sep–Nov = "shoulder"

function getSeason(isoDateTime: string): Season {
  const month = new Date(isoDateTime).getMonth() + 1; // JS months are 0-indexed
  if (SUMMER_MONTHS.includes(month)) return "summer";
  if (WINTER_MONTHS.includes(month)) return "winter";
  return "shoulder";
}
```

Air conditioning on buses/trains is **not symmetric** across seasons:

- **Summer**: AC is actively refrigerating against a hot exterior, so the
  gap between "outside" and "inside the carriage" is large — it reads as
  noticeably cold, especially after being warm outside. This is the case
  the existing `hasIndoorAC && hasWarmOutdoor` branch in Section 7 is for.
- **Winter**: transit AC units are typically idle or blowing unconditioned/
  ambient air rather than actively cooling (heating, if present, works the
  opposite direction). There's no equivalent "cold contrast" — treat winter
  AC exposure as a neutral factor, not a reason to add a layer.

```ts
function acFeelsCold(journey: Journey, season: Season, hasWarmOutdoor: boolean) {
  const hasIndoorAC = journey.legs.some(l => l.climate === "ac");
  return hasIndoorAC && season === "summer" && hasWarmOutdoor;
}
```

Only `summer` triggers the AC-contrast adjustment in the recommendation
engine below. `winter` and `shoulder` AC exposure is ignored for layering
purposes (it may still matter for e.g. suggesting a scarf in winter, but
that's out of scope for v1).

### 6.2 Apparent temperature as the engine's baseline, not raw air temperature

An earlier draft of this spec had `recommendGear()` (Section 7) work
entirely from raw `tempC`/`windKph`/`uvIndex`, with its own hand-built
wind-chill and direct-sun deltas layered on top. That duplicates work
Open-Meteo already does more rigorously via `apparent_temperature`
(Section 2), and — more importantly for Auckland specifically — it had no
way to account for humidity at all, despite Auckland's persistently high
relative humidity being a real, commonly-cited factor in how cold a given
temperature actually feels here ("damp cold"). The corrected structure:

- **`WeatherSnapshot.apparentTempC` (Section 3) is the engine's baseline
  input**, not raw `tempC`. `warmthLevelFromTemp()` and every `minTemp`
  reduction across a journey's legs (Section 7) read `apparentTempC`, which
  already has Open-Meteo's own wind/humidity/solar-radiation model folded
  in for the general area.
- **The engine's own wind/sun adjustments (Section 7.8) are rescoped to
  hyper-local deviations only** — they fire *only* when an
  `EnvironmentAnnotation` applies (`windEffect`, `sunEffect`,
  `highReflection`, Section 3.4), representing a specific street or spot
  that's meaningfully windier/sunnier than the citywide baseline
  `apparentTempC` already assumes. Without an annotation, there is no
  separate general wind-chill or sun-warming check — that would
  double-count an effect `apparentTempC` already includes. This is a
  deliberate correction from an earlier version of this section, which
  applied a general ambient wind-chill delta on top of raw temperature;
  once the baseline itself is wind/humidity-aware, that general check is
  redundant and was removed rather than kept "just in case."
- **A single divergence note replaces the old wind-specific one.** Rather
  than a wind-only "windy conditions will feel colder" note, `notes[]`
  compares `apparentTempC` to `tempC` directly on the worst outdoor leg: a
  difference of 2°C or more (whatever the cause — wind, humidity, or a
  combination) earns a note naming the gap, e.g. "Feels noticeably colder
  than the air temperature today." This is more honest than attributing the
  gap to wind alone, since in Auckland it's frequently humidity-driven or a
  combination of both, and Open-Meteo's model already knows which factors
  contributed without the app needing to re-derive that itself.
- **Umbrella wind-rating uses `windGustKph`, not `windKph`.** A gust is what
  physically inverts an umbrella; sustained wind is the more relevant
  figure for how cold a walk feels. Using the same field for both was an
  earlier simplification, corrected here now that both fields are
  requested (Section 2).
- **Validity caveat, carried into the spec rather than left implicit:** the
  standard wind-chill formula Open-Meteo's `apparent_temperature` draws on
  is formally validated only for ambient temperatures at or below ~10°C.
  Auckland's typical "cool and breezy" commute conditions (11–14°C) sit
  just past that validated range — treat `apparentTempC` in that band as a
  reasonable, well-grounded approximation, not an exact physiological
  reading, the same caveat Section 5.3 already applies to forecast
  confidence generally.

Section 7's constants and control flow below reflect this corrected
structure directly — this subsection exists so the *reasoning* for the
correction is documented alongside the mechanism, not just the mechanism
itself.

---

