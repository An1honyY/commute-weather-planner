// EnvironmentAnnotation → leg matching — docs/03-data-models.md §3.4 and
// docs/05-data-wiring.md §5.5. A simple point-radius check against the
// decoded polyline's points, not full polyline-geometry intersection —
// accurate enough for walking-scale annotations (tens to low-hundreds of
// meters) without pulling in a geometry library.
import type { EnvironmentAnnotation, JourneyLeg } from "../types";

export interface LatLng {
  lat: number;
  lng: number;
}

// Google's encoded polyline algorithm (precision 1e-5) — the same decode
// the map rendering needs (§9.3), kept here so annotation matching and the
// map read one implementation.
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    for (const axis of ["lat", "lng"] as const) {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === "lat") lat += delta;
      else lng += delta;
    }
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

const EARTH_RADIUS_M = 6_371_000;

export function distanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// The two effect categories where opposing annotations can conflict (§3.4:
// closer one wins); rain-cover and high-reflection are standalone booleans.
type Matched = { annotation: EnvironmentAnnotation; minDistanceM: number };

function closestOf(matches: Matched[]): EnvironmentAnnotation | undefined {
  return matches.sort((a, b) => a.minDistanceM - b.minDistanceM)[0]?.annotation;
}

export interface AnnotationStamps {
  windEffect?: JourneyLeg["windEffect"];
  sunEffect?: JourneyLeg["sunEffect"];
  highReflection?: boolean;
  rainCovered?: boolean;
  matchedAnnotationIds?: string[];
}

// §3.4 — match one leg's route points against every saved annotation.
// Same-category duplicates apply once (boolean, not additive); conflicting
// same-category matches resolve to the closer one; high-reflection is
// additive alongside sunEffect rather than competing with it.
export function matchAnnotationsToPoints(
  points: LatLng[],
  annotations: EnvironmentAnnotation[]
): AnnotationStamps {
  if (points.length === 0 || annotations.length === 0) return {};

  const matched: Matched[] = [];
  for (const annotation of annotations) {
    let minDistanceM = Infinity;
    for (const point of points) {
      const d = distanceMeters(point, { lat: annotation.lat, lng: annotation.lng });
      if (d < minDistanceM) minDistanceM = d;
    }
    if (minDistanceM <= annotation.radiusM) matched.push({ annotation, minDistanceM });
  }
  if (matched.length === 0) return {};

  const byEffect = (...effects: string[]) => matched.filter((m) => effects.includes(m.annotation.effect));
  const windWinner = closestOf(byEffect("wind-tunnel", "wind-sheltered"));
  const sunWinner = closestOf(byEffect("sun-exposed", "shaded"));

  return {
    windEffect: windWinner ? (windWinner.effect === "wind-tunnel" ? "amplified" : "sheltered") : undefined,
    sunEffect: sunWinner ? (sunWinner.effect === "sun-exposed" ? "exposed" : "shaded") : undefined,
    highReflection: byEffect("high-reflection").length > 0 || undefined,
    rainCovered: byEffect("rain-cover").length > 0 || undefined,
    matchedAnnotationIds: matched.map((m) => m.annotation.id),
  };
}

// §3.4/§5.5 — stamp every outdoor leg with a polyline, plus (§5.6 point 3,
// Phase 7) a stationary wait leg's single point. A wait leg has no polyline
// of its own, so its point is taken from the transit leg it precedes — that
// leg's own decoded polyline necessarily starts where the wait happened.
// Returns new leg objects (previous stamps cleared first) so a re-run after
// adding an annotation from Journey Detail (§4.5) reflects deletions/edits
// too.
export function applyAnnotationsToLegs(
  legs: JourneyLeg[],
  annotations: EnvironmentAnnotation[]
): JourneyLeg[] {
  return legs.map((leg, i) => {
    if (!leg.outdoor) return leg;

    let points: LatLng[] = [];
    if (leg.polyline) {
      points = decodePolyline(leg.polyline);
    } else if (leg.isStationary) {
      const nextPolyline = legs[i + 1]?.polyline;
      const nextPoints = nextPolyline ? decodePolyline(nextPolyline) : [];
      if (nextPoints.length > 0) points = [nextPoints[0]];
    }
    if (points.length === 0) return leg;

    const cleared: JourneyLeg = {
      ...leg,
      windEffect: undefined,
      sunEffect: undefined,
      highReflection: undefined,
      rainCovered: undefined,
      matchedAnnotationIds: undefined,
    };
    return { ...cleared, ...matchAnnotationsToPoints(points, annotations) };
  });
}
