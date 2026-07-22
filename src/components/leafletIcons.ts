import L from "leaflet";

// Shared inline-SVG marker icons for both web maps (LocationPickerMap.web.tsx,
// JourneyMap.web.tsx) — no external marker-image assets, matching the
// reasoning LocationPickerMap.web.tsx's header comment already established.

export function pinDivIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "cwp-location-marker",
    html: `<svg width="30" height="30" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C7.6 2 4 5.6 4 10c0 5.6 7 11.5 7.3 11.7a1 1 0 0 0 1.4 0C13 21.5 20 15.6 20 10c0-4.4-3.6-8-8-8Z" fill="${color}" stroke="#FFFFFF" stroke-width="1.2"/><circle cx="12" cy="10" r="2.6" fill="#FFFFFF"/></svg>`,
    iconSize: [30, 30],
    iconAnchor: [15, 28],
  });
}

// Mirrors JourneyMap.tsx's native conditionMarker style: a 24px circular
// white-bordered badge holding a centered emoji.
export function conditionDivIcon(color: string, emoji: string): L.DivIcon {
  return L.divIcon({
    className: "cwp-condition-marker",
    html: `<div style="width:24px;height:24px;border-radius:12px;background:${color};border:2px solid #FFFFFF;display:flex;align-items:center;justify-content:center;font-size:12px;box-sizing:border-box;">${emoji}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}
