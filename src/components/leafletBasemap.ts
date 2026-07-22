// Shared tile-provider config for both web maps (LocationPickerMap.web.tsx,
// JourneyMap.web.tsx) — CARTO's free, keyless basemap tiles instead of raw
// OpenStreetMap "Standard" tiles, which read as busy/dated next to this
// app's own clean UI. Voyager (light) / Dark Matter (dark) swap with the
// app's own theme, same free-tier posture the plain-OSM tiles already
// relied on (no API key, same "reasonable use" expectation) — see
// DECISIONS.md.
const ATTRIBUTION =
  '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export interface Basemap {
  url: string;
  attribution: string;
  isDark: boolean;
}

export function basemapFor(isDark: boolean): Basemap {
  return {
    url: isDark
      ? "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: ATTRIBUTION,
    isDark,
  };
}
