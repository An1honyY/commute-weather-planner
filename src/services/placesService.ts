// Google Places API (New) — Autocomplete + Place Details, docs/02-external-
// apis.md §2's "Address search / autocomplete" row. Reuses the same
// EXPO_PUBLIC_GOOGLE_ROUTES_API_KEY as routesService.ts rather than a
// second env var — Google Cloud API keys are project-scoped, not
// single-API, so the same key just needs "Places API (New)" enabled
// alongside "Routes API" in the same GCP project (docs/02-external-apis.md
// §2 notes this explicitly). No key configured is treated the same as
// routesService's "unreachable" — AddressAutocomplete falls back to a
// plain text field rather than surfacing an error.
import type { ServiceResult } from "./types";

export interface PlaceSuggestion {
  placeId: string;
  primaryText: string;
  secondaryText: string;
}

export interface PlaceLocation {
  lat: number;
  lng: number;
  formattedAddress: string;
}

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const PLACE_DETAILS_URL = "https://places.googleapis.com/v1/places";
// Reverse geocoding (lat/lng -> address) has no equivalent in Places API
// (New) — it's still the older Geocoding API, a different host/response
// shape, but the same GCP project/key (needs "Geocoding API" enabled
// alongside "Places API (New)" and "Routes API"). Only used by
// LocationPickerMap's confirm step, to fill in a human-readable address
// for a dropped pin rather than leaving the label blank.
const REVERSE_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

function apiKey(): string | undefined {
  return process.env.EXPO_PUBLIC_GOOGLE_ROUTES_API_KEY;
}

export function hasPlacesApiKey(): boolean {
  return !!apiKey();
}

// One token per autocomplete session (first keystroke through the details
// call that follows a selection) — Google bills a session of autocomplete
// requests + its one details call as a single unit when a token is shared
// across them, instead of per-request. AddressAutocomplete creates one via
// this and reuses it until a suggestion is picked.
export function newSessionToken(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface GoogleAutocompleteSuggestion {
  placePrediction?: {
    placeId?: string;
    structuredFormat?: {
      mainText?: { text?: string };
      secondaryText?: { text?: string };
    };
    text?: { text?: string };
  };
}
interface GoogleAutocompleteResponse {
  suggestions?: GoogleAutocompleteSuggestion[];
}

export async function autocompletePlaces(input: string, sessionToken: string): Promise<ServiceResult<PlaceSuggestion[]>> {
  const key = apiKey();
  if (!key) return { error: "unreachable" };
  if (!input.trim()) return { data: [] };

  let response: Response;
  try {
    response = await fetch(AUTOCOMPLETE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
      body: JSON.stringify({
        input,
        sessionToken,
        // §2.1 — v1 is Auckland-only; biasing (not restricting) results to
        // NZ keeps the advanced/manual lat-lng override usable for anyone
        // who genuinely needs a non-NZ address.
        includedRegionCodes: ["nz"],
      }),
    });
  } catch {
    return { error: "network" };
  }

  if (!response.ok) {
    return { error: response.status === 429 ? "rate-limited" : "unreachable" };
  }

  let payload: GoogleAutocompleteResponse;
  try {
    payload = await response.json();
  } catch {
    return { error: "unreachable" };
  }

  const suggestions = (payload.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => !!p && !!p.placeId)
    .map((p) => ({
      placeId: p.placeId as string,
      primaryText: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      secondaryText: p.structuredFormat?.secondaryText?.text ?? "",
    }));

  return { data: suggestions };
}

interface GooglePlaceDetailsResponse {
  location?: { latitude?: number; longitude?: number };
  formattedAddress?: string;
}

export async function getPlaceLocation(placeId: string, sessionToken: string): Promise<ServiceResult<PlaceLocation>> {
  const key = apiKey();
  if (!key) return { error: "unreachable" };

  let response: Response;
  try {
    response = await fetch(`${PLACE_DETAILS_URL}/${encodeURIComponent(placeId)}?sessionToken=${sessionToken}`, {
      headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "location,formattedAddress" },
    });
  } catch {
    return { error: "network" };
  }

  if (!response.ok) {
    return { error: response.status === 429 ? "rate-limited" : "unreachable" };
  }

  let payload: GooglePlaceDetailsResponse;
  try {
    payload = await response.json();
  } catch {
    return { error: "unreachable" };
  }

  if (payload.location?.latitude === undefined || payload.location?.longitude === undefined) {
    return { error: "unreachable" };
  }

  return {
    data: {
      lat: payload.location.latitude,
      lng: payload.location.longitude,
      formattedAddress: payload.formattedAddress ?? "",
    },
  };
}

interface GoogleGeocodeAddressComponent {
  long_name?: string;
  short_name?: string;
  types?: string[];
}
interface GoogleGeocodeResult {
  formatted_address?: string;
  address_components?: GoogleGeocodeAddressComponent[];
}
interface GoogleGeocodeResponse {
  status?: string;
  results?: GoogleGeocodeResult[];
}

async function fetchReverseGeocode(lat: number, lng: number): Promise<ServiceResult<GoogleGeocodeResult>> {
  const key = apiKey();
  if (!key) return { error: "unreachable" };

  let response: Response;
  try {
    response = await fetch(`${REVERSE_GEOCODE_URL}?latlng=${lat},${lng}&key=${key}`);
  } catch {
    return { error: "network" };
  }

  if (!response.ok) {
    return { error: response.status === 429 ? "rate-limited" : "unreachable" };
  }

  let payload: GoogleGeocodeResponse;
  try {
    payload = await response.json();
  } catch {
    return { error: "unreachable" };
  }

  if (payload.status === "OVER_QUERY_LIMIT") return { error: "rate-limited" };
  const result = payload.results?.[0];
  if (!result?.formatted_address) return { error: "unreachable" };

  return { data: result };
}

export async function reverseGeocode(lat: number, lng: number): Promise<ServiceResult<{ formattedAddress: string }>> {
  const result = await fetchReverseGeocode(lat, lng);
  if ("error" in result) return result;
  return { data: { formattedAddress: result.data.formatted_address! } };
}

// The "Right now" card (§4.2) shows a short place name rather than a full
// street address — pulls the suburb-level component (`sublocality`, or
// `locality` when there's no finer-grained suburb, e.g. a smaller town)
// from the same Geocoding response `reverseGeocode()` already fetches,
// rather than a second call. Falls back to the first comma-separated
// segment of the formatted address if neither component type is present
// (observed to happen for some rural/edge-of-region points).
export async function reverseGeocodeSuburb(lat: number, lng: number): Promise<ServiceResult<{ suburb: string }>> {
  const result = await fetchReverseGeocode(lat, lng);
  if ("error" in result) return result;

  const components = result.data.address_components ?? [];
  const bySuburb = components.find((c) => c.types?.includes("sublocality") || c.types?.includes("sublocality_level_1"));
  const byLocality = components.find((c) => c.types?.includes("locality"));
  const suburb = bySuburb?.long_name ?? byLocality?.long_name ?? result.data.formatted_address!.split(",")[0].trim();

  return { data: { suburb } };
}
