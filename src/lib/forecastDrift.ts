// §5.2 — forecast drift re-check. Re-fetches weather for a still-upcoming
// Journey's outdoor legs and, only if the recomputed recommendation
// actually differs, updates the stored legs and re-schedules the leave-by
// notification with copy that leads with what changed (§7.3).
//
// No native background-fetch task (expo-task-manager + expo-background-
// fetch) is wired for the 3h/30min OS-scheduled checks §5.2 describes —
// same category of Expo-managed-workflow gap already logged in
// DECISIONS.md for §7.3/§7.4/Phase 8 (freeze/recordWear via listener +
// fallback, not a background task). This module instead runs the
// "foreground check on app open" §5.2 already calls for as a supplement,
// wired from App.tsx's AppState listener and Journey Detail's focus effect
// — not a substitute for the OS-scheduled checks, which need that same
// native extension to implement for real.
import { decodePolyline } from "./annotations";
import { getForecast } from "../services/weatherService";
import { recommendGear, type Recommendation } from "./recommend";
import { scheduleLeaveByNotification } from "./notifications";
import { updateJourney } from "../db/repositories/journeys";
import { listClothing } from "../db/repositories/clothing";
import { listShoes } from "../db/repositories/shoes";
import { listUmbrellas } from "../db/repositories/umbrellas";
import { getWarmthCalibration } from "../db/repositories/calibration";
import { getCarryPreferenceDefault } from "../db/repositories/settings";
import { getAdvancedThresholds } from "../db/repositories/advancedThresholds";
import type { Journey, JourneyLeg } from "../types";

// §3.4/§5.5 reuses decodePolyline for annotation matching against a leg's
// full route; a drift re-check only needs one representative point per leg,
// so this takes the polyline's midpoint (or, for a polyline-less stationary
// wait leg, the same "borrow the next leg's first point" convention
// applyAnnotationsToLegs already uses).
function legPoint(legs: JourneyLeg[], index: number): { lat: number; lng: number } | null {
  const leg = legs[index];
  if (leg.polyline) {
    const points = decodePolyline(leg.polyline);
    if (points.length === 0) return null;
    return points[Math.floor(points.length / 2)];
  }
  if (leg.isStationary) {
    const nextPolyline = legs[index + 1]?.polyline;
    const nextPoints = nextPolyline ? decodePolyline(nextPolyline) : [];
    if (nextPoints.length > 0) return nextPoints[0];
  }
  return null;
}

async function loadRecommendGearInputs(journey: Journey) {
  const [clothing, shoes, umbrellas, calibration, carryPreferenceDefault, thresholds] = await Promise.all([
    listClothing(),
    listShoes(),
    listUmbrellas(),
    getWarmthCalibration(),
    getCarryPreferenceDefault(),
    getAdvancedThresholds(),
  ]);
  return {
    inventory: { clothing, shoes, umbrellas },
    calibration,
    carryPreference: journey.carryPreference ?? carryPreferenceDefault,
    thresholds,
  };
}

function pickName(pick: Recommendation["shoes"] | Recommendation["umbrella"] | Recommendation["layers"][number] | undefined): string | null {
  if (!pick) return null;
  return "id" in pick ? pick.id : pick.fallbackText;
}

// §5.2 point 2 — "enough to flip the recommendation output": a different
// layer/bottoms/umbrella pick. Compares recommendGear()'s resolved output
// directly rather than re-deriving warmthLevel/acContrast a second time, so
// this can never drift out of sync with whatever the engine actually
// decided.
function recommendationsDiffer(a: Recommendation, b: Recommendation): boolean {
  const namesOf = (r: Recommendation) => [...r.layers.map(pickName), pickName(r.bottoms), pickName(r.umbrella)];
  const an = namesOf(a);
  const bn = namesOf(b);
  return an.length !== bn.length || an.some((v, i) => v !== bn[i]);
}

export interface DriftCheckResult {
  changed: boolean;
  journey: Journey;
}

// Re-fetches weather for every outdoor leg with a resolvable point,
// recomputes the recommendation, and only writes/notifies if it actually
// changed (§5.2 point 4 — "if nothing material changed, don't notify
// again... silently refresh the stored data"). No-ops for a past journey or
// one with nothing to sample (no polyline data yet, or a failed re-fetch —
// §5.1's "leave the stored snapshot as-is" precedent).
export async function checkForecastDrift(journey: Journey): Promise<DriftCheckResult> {
  if (new Date(journey.departTime).getTime() <= Date.now()) return { changed: false, journey };

  const points: { legIndex: number; lat: number; lng: number; time: string }[] = [];
  journey.legs.forEach((leg, i) => {
    if (!leg.outdoor || !leg.weather) return;
    const point = legPoint(journey.legs, i);
    if (point) points.push({ legIndex: i, ...point, time: leg.weather.time });
  });
  if (points.length === 0) return { changed: false, journey };

  const weatherResult = await getForecast(points.map(({ lat, lng, time }) => ({ lat, lng, time })));
  if (!("data" in weatherResult)) return { changed: false, journey };

  const { inventory, calibration, carryPreference, thresholds } = await loadRecommendGearInputs(journey);
  const before = recommendGear(journey, inventory, calibration, carryPreference, thresholds);

  const nextLegs = journey.legs.map((leg) => ({ ...leg }));
  points.forEach((p, i) => {
    nextLegs[p.legIndex].weather = weatherResult.data[i];
  });
  const nextJourney: Journey = { ...journey, legs: nextLegs };
  const after = recommendGear(nextJourney, inventory, calibration, carryPreference, thresholds);

  await updateJourney(nextJourney);

  if (!recommendationsDiffer(before, after)) {
    return { changed: false, journey: nextJourney };
  }

  await scheduleLeaveByNotification(nextJourney, after, { changed: true });
  return { changed: true, journey: nextJourney };
}
