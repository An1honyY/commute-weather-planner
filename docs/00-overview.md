# 0. Overview — Commute Weather Planner

A React Native (Expo) app that plans a journey — walking, driving, cycling,
or public transit — overlays per-leg weather conditions, and recommends
specific items from the user's own wardrobe/gear (not generic advice) based
on route conditions and indoor climate exposure along the way (offices,
supermarkets, buses, trains). v1 is Auckland-only and single-user by design.
The core loop is: plan a journey → `classifyWeather()` scores each leg →
`recommendGear()` matches that against the user's actual inventory, their
personal warmth calibration, and any environment overrides — never a
generic "wear a coat" fallback when a better match exists in their closet.
