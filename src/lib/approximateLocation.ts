import * as Location from "expo-location";
import { getDefaultLocation } from "../db/repositories/settings";

// Shared "where roughly is the user" resolution — device GPS (only if
// permission is already granted; never prompts on its own) → onboarding's
// saved default location → Auckland. Originally inlined in useRightNow.ts
// (Today's weather card); pulled out here so LocationPickerMap can seed its
// pin from the same chain instead of always starting at the hardcoded
// Auckland fallback regardless of what's actually knowable. IP-based
// geolocation was considered as an extra fallback ahead of Auckland but
// rejected — there's no way to resolve an IP to a location without an
// external service or a bundled geo-IP database, and GPS (already covered
// here) is strictly more accurate than either would be — see DECISIONS.md.
export const AUCKLAND = { lat: -36.8485, lng: 174.7633 };

export interface ApproximateLocation {
  lat: number;
  lng: number;
  isFallback: boolean;
}

// (0, 0) — "Null Island," a point in the Gulf of Guinea — is never a
// legitimate real-world commute location. Some browsers/WebViews resolve
// geolocation with exactly this instead of rejecting when the underlying
// location provider fails silently (observed in practice: permission
// reported "granted" with a stubbed (0,0) fix), and a value like that can
// end up persisted as `default_location` from an earlier such resolution.
// Treated as "no location," not a real fix, at every step of the chain.
export function isNullIsland(lat: number, lng: number): boolean {
  return lat === 0 && lng === 0;
}

export async function resolveApproximateLocation(): Promise<ApproximateLocation> {
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (permission.granted) {
      const position = await Location.getCurrentPositionAsync({});
      const { latitude: lat, longitude: lng } = position.coords;
      if (!isNullIsland(lat, lng)) {
        return { lat, lng, isFallback: false };
      }
    }
  } catch {
    // GPS unavailable/denied mid-flow — fall through to the saved default
  }
  try {
    const defaultLocation = await getDefaultLocation();
    if (defaultLocation && !isNullIsland(defaultLocation.lat, defaultLocation.lng)) {
      return { lat: defaultLocation.lat, lng: defaultLocation.lng, isFallback: false };
    }
  } catch {
    // fall through to Auckland
  }
  return { ...AUCKLAND, isFallback: true };
}
