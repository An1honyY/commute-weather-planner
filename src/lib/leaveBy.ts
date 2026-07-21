// §7.3 — orchestrates the leave-by notification schedule/reschedule and the
// RecommendationSnapshot freeze + recordWear() that fire at the same
// leave-by moment (§3, §7.16). This is the single place that loads
// recommendGear()'s non-Journey inputs and calls it outside of a React
// hook, so both src/lib/planJourney.ts (fresh plans + Today materialization)
// and a screen's fallback/notification-fired path share one implementation.
import { recommendGear, WARM_OUTDOOR_C, type Recommendation } from "./recommend";
import { recordWear, toRecommendationSnapshot } from "./wearTracking";
import { scheduleLeaveByNotification, LEAVE_BY_LEAD_MINUTES } from "./notifications";
import { withTimeout } from "./withTimeout";
import { getJourney, updateJourney } from "../db/repositories/journeys";
import { listClothing } from "../db/repositories/clothing";
import { listShoes } from "../db/repositories/shoes";
import { listUmbrellas } from "../db/repositories/umbrellas";
import { getWarmthCalibration } from "../db/repositories/calibration";
import { getCarryPreferenceDefault } from "../db/repositories/settings";
import { getAdvancedThresholds } from "../db/repositories/advancedThresholds";
import type { Journey } from "../types";

async function computeRecommendationFor(journey: Journey): Promise<{ recommendation: Recommendation; warmOutdoorC: number }> {
  const [clothing, shoes, umbrellas, calibration, carryPreferenceDefault, thresholds] = await Promise.all([
    listClothing(),
    listShoes(),
    listUmbrellas(),
    getWarmthCalibration(),
    getCarryPreferenceDefault(),
    getAdvancedThresholds(),
  ]);
  const carryPreference = journey.carryPreference ?? carryPreferenceDefault;
  const recommendation = recommendGear(journey, { clothing, shoes, umbrellas }, calibration, carryPreference, thresholds);
  // Same resolution recommendGear() applies internally (§3.6) — recordWear()
  // needs this exact value, but recommendGear() doesn't return its resolved
  // thresholds, so it's re-derived identically here rather than duplicated
  // ad hoc at each call site.
  const warmOutdoorC = thresholds.warmOutdoorC ?? WARM_OUTDOOR_C;
  return { recommendation, warmOutdoorC };
}

function leaveByTriggerMs(journey: Journey): number {
  return new Date(journey.departTime).getTime() - LEAVE_BY_LEAD_MINUTES * 60_000;
}

// Called from src/lib/planJourney.ts right after a Journey's weather/legs
// are (re)computed and persisted — covers initial planning, recurring-
// occurrence materialization, and Phase 7's live-delay updates (applied
// earlier in that same planJourney() call). Never throws — a notification
// failing to schedule shouldn't fail the plan itself.
export async function scheduleForJourney(journey: Journey): Promise<void> {
  try {
    const { recommendation } = await computeRecommendationFor(journey);
    await scheduleLeaveByNotification(journey, recommendation);
  } catch (error) {
    console.warn("scheduleForJourney: failed to schedule leave-by notification", error);
  }
}

// The freeze point itself (§3, §7.3, §7.16): once leave-by time has passed
// and no snapshot exists yet, compute the (by-now-final) Recommendation one
// last time, freeze it, and record wear against the same resolved
// warmOutdoorC used to compute it. Idempotent — a Journey that already has
// a recommendationSnapshot is left untouched, since recordWear() must only
// ever fire once per Journey. Two triggers call this: the notification-
// fired listener (App.tsx, real leave-by time) and a fallback check on
// Journey Detail load, matching RecommendationSnapshot's own doc comment
// ("frozen at leave-by time, or on first History view of a past journey
// missing one") for the case a scheduled notification never actually fired
// (app killed, permission revoked, etc.).
export async function freezeIfDue(journey: Journey): Promise<Journey> {
  if (journey.recommendationSnapshot) return journey;
  if (Date.now() < leaveByTriggerMs(journey)) return journey;

  return withTimeout(
    (async () => {
      const { recommendation, warmOutdoorC } = await computeRecommendationFor(journey);
      await recordWear(recommendation, journey, warmOutdoorC);
      const updated: Journey = { ...journey, recommendationSnapshot: toRecommendationSnapshot(recommendation) };
      await updateJourney(updated);
      return updated;
    })(),
    journey
  );
}

// Convenience for the notification-fired listener (App.tsx), which only
// has the journeyId from the notification payload, not the live Journey.
export async function freezeJourneyByIdIfDue(journeyId: string): Promise<void> {
  const journey = await getJourney(journeyId);
  if (!journey) return;
  await freezeIfDue(journey);
}
