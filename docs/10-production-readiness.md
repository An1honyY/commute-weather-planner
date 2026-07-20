## 10. Production readiness: security, backup, app store submission

Don't treat this as an afterthought bullet list — each subsection below has
concrete config the coding agent should actually produce, not just "consider
doing X."

### 10.1 API key security

- **Google Routes API key is billable and must never ship in the client
  bundle as-is.** RN/Expo JS bundles are trivially unpacked, so a key baked
  in via `.env`/`app.config.ts extra` is extractable and abusable (quota
  drain, surprise bill).
  - v1 fix: restrict the Android key to the app's SHA-1 cert fingerprint +
    package name, and the iOS key to the bundle ID, via Google Cloud
    Console's "Application restrictions." This doesn't hide the key but
    prevents it being used outside the app.
  - Preferred fix (do this before wide release, not just app-store review):
    proxy `computeRoutes` calls through a minimal backend (a single
    Cloudflare Worker or Vercel Edge Function is enough) that holds the real
    key server-side and applies basic rate limiting per device. The app
    calls your proxy URL instead of `routes.googleapis.com` directly.
- **AT GTFS subscription key**: same restriction principle — AT's dev portal
  supports per-key rate limits; keep it modest since it's a free tier.
- **Open-Meteo**: no key, no action needed.
- Never log full API responses or keys via `console.log` in production
  builds — strip with `babel-plugin-transform-remove-console` for release
  builds, keep it for dev.

### 10.2 Local data security

- SQLite file lives in `FileSystem.documentDirectory` (see 10.3 — this also
  affects backup behavior). It is **not encrypted at rest by default.**
  Inventory/location data here isn't especially sensitive, but home/work
  addresses are personal — enable SQLCipher (`expo-sqlite` supports it via
  a config plugin) if the agent wants encryption-at-rest; otherwise
  explicitly note in the privacy policy (10.5) that data is stored
  unencrypted on-device.
- Always use parameterized queries (`db.runAsync(sql, [params])`), never
  string-interpolate user input into SQL, even though this is a
  single-user local app — habit worth keeping if sync is added later.
- `expo-location` permission should be requested with `"whenInUse"`, not
  `"always"` — the app has no background use case that justifies always-on
  tracking, and `"always"` triggers extra App Store review scrutiny.

### 10.3 Data backup & export

SQLite in `documentDirectory` is included in each platform's automatic
device backup by default — confirm this is what you want rather than an
accident:

- **iOS**: files under `documentDirectory` are included in iCloud/iTunes
  device backups automatically. No action needed to get this for free,
  but if the DB grows large, Apple may flag it in review — add the
  `NSURLIsExcludedFromBackupKey` flag *only* to any large cached files
  (e.g. downloaded map tiles), never to the SQLite DB itself.
- **Android**: Auto Backup for Apps is on by default for API 23+, but add
  an explicit `dataExtractionRules`/`android:allowBackup` block in
  `app.config.ts`'s `android` field so behavior is intentional rather than
  relying on the platform default silently changing.
- **In-app export (build regardless of the above — it's the part users can
  actually see and trigger)**: a "Export my data" action in a Settings
  screen that serializes `Inventory` + `SavedLocation[]` +
  `WarmthCalibration` + `AdvancedWarmthThresholds` + `Journey[]` (including
  each one's `recommendationSnapshot`) to a `data.json`,
  bundles it with the `gear-photos/` folder (Section 3.3) into a single zip
  via `expo-file-system`, and shares it with `expo-sharing` (AirDrop,
  email, Drive, wherever the user picks). Pair with an "Import data" action
  that reads a picked zip (`expo-document-picker`), unzips it, upserts
  `data.json` contents by `id`, and copies photo files back into
  `documentDirectory`, so users can move data between devices or recover
  after a reinstall — including their gear photos, not just the text
  fields — without waiting on OS-level backup timing.
  - **Worth calling out specifically**: `WarmthCalibration` and
    `AdvancedWarmthThresholds` were easy to leave out of an earlier,
    narrower version of this export scope that only covered `Inventory`/
    `SavedLocation` — but by the time Section 7.5's seasonal/wind-
    sensitivity calibration and Section 3.6's threshold overrides exist,
    that's real, hard-won personalization state (weeks of feedback,
    potentially) that a user would otherwise silently lose on reinstall
    with no way to know it happened. Include it from the start rather than
    retrofitting once someone notices their calibration reset.
  - `Journey[]` history is included for the same reason — otherwise
    "Export my data" reads as covering "your data" while quietly excluding
    the History screen's entire contents (Section 4.4), which would be a
    misleading omission given the export flow's advertised purpose.
- Out of scope for v1, but design for it: keep all IDs as UUIDs (not
  auto-increment ints) so a future cloud-sync phase doesn't require an ID
  migration.

### 10.4 Build & submission config

- Use **EAS Build** (`eas.json` with `development`/`preview`/`production`
  profiles) and **EAS Submit** for both stores — avoid manual Xcode/Android
  Studio archive builds, they don't reproduce reliably.
- `app.config.ts` must set, at minimum:
  - `ios.bundleIdentifier` / `android.package` (reverse-DNS, e.g.
    `com.yourname.commuteweather`)
  - `version` + platform build numbers (`ios.buildNumber`,
    `android.versionCode`) bumped every submission
  - App icon (1024×1024 source, Expo generates the rest) and splash screen
    — see the icon concept below; don't leave this as a placeholder
    gradient-and-glyph default
  - Permission usage strings — these are mandatory copy, not boilerplate:
    `NSLocationWhenInUseUsageDescription` should say *why* ("to set your
    current location as a journey starting point"), not just "location
    access required"
- **App icon concept**, translating the utilitarian/personal character
  from Section 9.0 into a mark rather than leaving "make an icon" totally
  open-ended: a single, simple silhouette (an umbrella or a jacket — pick
  one, don't combine both into a busier mark) rendered flat and geometric
  (utilitarian — reads clearly at 40px on a home screen, no gradient or
  photographic rendering), filled in one of the app's own warm accent hues
  from Section 9.1 (`accentWalk`'s amber is a reasonable default — personal,
  distinct from the blue/green most weather apps default to) against the
  dark `bg` token as background. Avoid literal weather iconography
  (sun/cloud combos) for the icon specifically — that's exactly what every
  generic weather app's icon looks like, and the whole point of this app is
  that it's not that.
- iOS: fill in the **Privacy Manifest** (`PrivacyInfo.xcprivacy`, required
  since 2024 for apps using location and network APIs) declaring the
  location API usage reason code and confirming no data is sold/shared
  with third parties beyond the weather/routing/transit API calls needed
  to function.
- Both stores require a **privacy policy URL** even for a single-user app
  with no accounts — host a static page (can be a single markdown file
  rendered via GitHub Pages) covering: what's collected (location, saved
  addresses), where it's stored (on-device, exported data is user-controlled),
  which third parties see it (Google Routes, Open-Meteo, AT GTFS — all
  receive coordinates/timestamps to fulfill the route/weather/transit
  request, no ad networks or analytics SDKs in v1), and crash reporting
  (off by default, opt-in only, no personal data included when enabled —
  see Section 10.6).
- **Store listing copy** — both stores need a short description; draft one
  that leads with the differentiator instead of a generic feature list,
  since "recommends your actual jacket, not generic advice" (this document's
  own opening line) is the thing that distinguishes this from any weather
  app. Also state the Auckland transit/season scope from Section
  2.1 in the description itself, not just discoverable after download —
  a reviewer or user who expects nationwide transit support and doesn't get
  it is a 1-star review, not a bug report.
- Use **TestFlight** (iOS) and the **Internal Testing track** (Google Play)
  before any public submission — both catch permission-prompt and crash
  issues review would otherwise reject on.

### 10.5 Crash reporting (opt-in)

Useful for debugging real-world issues post-launch, but the privacy-first
posture in 10.4 means this can't be silently bundled the way it is in most
apps:

- Default **off**. No crash SDK initializes and no data leaves the device
  until the user explicitly turns it on.
- Surface the choice during onboarding (Section 4.1) as a skippable step
  after the gear-basics step, framed honestly: "Help fix crashes — send
  anonymous crash reports if the app fails? You can change this anytime in
  Settings." Defaulting the toggle itself to *off* even on that screen (an
  opt-in checkbox, not an opt-out one) is what makes this actually opt-in
  rather than opt-out-with-extra-steps.
- Also expose the same toggle in the Settings screen introduced in Section
  9.1, next to the theme picker, so the choice isn't onboarding-only.
- Any provider with a free/generous tier and no PII-by-default works (e.g.
  Sentry's Expo SDK) — the specific vendor is an implementation detail, but
  wire it so `Sentry.init()` (or equivalent) only runs when the stored
  preference is `true`, not with a no-op DSN when off, so no telemetry
  connection is made at all while the user hasn't opted in.
- Scrub location coordinates and saved-location labels from crash context
  before sending — a stack trace doesn't need "Home" address to be useful
  for debugging a null-pointer in the recommendation engine.

### 10.6 Pre-submission checklist

- [ ] No console logging of API keys or full network payloads in release builds
- [ ] Google Routes + AT keys restricted (10.1)
- [ ] Google Cloud budget alert configured on the Routes API project (2.1)
- [ ] Location permission set to "when in use," with a real usage string
- [ ] Privacy policy URL live and linked in both store listings, crash
      reporting disclosed as opt-in (10.5)
- [ ] Crash reporting confirmed off by default on fresh install; toggling it
      on in Settings actually initializes the SDK (and off, actually doesn't)
- [ ] `PrivacyInfo.xcprivacy` present (iOS)
- [ ] Export/Import data flow tested round-trip (delete app, reinstall, import)
- [ ] Offline fallback (Section 5.1) verified for all three APIs — Routes,
      Open-Meteo, and AT GTFS each toggled off independently, not just
      airplane mode for all three at once
- [ ] Schema migrations (3.1) tested against a fixture DB from the previous
      released version, not just a fresh install
- [ ] Unit test suite (Section 11) passing, `classifyWeather()` and
      `recommendGear()` coverage in particular
- [ ] Light/dark/system theme toggle verified on both platforms (9.1)
- [ ] Version/build numbers bumped from any prior submission

---

