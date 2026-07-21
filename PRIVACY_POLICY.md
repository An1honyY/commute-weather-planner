# Privacy Policy — Commute Weather Planner

_Last updated: 2026-07-21_

Commute Weather Planner is a single-user app: there are no accounts, no
sign-in, and no server run by us that your data passes through. This page
explains what the app collects, where it lives, and who else sees it.

## What we collect

- **Location** — your device's current location (only while the app is open
  and you use it, never in the background), used to set your current
  location as a journey starting point.
- **Saved addresses** — the Home/Work and any other locations you add
  yourself (label, address, latitude/longitude).
- **Your gear inventory** — the clothing, shoes, umbrellas, and vehicles you
  add, including any photos you take or choose for them.
- **Journey history** — the trips you plan, their weather conditions at the
  time, and the gear recommendation given for each one.
- **Feedback you give** — the "too warm / too cold / just right" ratings
  used to calibrate future recommendations to how you personally run warm
  or cold.

We do not collect your name, email, or any account identifier — there is no
account.

## Where it's stored

Everything above is stored **only on your device**, in a local SQLite
database. It is not encrypted at rest (this is a single-user local app, and
the data — home/work addresses and gear inventory — is personal but not
high-sensitivity: no payment details, no linked accounts). Nothing is
uploaded to a server we run, because we don't run one.

You control your own backups: the **Export my data** action in Settings
bundles your gear, locations, journey history, and calibration state
(including any gear photos) into a single file you choose where to save or
share. **Import data** restores from that same file. Your phone's own
OS-level backup (iCloud/iTunes on iOS, Auto Backup on Android) may also
include this data as part of your regular device backup, the same as any
other app's local data.

## Who else sees it

To do its job, the app sends specific pieces of data to three third-party
services, and to no one else:

- **Google Routes API** — receives the coordinates of your journey's
  origin, destination, and any stops, to compute a route.
- **Open-Meteo** — receives coordinates and a time, to return a weather
  forecast. Open-Meteo requires no account and needs no personal
  identifier to answer this request.
- **Auckland Transport GTFS Realtime** — receives a route/stop identifier
  to return live bus/train delay information.

Each of these receives only the coordinates and timestamps needed to answer
that specific request — never your gear inventory, journey history, or
feedback. We do not use any advertising network or third-party analytics
SDK, and nothing is sold or shared beyond the three requests above.

## Crash reporting

Off by default. No crash-reporting SDK initializes and no data leaves your
device unless you explicitly turn it on, either during onboarding or later
in Settings — and you can turn it back off at any time. When enabled, crash
reports are scrubbed of your saved-location labels and coordinates before
being sent; a stack trace doesn't need your home address to be useful for
fixing a bug.

## Regional scope

v1 is built for Auckland, New Zealand's public transit system and
Southern Hemisphere seasons specifically — it is not intended for use
outside that region.

## Changes to this policy

If what the app collects or who it's shared with changes in a future
version, this page will be updated to match before that version ships.
