# Store listing copy (draft)

Per `docs/10-production-readiness.md` §10.4 — leads with the differentiator
("recommends your actual jacket, not generic advice") rather than a generic
weather-app feature list, and states the Auckland/transit scope up front
rather than leaving it as a post-download surprise.

## App Store (iOS)

**Subtitle** (30 char limit):
> Your gear, your commute

**Promotional text** (170 char limit, editable without a new build):
> Not "wear a jacket" — *your navy rain shell, size M, in the hall closet.*
> Plans your Auckland commute and tells you exactly what to grab.

**Description:**

> Commute Weather Planner doesn't tell you it's going to rain and leave the
> rest to you. It looks at your actual wardrobe — the jacket you own, the
> shoes with actual grip, the umbrella rated for actual wind — and tells
> you which one to grab, leg by leg, for the walk/bus/drive you're about to
> take.
>
> Add your gear once. From then on, every journey you plan gets a specific
> recommendation built from what's really in your closet, not a generic
> "layer up" notice — plus a heads-up if your umbrella's not rated for
> today's gusts, or if the office AC means that jacket you're carrying is
> overkill once you're inside.
>
> Built for Auckland: real Auckland Transport bus/train delays, real
> Southern Hemisphere seasons, and weather tuned for how Auckland actually
> feels (windy, humid, changeable) — not a generic global weather feed.
>
> • Plans walking, cycling, driving, and public transit journeys, including
>   multi-leg trips with stops along the way
> • Recommends specific owned items — jacket, midlayer, shoes, umbrella,
>   accessories — not generic advice
> • Learns from your feedback: tell it you ran cold and it adjusts, for
>   good, separately for winter and summer
> • Leave-by notifications that account for live transit delays
> • Local knowledge: mark a windy corner or a sun-exposed stretch once, and
>   every future recommendation accounts for it
> • Your data stays on your device — export/import any time, no account
>   required
>
> Currently Auckland-only (public transit coverage and season detection are
> both scoped to the region) and built for one person's wardrobe.

## Google Play

**Short description** (80 char limit):
> Auckland commute planner that recommends YOUR jacket, shoes & umbrella.

**Full description:** same as the App Store description above (Play has no
separate "promotional text" field, and its 4000-char limit comfortably fits
the full copy).

## Notes for whoever submits

- Both stores require screenshots sized per-device; take these from a real
  build once one exists, not mocked here.
- The Auckland-only / single-user scope statement in the description isn't
  optional copy — see `docs/10-production-readiness.md` §10.4: a reviewer
  or user expecting nationwide transit support and not getting it reads as
  a 1-star review, not a bug report.
- Update this file if the feature set changes materially before submission
  (e.g. Phase 13+ features ship) — this draft reflects the app through
  Phase 12.
