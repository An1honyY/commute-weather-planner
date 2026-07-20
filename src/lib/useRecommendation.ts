import { useEffect, useState } from "react";
import { recommendGear, type Recommendation } from "./recommend";
import { listClothing } from "../db/repositories/clothing";
import { listShoes } from "../db/repositories/shoes";
import { listUmbrellas } from "../db/repositories/umbrellas";
import { getWarmthCalibration } from "../db/repositories/calibration";
import { getCarryPreferenceDefault } from "../db/repositories/settings";
import { getAdvancedThresholds } from "../db/repositories/advancedThresholds";
import type { Journey } from "../types";

// Shared data-loading for recommendGear()'s non-Journey inputs (Inventory,
// WarmthCalibration, the resolved CarryPreference, AdvancedWarmthThresholds)
// — used by both Journey Detail's gear card and Today's compact journey
// cards (docs/08-build-phases.md Phase 5), so the fetch-then-compute
// sequence exists in exactly one place.
export function useRecommendation(journey: Journey | null | undefined): Recommendation | null {
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Nested so every setState call happens inside an async callback, not
    // synchronously in the effect body itself (react-hooks/set-state-in-effect).
    async function load() {
      if (!journey) {
        setRecommendation(null);
        return;
      }
      const [clothing, shoes, umbrellas, calibration, carryPreferenceDefault, thresholds] = await Promise.all([
        listClothing(),
        listShoes(),
        listUmbrellas(),
        getWarmthCalibration(),
        getCarryPreferenceDefault(),
        getAdvancedThresholds(),
      ]);
      if (cancelled) return;
      const carryPreference = journey.carryPreference ?? carryPreferenceDefault;
      setRecommendation(recommendGear(journey, { clothing, shoes, umbrellas }, calibration, carryPreference, thresholds));
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [journey]);

  return recommendation;
}
