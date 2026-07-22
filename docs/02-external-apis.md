## 2. External APIs

| Purpose | API | Cost | Auth |
|---|---|---|---|
| Route / directions | Google Routes API (`routes.googleapis.com/directions/v2:computeRoutes`) | Free monthly threshold, card required | API key |
| Address search / autocomplete | Google Places API (New) (`places.googleapis.com/v1/places:autocomplete`, `places:{id}` details) | Free monthly threshold (session-based pricing), same GCP project as Routes | same API key as Routes |
| Reverse geocoding (lat/lng → address) | Google Geocoding API (`maps.googleapis.com/maps/api/geocode/json`) | Free monthly threshold, same GCP project as Routes | same API key as Routes |
| Weather (hourly, per lat/lng) | Open-Meteo (`api.open-meteo.com/v1/forecast`) | Free, no key, 10k calls/day non-commercial | none |
| Auckland public transit | Auckland Transport GTFS Realtime (`api.at.govt.nz/gtfs/v3/...`) | Free | subscription key from dev-portal.at.govt.nz |
| Map tiles, **web only** (`LocationPickerMap.web.tsx`) | OpenStreetMap standard tile server (`tile.openstreetmap.org`) via react-leaflet | Free, no key, subject to OSM's tile usage policy (reasonable/non-bulk use) | none |

Store as env vars: `GOOGLE_ROUTES_API_KEY`, `AT_SUBSCRIPTION_KEY`. Open-Meteo
needs none. Places API (New) and the Geocoding API both deliberately reuse
`GOOGLE_ROUTES_API_KEY` rather than separate keys — Google Cloud API keys
are project-scoped, not single-API, so the same key just needs "Places API
(New)" and "Geocoding API" enabled alongside "Routes API" in the same GCP
project's console. `placesService.ts` groups each autocomplete session
(first keystroke through the one details call that resolves a selected
suggestion) under a shared session token — Google bills that as one
session-priced unit instead of per-request, which matters given
autocomplete fires on every debounced keystroke. Reverse geocoding
(`placesService.reverseGeocode()`) is a separate, unbatched call — it only
fires once, when a `LocationPickerMap` pin is confirmed, not on every
keystroke, so it doesn't need the same session-token treatment.

**Billing safety net for Google Routes:** the free threshold plus a card on
file means a bug (retry loop, a runaway background re-fetch in Section 5.2,
etc.) can generate a real bill, not just a rate-limit error. Set this up in
Google Cloud Console **before** the key is used anywhere outside local dev:

- A budget with an alert threshold, starting low — **$5 NZD** is a sane v1
  default for a single-user app, since real usage should stay near $0 on the
  free tier — sent to the developer's own email/console notifications.
- This is deliberately a soft alert, not a hard cutoff that disables the key:
  a disabled key mid-development just looks like a mystery outage. Raise the
  threshold (e.g. to $25 or $50) once real usage patterns are known and the
  proxy-based key protection in Section 10.1 is in place; treat the $5
  starting value as a placeholder to revisit, not a permanent ceiling.
- Budget alerts are a GCP Console setting, not app code — note the project/
  billing-account name here once created so it's easy to find and adjust:
  `Billing → Budgets & alerts` in the same GCP project as the Routes API key.

Weather conditions are classified from Open-Meteo's `weather_code` (WMO code), not
just precipitation mm — see Section 6 for the mapping table.

Also request Open-Meteo's `uv_index` and `is_day` hourly fields in the same
call (no extra request needed) — they populate `WeatherSnapshot.uvIndex` and
`.isDaylight` and feed the sun/darkness gear logic in Section 7.6. Open-Meteo's
own forecast accuracy degrades the further out the requested time is; Section
5.3 defines how that's surfaced to the user rather than presented with false
precision.

**Also request `apparent_temperature`, `wind_gusts_10m`, and
`relative_humidity_2m`** in the same call (Section 6.2). Auckland's climate
has two properties that make raw `temperature_2m` and `windspeed_10m` alone
an unreliable basis for the recommendation engine:

- **Auckland is windy year-round** (averaging ~14–18 km/h, one of the
  windier NZ centres) and **consistently humid** (mid-to-high 70s% relative
  humidity even in the driest months) — both meaningfully affect how a given
  air temperature actually feels, and neither is captured by `temperature_2m`
  on its own. Rather than hand-building a wind-chill/humidity approximation
  from scratch, request Open-Meteo's `apparent_temperature` field — an
  already-validated feels-like figure computed from temperature, wind,
  humidity, and solar radiation together — and use *that* as the engine's
  primary input (Section 7). See Section 6.2 for exactly how this changes
  the engine's structure.
- **Umbrella survival is a gust question, not a sustained-wind question.**
  `windspeed_10m` (sustained wind) is the right field for describing general
  conditions, but a gust is what actually inverts an umbrella. Request
  `wind_gusts_10m` separately and use it specifically for the umbrella
  wind-rating check (Section 7.8) rather than reusing sustained wind for
  both purposes.

### 2.1 Regional scope (v1 is Auckland-only — say so explicitly)

Two parts of this app are hard-coded to Auckland, not just "likely to work
best there," and the app should be honest about that rather than let a
non-Auckland user discover it by trial and error:

- **Public transit is Auckland-only.** The AT GTFS Realtime integration only
  covers Auckland Transport's network. Walk/drive/cycle modes work anywhere
  Google Routes has coverage, but bus/train legs have no live-departure data
  (or any GTFS feed at all) outside Auckland.
- **Season detection assumes the Southern Hemisphere** (`getSeason()`,
  Section 6.1) — Dec–Feb is hardcoded as summer. This is correct for Auckland
  and wrong for a Northern Hemisphere user; it isn't derived from device
  locale or location.
- **v1 fix**: on first launch, if `expo-location`'s current position (or the
  address entered for "Home" during onboarding, Section 4.1) resolves to a
  country other than New Zealand, show a one-time non-blocking notice:
  "Commute Weather Planner is tuned for Auckland — walking/driving directions
  and weather will work anywhere, but bus/train times and seasonal gear
  advice may be off." Don't block onboarding on this, just set expectations.
- **Store listing**: the App Store / Play Store description (Section 10.4)
  should state the Auckland transit scope up front rather than leave it to a
  1-star review to surface it.

### 2.2 Single-user scope (v1 is one wardrobe, one person — say so explicitly)

The same honesty principle as 2.1 applies here: `Inventory` and
`WarmthCalibration` (Section 3) are both singular, app-wide constructs, not
because multi-person support was overlooked, but because it's a genuinely
different data model — every `ClothingItem`/`ShoeItem`/etc. would need an
`ownerId`, `WarmthCalibration` would need to become a table keyed by owner
instead of a single row, and `Journey` would need a "who's traveling" field
that touches nearly every part of Sections 3–9. That's the same scale of
change as Section 13.7's cloud-sync phase, not a quick bolt-on, so it's
explicitly out of scope for v1 and every phase in this document rather than
something a coding agent should try to half-implement along the way.

- **v1 fix**: state this plainly in the app's About/Settings copy —
  "Commute Weather Planner is built for one person's wardrobe and one
  commute at a time" — next to the theme picker introduced in Section 9.1,
  so it's disclosed rather than discovered when a second person's jacket
  shows up in someone else's recommendation.
- **If pursued later**: it deserves its own fully-specced phase (data
  model, wiring, screens) the same way Section 13.7 treats cloud sync, not
  a field added to `Inventory` in passing.

---

