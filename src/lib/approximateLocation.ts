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

export async function resolveApproximateLocation(): Promise<ApproximateLocation> {
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (permission.granted) {
      const position = await Location.getCurrentPositionAsync({});
      return { lat: position.coords.latitude, lng: position.coords.longitude, isFallback: false };
    }
    const defaultLocation = await getDefaultLocation();
    if (defaultLocation) {
      return { lat: defaultLocation.lat, lng: defaultLocation.lng, isFallback: false };
    }
  } catch {
    // fall through to Auckland
  }
  return { ...AUCKLAND, isFallback: true };
}
