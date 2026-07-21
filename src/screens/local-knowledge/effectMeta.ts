import type { EnvironmentEffectType } from "../../types";

// Shared icon/label/copy per EnvironmentEffectType — used by the annotation
// form's effect picker (§4.5), the Local knowledge list rows, and Journey
// Detail's leg annotation line. Six options: the original five plus
// high-reflection (docs/08-build-phases.md Phase 6).
export const EFFECT_META: Record<
  EnvironmentEffectType,
  { icon: string; label: string; placeholder: string }
> = {
  "wind-tunnel": {
    icon: "🌬️",
    label: "Wind tunnel",
    placeholder: "Name this spot… (e.g. 'Queen St wind tunnel')",
  },
  "wind-sheltered": {
    icon: "🏘️",
    label: "Wind-sheltered",
    placeholder: "Name this spot… (e.g. 'Sheltered side street')",
  },
  "rain-cover": {
    icon: "☂️",
    label: "Rain cover",
    placeholder: "Name this spot… (e.g. 'Britomart arcade')",
  },
  "sun-exposed": {
    icon: "☀️",
    label: "Sun-exposed",
    placeholder: "Name this spot… (e.g. 'Shadeless waterfront stretch')",
  },
  shaded: {
    icon: "🌳",
    label: "Shaded",
    placeholder: "Name this spot… (e.g. 'Albert Park tree cover')",
  },
  "high-reflection": {
    icon: "🏖️",
    label: "High reflection",
    placeholder: "Name this spot… (e.g. 'Mission Bay sand & water')",
  },
};

export const EFFECT_OPTIONS = Object.keys(EFFECT_META) as EnvironmentEffectType[];
