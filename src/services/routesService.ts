// Google Routes API (routes.googleapis.com/directions/v2:computeRoutes) —
// docs/02-external-apis.md §2. Wired for real in Phase 4
// (docs/08-build-phases.md), including passing Journey.waypoints as
// `intermediates` (docs/05-data-wiring.md §5.5). This is the Phase 1 seam:
// one module, one typed result shape, so screens never touch fetch directly
// and Phase 4 has exactly one place to fill in.
import type { ServiceResult } from "./types";

export interface RouteLegResult {
  mode: string;
  durationMin: number;
  polyline: string;
}

export interface ComputeRouteParams {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  mode: "walk" | "drive" | "bus" | "train" | "cycle";
  waypoints?: { lat: number; lng: number }[]; // §5.5 — passed as `intermediates`
  departTime: string; // ISO
}

export async function computeRoute(
  _params: ComputeRouteParams
): Promise<ServiceResult<RouteLegResult[]>> {
  return { error: "unreachable" };
}
