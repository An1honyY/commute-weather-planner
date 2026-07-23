import type { EnvironmentEffectType } from "../../types";

// Shared label/copy per EnvironmentEffectType — used by the annotation
// form's effect picker (§4.5), the Local knowledge list rows, and Journey
// Detail's leg annotation line. Six options: the original five plus
// high-reflection (docs/08-build-phases.md Phase 6). The icon glyph itself
// now lives in EffectIcon.tsx (UI/UX polish pass 2, real SVG instead of
// emoji) — its keys are the same EnvironmentEffectType values, so callers
// just pass the effect type straight through rather than reading an
// `icon` field here.
export const EFFECT_META: Record<
  EnvironmentEffectType,
  { label: string; placeholder: string }
> = {
  "wind-tunnel": {
    label: "Wind tunnel",
    placeholder: "Name this spot… (e.g. 'Queen St wind tunnel')",
  },
  "wind-sheltered": {
    label: "Wind-sheltered",
    placeholder: "Name this spot… (e.g. 'Sheltered side street')",
  },
  "rain-cover": {
    label: "Rain cover",
    placeholder: "Name this spot… (e.g. 'Britomart arcade')",
  },
  "sun-exposed": {
    label: "Sun-exposed",
    placeholder: "Name this spot… (e.g. 'Shadeless waterfront stretch')",
  },
  shaded: {
    label: "Shaded",
    placeholder: "Name this spot… (e.g. 'Albert Park tree cover')",
  },
  "high-reflection": {
    label: "High reflection",
    placeholder: "Name this spot… (e.g. 'Mission Bay sand & water')",
  },
};

export const EFFECT_OPTIONS = Object.keys(EFFECT_META) as EnvironmentEffectType[];

// Map-marker-only emoji — JourneyMap.tsx/.web.tsx render a native Marker
// child / a Leaflet HTML-string icon respectively, where embedding a real
// EffectIcon SVG is materially more work for a small pin glyph than it's
// worth this pass; every other consumer (Local knowledge list, the
// annotation picker, LegRow's leg annotation chips) uses the real
// EffectIcon component instead. See DECISIONS.md.
export const EFFECT_MARKER_EMOJI: Record<EnvironmentEffectType, string> = {
  "wind-tunnel": "🌬️",
  "wind-sheltered": "🏘️",
  "rain-cover": "☂️",
  "sun-exposed": "☀️",
  shaded: "🌳",
  "high-reflection": "🏖️",
};
