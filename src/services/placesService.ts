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
