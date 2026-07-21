// Gear recommendation engine — docs/07-recommendation-engine.md §7.
// Ported from the spec's reference implementation, including the §7.8
// annotation-gated wind/sun/reflection deltas and puddle-risk/rain-cover
// handling added in Phase 6 (their inputs — EnvironmentAnnotation matching
// and recentPrecipMm6h — exist from Phase 6's wiring in §5.5).
import { clamp } from "./utils";
import { acFeelsCold, classifyWeather, getSeason, resolveWarmthOffset } from "./weather";
import type {
  AdvancedWarmthThresholds,
  CarryPreference,
  ClothingItem,
  ClothingType,
  Journey,
  JourneyLeg,
  ShoeItem,
  UmbrellaItem,
  WarmthCalibration,
  WeatherSnapshot,
} from "../types";

export type LayerPick = ClothingItem | { fallbackText: string; layerType: ClothingType };

export interface Recommendation {
  layers: LayerPick[];
  bottoms?: LayerPick;
  accessories: LayerPick[];
  shoes?: ShoeItem | { fallbackText: string };
  umbrella?: UmbrellaItem | { fallbackText: string };
  severeWeatherAdvisory?: string;
  notes: string[];
}

export interface Inventory {
  clothing: ClothingItem[];
  shoes: ShoeItem[];
  umbrellas: UmbrellaItem[];
}

// ---- Named thresholds — tune these, don't touch control flow below ----
const FREEZING_C = 2;
const COOL_UPPER_C = 14;
const WARM_OUTDOOR_C = 18;
const WARMUP_WALK_MIN_MINUTES = 15;
const WARMUP_CYCLE_MIN_MINUTES = 8;
const HIGH_WIND_KPH = 30; // gust speed requiring a wind-rated umbrella
const ACCESSORY_WARMTH_LEVEL = 3;
const HIGH_UV_INDEX = 6;
const HIGH_REFLECTION_UV_OFFSET = 1;
const WIND_CHILL_KPH = 15; // §6.2/§7.8 — effective SUSTAINED wind (not gust) at/above which a wind-tunnel annotation justifies an extra warmth bump; deliberately 15, not 20 — see §7.8 on Auckland's 14-18kph average
const WIND_TUNNEL_MULTIPLIER = 1.5; // felt-wind multiplier for a leg flagged windEffect === "amplified"
// §7.8 — "sheltered" legs are informational-only (no dampening delta):
// apparentTempC is a single combined figure with no exposed wind-driven
// breakdown, so there's no reliable amount to offset for a sheltered spot.
// The multiplier is named here for symmetry/tuning but deliberately unread.
export const WIND_SHELTERED_MULTIPLIER = 0.5;
export const PUDDLE_RISK_PRECIP_MM_6H = 5; // cumulative mm over the past 6h at/above which puddle risk is flagged for footwear (§7.8) — exported for planJourney's fetch-time leg stamping (§3.4)
const WIND_SENSITIVITY_OFFSET_CLAMP = 1; // §7.5.2 — clamps windSensitivityOffset to ±1; only ever nudges the annotation-gated wind-chill bump, never the base warmthLevel
const APPARENT_TEMP_DIVERGENCE_NOTE_C = 2;
const STATIONARY_WAIT_MIN_MINUTES = 10;
const STATIONARY_WAIT_WINDY_MIN_MINUTES = 5;
const ITEM_WARMTH_SCALE_MAX = 10; // §3.6 — ClothingItem.warmth's 1-10 range; pickLayer()'s targetWarmth math below depends on this directly
const WARMTH_LEVEL_TO_ITEM_SCALE = ITEM_WARMTH_SCALE_MAX / 4; // maps the 0-4 warmthLevel range onto the 1-10 item warmth scale
const BOTTOMS_COLD_WARMTH_LEVEL = 4;
const HOT_C = 24;
const SEVERE_WEATHER_SEVERITY = 4;
const SEVERE_GUST_KPH = 60;

function condition(weather: WeatherSnapshot) {
  return classifyWeather(weather.weatherCode, weather.precipMm, weather.windKph);
}

// An item is usable only if it isn't flagged unavailable (in the wash,
// lost, being repaired) for a date range that covers this journey.
function isAvailable<T extends { unavailableUntil?: string }>(item: T, departTime: string): boolean {
  if (!item.unavailableUntil) return true;
  return new Date(item.unavailableUntil).getTime() < new Date(departTime).getTime();
}

// Warmth level 0 (warm) .. 4 (freezing), derived from the coldest outdoor
// leg's apparentTempC (§6.2) — NOT raw tempC.
function warmthLevelFromTemp(
  apparentTempC: number,
  thresholds: { freezingC: number; coolUpperC: number; warmOutdoorC: number } = {
    freezingC: FREEZING_C,
    coolUpperC: COOL_UPPER_C,
    warmOutdoorC: WARM_OUTDOOR_C,
  }
): 0 | 1 | 2 | 3 | 4 {
  if (apparentTempC <= thresholds.freezingC) return 4;
  if (apparentTempC < 9) return 3;
  if (apparentTempC < thresholds.coolUpperC) return 2;
  if (apparentTempC < thresholds.warmOutdoorC) return 1;
  return 0;
}

// §7.9 — walking/cycling evaluated against separate warmup thresholds;
// both explicitly exclude isStationary legs.
function totalOutdoorExertionMinutes(journey: Journey, mode: "walk" | "cycle"): number {
  return journey.legs
    .filter((l) => l.outdoor && !l.isStationary && l.mode === mode)
    .reduce((sum, l) => sum + l.durationMin, 0);
}

function totalOutdoorStationaryMinutes(journey: Journey): number {
  return journey.legs.filter((l) => l.outdoor && l.isStationary).reduce((sum, l) => sum + l.durationMin, 0);
}

function layerPlanForWarmthLevel(level: 0 | 1 | 2 | 3 | 4, requirePackable: boolean): ClothingType[] {
  if (level === 4) return ["base", "midlayer", "jacket"];
  if (level === 3) return ["midlayer", "jacket"];
  if (level === 2) return requirePackable ? ["midlayer"] : ["jacket"];
  if (level === 1) return ["midlayer"];
  return [];
}

function pickLayer(
  inventory: Inventory,
  type: ClothingType,
  targetWarmth: number,
  needsWaterproof: boolean,
  requirePackable: boolean,
  departTime: string,
  preferTags: string[] = []
): LayerPick {
  const candidates = inventory.clothing.filter(
    (c) => c.type === type && (!requirePackable || c.packable) && isAvailable(c, departTime)
  );
  const picked = candidates.sort(
    (a, b) =>
      (preferTags.length
        ? Number(preferTags.some((t) => b.tags?.includes(t))) - Number(preferTags.some((t) => a.tags?.includes(t)))
        : 0) ||
      (needsWaterproof ? Number(b.waterproof) - Number(a.waterproof) : 0) ||
      Math.abs(a.warmth - targetWarmth) - Math.abs(b.warmth - targetWarmth)
  )[0];
  return picked ?? { fallbackText: `No available ${type} for these conditions`, layerType: type };
}

// §7.6 — sun and low-light gear. Reads highReflection/sunEffect fields
// that stay undefined until Phase 6's annotation matching exists (same
// "shape is right, dead until the data exists" pattern as hikeSamples).
function applySunProtection(
  accessories: LayerPick[],
  available: ClothingItem[],
  outdoorLegs: JourneyLeg[],
  notes: string[]
) {
  const effectiveUv = (l: JourneyLeg) => l.weather!.uvIndex + (l.highReflection ? HIGH_REFLECTION_UV_OFFSET : 0);
  const maxEffectiveUv = Math.max(...outdoorLegs.map(effectiveUv));
  if (maxEffectiveUv < HIGH_UV_INDEX) return;
  const sunglasses = available.find((c) => c.tags?.includes("sunglasses"));
  accessories.push(sunglasses ?? { fallbackText: "UV is high — sunglasses/a hat recommended", layerType: "accessory" });
  const anyReflective = outdoorLegs.some((l) => l.highReflection);
  notes.push(
    anyReflective
      ? `UV index reaching ${Math.round(Math.max(...outdoorLegs.map((l) => l.weather!.uvIndex)))} today, higher still with reflection off sand/water`
      : `UV index reaching ${Math.round(maxEffectiveUv)} today`
  );
}

function applyDarknessGear(accessories: LayerPick[], available: ClothingItem[], outdoorLegs: JourneyLeg[], notes: string[]) {
  const anyDarkLeg = outdoorLegs.some((l) => l.weather && !l.weather.isDaylight);
  if (!anyDarkLeg) return;
  const reflective = available.find((c) => c.tags?.includes("reflective"));
  if (reflective) {
    accessories.push(reflective);
    notes.push("Part of this trip is in the dark — reflective gear picked");
  } else {
    notes.push("Part of this trip is in the dark — consider something reflective or a light, if you own one");
  }
}

export function recommendGear(
  journey: Journey,
  inventory: Inventory,
  calibration: WarmthCalibration,
  carryPreference: CarryPreference,
  advancedThresholds?: AdvancedWarmthThresholds
): Recommendation {
  const thresholds = {
    freezingC: advancedThresholds?.freezingC ?? FREEZING_C,
    coolUpperC: advancedThresholds?.coolUpperC ?? COOL_UPPER_C,
    warmOutdoorC: advancedThresholds?.warmOutdoorC ?? WARM_OUTDOOR_C,
  };
  const outdoorLegs = journey.legs.filter((l) => l.outdoor && l.weather);
  const worstOutdoor = outdoorLegs.reduce(
    (worst, l) => (condition(l.weather!).severity > (worst ? condition(worst.weather!).severity : -1) ? l : worst),
    null as JourneyLeg | null
  );
  const minTemp = Math.min(...outdoorLegs.map((l) => l.weather!.apparentTempC));
  const maxGust = Math.max(...outdoorLegs.map((l) => l.weather!.windGustKph));
  const hasWarmOutdoor = outdoorLegs.some((l) => l.weather!.apparentTempC >= thresholds.warmOutdoorC);
  const season = getSeason(journey.departTime);
  const acContrast = acFeelsCold(journey, season, hasWarmOutdoor);
  const walkingMinutes = totalOutdoorExertionMinutes(journey, "walk");
  const cyclingMinutes = totalOutdoorExertionMinutes(journey, "cycle");
  const stationaryMinutes = totalOutdoorStationaryMinutes(journey);
  const isFormal = journey.formal ?? false;
  const needsWaterproof = outdoorLegs.some((l) => condition(l.weather!).severity >= 2);
  // Puddle risk affects footwear only, independent of current rain (§7.8) —
  // either stamped on the leg at fetch time (§3.4) or derived here from the
  // snapshot's recentPrecipMm6h.
  const puddleRisk = outdoorLegs.some(
    (l) => l.puddleRisk || (l.weather!.recentPrecipMm6h ?? 0) >= PUDDLE_RISK_PRECIP_MM_6H
  );
  const anyRainCovered = outdoorLegs.some((l) => l.rainCovered);

  const notes: string[] = [];

  // --- Umbrella ---
  let umbrella: Recommendation["umbrella"];
  if (worstOutdoor && condition(worstOutdoor.weather!).severity >= 2) {
    const owned = inventory.umbrellas.find(
      (u) => isAvailable(u, journey.departTime) && (maxGust > HIGH_WIND_KPH ? u.windRating !== "low" : true)
    );
    umbrella = owned ?? { fallbackText: "No suitable umbrella owned or available — consider a wind-rated one" };
    notes.push(`${worstOutdoor.label}: ${condition(worstOutdoor.weather!).label.toLowerCase()} expected`);
    if (anyRainCovered) {
      notes.push("Part of this route is covered — you may not need it out the whole way");
    }
  }

  // --- Shoes ---
  const shoesNeedWaterproof = needsWaterproof || puddleRisk;
  const shoeCandidates = inventory.shoes.filter(
    (s) => isAvailable(s, journey.departTime) && (shoesNeedWaterproof ? s.waterproof : true)
  );
  let shoes: Recommendation["shoes"];
  if (isFormal) {
    const formalShoe = inventory.shoes.find((s) => s.type === "formal" && isAvailable(s, journey.departTime));
    if (formalShoe) {
      shoes = formalShoe;
      if (shoesNeedWaterproof && !formalShoe.waterproof) {
        notes.push("Dress shoes picked for the occasion — bring an umbrella, conditions call for one");
      }
    }
  }
  if (!shoes) {
    shoes = shoeCandidates.sort((a, b) => (b.grip === "high" ? 1 : 0) - (a.grip === "high" ? 1 : 0))[0] ?? {
      fallbackText: shoesNeedWaterproof ? "No waterproof shoes owned or available" : "Any regular shoes fine",
    };
  }
  if (puddleRisk && !needsWaterproof) {
    notes.push("Rain earlier today — puddles likely, going with waterproof/grippy shoes even though it's dry now");
  }

  // --- Layers ---
  let warmthLevel = Math.max(
    0,
    Math.min(4, warmthLevelFromTemp(minTemp, thresholds) + resolveWarmthOffset(calibration, season))
  ) as 0 | 1 | 2 | 3 | 4;

  // 1.5. Hyper-local wind/sun/reflection adjustments (§7.8) and
  // stationary-wait adjustment (§7.9). The wind/sun checks fire ONLY in the
  // presence of an EnvironmentAnnotation (windEffect/sunEffect/
  // highReflection) — there is deliberately no general ambient wind-chill
  // or sun-warming check here, since apparentTempC (used for minTemp
  // above) already folds in the citywide ambient wind/humidity/solar
  // picture; a general check on top would double-count. These deltas
  // represent only the *extra* local deviation a specific street or spot
  // adds beyond that baseline.
  let envDelta = 0;
  const windLeg = outdoorLegs.find(
    (l) => l.windEffect === "amplified" && l.weather!.windKph * WIND_TUNNEL_MULTIPLIER >= WIND_CHILL_KPH
  );
  if (windLeg && !isFormal) {
    // §7.10 — a formal occasion relies on the umbrella pick + note rather
    // than an added layer, since a bulky wind-chill layer is more likely to
    // be visually wrong for the occasion than useful.
    // §7.5.2 — windSensitivityOffset scales this one bump only, clamped;
    // this is the sole place it's read.
    const windBump =
      1 + clamp(calibration.windSensitivityOffset ?? 0, -WIND_SENSITIVITY_OFFSET_CLAMP, WIND_SENSITIVITY_OFFSET_CLAMP);
    envDelta += windBump;
    notes.push(`Wind tunnel on ${windLeg.label} — dressing warmer for that stretch`);
  }
  const sunLeg = outdoorLegs.find(
    (l) =>
      l.sunEffect === "exposed" &&
      l.weather!.isDaylight &&
      l.weather!.uvIndex >= HIGH_UV_INDEX - (l.highReflection ? HIGH_REFLECTION_UV_OFFSET : 0)
  );
  if (sunLeg) {
    envDelta -= 1;
    notes.push(
      sunLeg.highReflection
        ? `Direct sun and reflection on ${sunLeg.label} will feel warmer than the temperature alone suggests`
        : `Direct sun on ${sunLeg.label} will feel warmer than the temperature alone suggests`
    );
  }
  const stationaryLegWindy = outdoorLegs.some((l) => l.isStationary && l.weather!.windKph >= WIND_CHILL_KPH);
  const stationaryThreshold = stationaryLegWindy ? STATIONARY_WAIT_WINDY_MIN_MINUTES : STATIONARY_WAIT_MIN_MINUTES;
  if (stationaryMinutes >= stationaryThreshold && minTemp < thresholds.coolUpperC) {
    envDelta += 1;
    notes.push(
      stationaryLegWindy
        ? `${stationaryMinutes} min waiting in the wind — dressing warmer since you won't be moving to generate heat`
        : `${stationaryMinutes} min waiting outdoors — dressing warmer since you won't be moving to generate heat`
    );
  }
  warmthLevel = Math.max(0, Math.min(4, warmthLevel + envDelta)) as typeof warmthLevel;

  // 1.6. Apparent-temp divergence note (§6.2)
  if (worstOutdoor) {
    const gap = worstOutdoor.weather!.tempC - worstOutdoor.weather!.apparentTempC;
    if (gap >= APPARENT_TEMP_DIVERGENCE_NOTE_C) {
      notes.push(`Feels noticeably colder than the air temperature today — dressed for that, not just the number`);
    }
  }

  // 1.7. Hot-weather note (§7.15)
  if (outdoorLegs.some((l) => l.weather!.apparentTempC >= HOT_C)) {
    notes.push("Warm enough today that something breathable and light-colored will feel better than your usual pick");
  }

  // 2. Warmup discount (§7.9)
  const eligibleForWarmupDiscount =
    minTemp > thresholds.freezingC &&
    minTemp < thresholds.coolUpperC &&
    (walkingMinutes >= WARMUP_WALK_MIN_MINUTES || cyclingMinutes >= WARMUP_CYCLE_MIN_MINUTES);
  if (eligibleForWarmupDiscount) {
    warmthLevel = Math.max(0, warmthLevel - 1) as typeof warmthLevel;
    const cyclingQualifies = cyclingMinutes >= WARMUP_CYCLE_MIN_MINUTES;
    const exertionMinutes = cyclingQualifies ? cyclingMinutes : walkingMinutes;
    const exertionLabel = cyclingQualifies ? "cycling" : "walking";
    notes.push(
      `${exertionMinutes} min of ${exertionLabel} at ${Math.round(minTemp)}°C will warm you up fast — ` +
        `going one layer lighter than the raw temperature suggests`
    );
  }

  // 3. Summer AC contrast (§6.1)
  let requirePackable = false;
  if (acContrast) {
    requirePackable = true;
    warmthLevel = Math.max(warmthLevel, 2) as typeof warmthLevel;
    notes.push(
      "Summer AC on the bus/train will feel cold after being warm outside — pick a layer you can put on and take off easily"
    );
  }
  if (carryPreference === "avoid-spares" && requirePackable) {
    requirePackable = false;
    notes.push("Skipping a spare layer per your preference — the bus AC may feel cold");
  }

  // 4. Resolve the layer plan into actual owned items (§7.9/7.10 preferTags)
  const layerTypes = layerPlanForWarmthLevel(warmthLevel, requirePackable);
  const preferTags = [...(cyclingMinutes > 0 ? ["cycling"] : []), ...(isFormal ? ["formal"] : [])];
  let layers = layerTypes.map((type) =>
    pickLayer(inventory, type, warmthLevel * WARMTH_LEVEL_TO_ITEM_SCALE, needsWaterproof, requirePackable, journey.departTime, preferTags)
  );
  // §7.12 — dual-purpose jacket
  const pickedJacket = layers.find((l, i) => layerTypes[i] === "jacket");
  const midlayerIndex = layerTypes.indexOf("midlayer");
  if (
    midlayerIndex !== -1 &&
    pickedJacket &&
    "id" in pickedJacket &&
    pickedJacket.substitutesForMidlayer &&
    pickedJacket.warmth >= warmthLevel * WARMTH_LEVEL_TO_ITEM_SCALE
  ) {
    layers = layers.filter((_, i) => i !== midlayerIndex);
    notes.push(`Your ${pickedJacket.name} is warm enough on its own — no separate midlayer needed underneath`);
  }

  // 4.5. Legwear (§7.13)
  const needsWaterproofBottoms = needsWaterproof && maxGust >= HIGH_WIND_KPH;
  const needsThermalBottoms = warmthLevel >= BOTTOMS_COLD_WARMTH_LEVEL;
  let bottoms: Recommendation["bottoms"];
  if (needsWaterproofBottoms || needsThermalBottoms) {
    bottoms = pickLayer(inventory, "bottoms", warmthLevel * WARMTH_LEVEL_TO_ITEM_SCALE, needsWaterproofBottoms, false, journey.departTime, preferTags);
    if (needsWaterproofBottoms) {
      notes.push("Wet and windy enough to warrant rain trousers, not just a jacket");
    }
  }

  // --- Accessories (§7.6) ---
  const accessories: LayerPick[] = [];
  const availableAccessories = inventory.clothing.filter((c) => c.type === "accessory" && isAvailable(c, journey.departTime));

  if (warmthLevel >= ACCESSORY_WARMTH_LEVEL) {
    const warm = availableAccessories.filter((c) => !c.tags || !c.tags.includes("sunglasses"));
    if (warm.length > 0) {
      accessories.push(...warm);
    } else {
      accessories.push({ fallbackText: "Consider gloves/a hat — it's cold out", layerType: "accessory" });
    }
  }
  applySunProtection(accessories, availableAccessories, outdoorLegs, notes);
  applyDarknessGear(accessories, availableAccessories, outdoorLegs, notes);

  // --- Severe weather advisory (§7.14) ---
  const severeLeg = outdoorLegs.find((l) => {
    if (l.mode === "hike" && l.hikeSamples) {
      return l.hikeSamples.some((s) => condition(s.weather!).severity >= SEVERE_WEATHER_SEVERITY || s.weather!.windGustKph >= SEVERE_GUST_KPH);
    }
    return (
      (l.mode === "walk" || l.mode === "cycle") &&
      (condition(l.weather!).severity >= SEVERE_WEATHER_SEVERITY || l.weather!.windGustKph >= SEVERE_GUST_KPH)
    );
  });
  const severeModeLabel = severeLeg?.mode === "cycle" ? "cycling" : severeLeg?.mode === "hike" ? "the hike" : "walking";
  const severeWeatherAdvisory = severeLeg
    ? `${severeLeg.label}: conditions look severe enough that you might want to reconsider ${severeModeLabel} today, if you have another option.`
    : undefined;

  return { layers, bottoms, accessories, shoes, umbrella, severeWeatherAdvisory, notes };
}
