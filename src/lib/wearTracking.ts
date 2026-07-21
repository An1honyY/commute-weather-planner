// §7.16 — wardrobe rotation & wash reminders, and the RecommendationSnapshot
// freeze mapping. Called once per Journey at leave-by time (src/lib/leaveBy.ts),
// never from inside recommendGear() itself — recommendGear() must stay a
// pure function with no I/O (docs/11-testing-strategy.md §11.1) and can
// legitimately be called many times against the same still-future Journey
// (re-planning, forecast-drift refreshes) without each call counting as a
// real-world "wear."
import { updateClothingWearTracking } from "../db/repositories/clothing";
import { updateShoeWearTracking } from "../db/repositories/shoes";
import {
  totalOutdoorExertionMinutes,
  WARMUP_CYCLE_MIN_MINUTES,
  WARMUP_WALK_MIN_MINUTES,
  WASH_REMINDER_WEAR_COUNT,
  type LayerPick,
  type Recommendation,
} from "./recommend";
import type { ClothingItem, Journey, RecommendationSnapshot, ShoeItem } from "../types";

function isRealClothing(pick: LayerPick | undefined): pick is ClothingItem {
  return !!pick && "id" in pick;
}

// Structural, not LayerPick-typed — also called with Recommendation.shoes/
// .umbrella, which resolve to ShoeItem/UmbrellaItem (not ClothingItem) on
// the "real item" side of their own fallback unions.
function pickName(pick: { id: string; name: string } | { fallbackText: string } | undefined): string | null {
  if (!pick) return null;
  return "id" in pick ? pick.name : pick.fallbackText;
}

// Reuses the exact same exertion signals already computed for the warmup
// discount (§7.9) — sustained walking/cycling exertion in warm-enough
// conditions is the same "you probably worked up a sweat" proxy either way.
export function isSweatyConditions(journey: Journey, warmOutdoorC: number): boolean {
  const walkingMinutes = totalOutdoorExertionMinutes(journey, "walk");
  const cyclingMinutes = totalOutdoorExertionMinutes(journey, "cycle");
  const hasWarmOutdoor = journey.legs.some((l) => l.outdoor && l.weather && l.weather.apparentTempC >= warmOutdoorC);
  return hasWarmOutdoor && (walkingMinutes >= WARMUP_WALK_MIN_MINUTES || cyclingMinutes >= WARMUP_CYCLE_MIN_MINUTES);
}

// `warmOutdoorC` is passed in rather than re-read from the raw named
// constant, so a user's AdvancedWarmthThresholds override (§3.6) is
// respected here the same way it already is inside recommendGear() — the
// leave-by call site already has this resolved value on hand.
export async function recordWear(recommendation: Recommendation, journey: Journey, warmOutdoorC: number): Promise<void> {
  // Accessories (other than socks) and umbrellas are deliberately excluded
  // — see §7.16 for why. A sock-tagged accessory is the one exception: it's
  // a real recommended item that needs washing as often as a base layer.
  const clothingItems: ClothingItem[] = [
    ...(isRealClothing(recommendation.bottoms) ? [recommendation.bottoms] : []),
    ...recommendation.layers.filter(isRealClothing),
    ...recommendation.accessories.filter(isRealClothing).filter((c) => c.tags?.includes("socks")),
  ];
  const shoeItem: ShoeItem | undefined =
    recommendation.shoes && "id" in recommendation.shoes ? recommendation.shoes : undefined;

  const sweaty = isSweatyConditions(journey, warmOutdoorC);

  for (const item of clothingItems) {
    const wearsSinceClean = (item.wearsSinceClean ?? 0) + 1;
    await updateClothingWearTracking(item.id, {
      wearsSinceClean,
      lastWornAt: journey.departTime,
      needsCleaning: sweaty || wearsSinceClean >= WASH_REMINDER_WEAR_COUNT,
    });
  }
  if (shoeItem) {
    const wearsSinceClean = (shoeItem.wearsSinceClean ?? 0) + 1;
    await updateShoeWearTracking(shoeItem.id, {
      wearsSinceClean,
      lastWornAt: journey.departTime,
      needsCleaning: sweaty || wearsSinceClean >= WASH_REMINDER_WEAR_COUNT,
    });
  }
}

// §3 — flattens the live Recommendation (real items or fallback text) down
// into RecommendationSnapshot's display-only shape for History to read
// without re-running the live engine against inventory that may have since
// changed.
export function toRecommendationSnapshot(recommendation: Recommendation): RecommendationSnapshot {
  return {
    layerNames: recommendation.layers.map((l) => pickName(l) ?? "Unknown layer"),
    accessoryNames: recommendation.accessories.map((a) => pickName(a) ?? "Unknown accessory"),
    shoeName: pickName(recommendation.shoes),
    umbrellaName: pickName(recommendation.umbrella),
    notes: recommendation.notes,
    snapshotAt: new Date().toISOString(),
  };
}
