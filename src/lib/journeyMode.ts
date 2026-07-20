import type { JourneyLeg, TravelMode } from "../types";

// A journey's dominant mode, not just its first leg — a bus/train trip's
// first leg is usually a short walk-to-stop connector (mockJourney/
// planJourney insert these around the transit leg itself), which
// shouldn't be read as "this is a walking trip." Shared by Journey
// Detail's map accent and Today's recurring-journey materialization
// (needs a mode to re-plan with, since Journey itself has no top-level
// mode field — it's implied by its legs).
const MODE_PRIORITY: TravelMode[] = ["bus", "train", "drive", "cycle", "walk"];

export function dominantMode(legs: JourneyLeg[]): TravelMode {
  return MODE_PRIORITY.find((mode) => legs.some((l) => l.mode === mode)) ?? "walk";
}
