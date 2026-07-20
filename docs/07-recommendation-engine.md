## 7. Gear recommendation engine

This is the part that's new vs. the earlier prototypes: recommendations must
resolve to **actual owned items**, not generic text. Put this in
`src/lib/recommend.ts`.

```ts
type LayerPick = ClothingItem | { fallbackText: string; layerType: ClothingType };

interface Recommendation {
  layers: LayerPick[];        // ordered base → midlayer → jacket, only the layers actually needed
  bottoms?: LayerPick;        // Section 7.13 — legwear, evaluated independently of the layers stack (trousers don't "layer" the way torso items do). Undefined on a mild, dry journey — omitted from the card entirely (Section 9.3), not shown as "regular trousers fine."
  accessories: LayerPick[];   // gloves/hat/scarf-type ClothingType "accessory" items, only when warranted
  shoes?: ShoeItem | { fallbackText: string };
  umbrella?: UmbrellaItem | { fallbackText: string };
  severeWeatherAdvisory?: string; // Section 7.14 — a suggestion to reconsider walking/cycling today, not a gear pick. Rendered as its own banner (Section 9.3), not folded into notes[], since it's a different kind of statement ("maybe don't" vs. "wear this").
  notes: string[]; // human-readable reasoning, shown under each pick
}

// ---- Named thresholds — tune these, don't touch control flow below ----
const FREEZING_C = 2;              // at/below this, warmth always wins, no warmup discount. NOTE: Auckland's practical record cold is close to this value (a rare 2011 near-snow event recorded a 2°C low) — this tier is intentionally a "genuine cold snap" ceiling, not a threshold expected to fire on a typical Auckland winter morning
const COOL_UPPER_C = 14;           // "cool" band upper bound
const WARM_OUTDOOR_C = 18;         // outdoor temp counted as "warm" for AC-contrast logic
const WARMUP_WALK_MIN_MINUTES = 15; // total outdoor walking time before body heat matters
const WARMUP_CYCLE_MIN_MINUTES = 8; // lower than walking's — cycling builds body heat faster (Section 7.9)
const HIGH_WIND_KPH = 30;          // GUST speed (WeatherSnapshot.windGustKph, Section 6.2) that requires a wind-rated umbrella — a gust, not sustained wind, is what actually inverts one
const ACCESSORY_WARMTH_LEVEL = 3;  // warmth level (see below) at/above which gloves/hat are worth surfacing
const HIGH_UV_INDEX = 6;           // Open-Meteo uv_index at/above which sun protection is worth surfacing — matches the WHO UV index scale's official "High" band (6-7)
const HIGH_REFLECTION_UV_OFFSET = 1; // Section 7.8 — the effective UV threshold is lowered by this much on a leg flagged highReflection (sand/water/snow); reuses HIGH_UV_INDEX rather than adding a second threshold to keep in sync
const WARMTH_CALIBRATION_STEP = 0.5; // how much one feedback event shifts WarmthCalibration.offsetLevels (Section 7.5)
const WIND_CHILL_KPH = 15;          // Section 6.2/7.8 — effective SUSTAINED wind speed (not gust) at/above which a hyper-local wind-tunnel annotation is amplifying conditions enough beyond the citywide apparentTempC baseline to justify an extra warmth-level bump. Corrected down from an earlier draft's 20: the standard wind-chill formula shows a ~2°C feels-like depression already at ~15kph and Auckland averages 14-18kph — a threshold near or above that average was suppressing a real, common effect rather than reserving the note for something unusual. How often a true effect fires is not a reason to raise its threshold.
const APPARENT_TEMP_DIVERGENCE_NOTE_C = 2; // Section 6.2 — when |apparentTempC - tempC| on the worst leg is at/above this, add a note naming the gap (wind, humidity, or both — Open-Meteo's model already knows which, the app doesn't need to re-derive it)
const WIND_TUNNEL_MULTIPLIER = 1.5;  // felt-wind multiplier for a leg flagged windEffect === "amplified"
const WIND_SHELTERED_MULTIPLIER = 0.5; // felt-wind multiplier for a leg flagged windEffect === "sheltered"
const PUDDLE_RISK_PRECIP_MM_6H = 5; // cumulative mm over the past 6h at/above which puddle risk is flagged for footwear (Section 7.8)
const STATIONARY_WAIT_MIN_MINUTES = 10; // Section 7.9 — a stationary outdoor wait at/above this long, in cool-or-colder conditions, is treated as an aggravating factor on warmthLevel, since standing still generates no body heat. Applies when the wait is NOT already flagged windy (see below) — a calm wait needs the full duration before it's noticeably worse than the ambient reading.
const STATIONARY_WAIT_WINDY_MIN_MINUTES = 5; // Section 7.9 — a shorter duration threshold used when the same wait leg's effective wind already meets WIND_CHILL_KPH: standing still is windchill's worst case (no body heat to counter it), so a windy wait earns the aggravating bump sooner than a calm one, not on the same flat schedule
const ITEM_WARMTH_SCALE_MAX = 10;   // Section 3.6 — ClothingItem.warmth's range (1-10, widened from an original 1-5 scale). Documented here as a named constant, not just a type comment, since pickLayer()'s targetWarmth math (below) depends on it directly — if this scale ever changes again, the multiplier there must change with it.
const WIND_SENSITIVITY_OFFSET_CLAMP = 1; // Section 7.5.2 — clamps WarmthCalibration.windSensitivityOffset to ±1. Deliberately a tighter clamp than WARMTH_CALIBRATION_STEP's ±2 range on offsetLevels, since this only ever nudges one already-conditional delta (the annotation-gated wind-chill bump, Section 7.8), not the whole recommendation's baseline.
const CALIBRATION_DECAY_AFTER_DAYS = 60; // Section 7.5.3 — a WarmthCalibration bucket (global, seasonal, or wind-sensitivity) with no feedback in this many days is nudged toward 0 rather than left frozen, since "runs warm" learned two seasons ago may no longer reflect how someone dresses now.
const CALIBRATION_DECAY_STEP = 0.25; // Section 7.5.3 — how much a stale offset moves toward 0 per decay check (Section 12.2's dev menu exposes a manual trigger for testing this without waiting 60 real days)
const BOTTOMS_COLD_WARMTH_LEVEL = 4; // Section 7.13 — legwear only gets a specific thermal call at genuine-cold-snap warmthLevel (4); anything milder assumes regular trousers are fine, same reasoning as layerPlanForWarmthLevel's level-0 "nothing extra needed"
const HOT_C = 24;                    // Section 7.15 — apparentTempC at/above which a breathable-fabric note is worth surfacing; distinct from WARM_OUTDOOR_C (18°C), which only governs AC-contrast — this is specifically about genuinely hot, not just "not cold"
const SEVERE_WEATHER_SEVERITY = 4;   // Section 7.14 — classifyWeather() severity ("Stormy") at/above which the severe-weather advisory considers firing on a walk/cycle leg
const SEVERE_GUST_KPH = 60;          // Section 7.14 — windGustKph at/above which the advisory fires on wind alone even without storm-level precipitation; well above HIGH_WIND_KPH's 30kph umbrella-survival threshold, since this is about the walk/cycle itself being unpleasant or unsafe, not just an umbrella surviving it
const WASH_REMINDER_WEAR_COUNT = 3;  // Section 7.16 — wearsSinceClean at/above which needsCleaning is set, absent an earlier sweaty-conditions trigger
const LAUNDRY_DEFAULT_TURNAROUND_DAYS = 2; // Section 7.16 — default unavailableUntil offset when marking an item "in the laundry" specifically (a wash-and-dry cycle), shorter than the general +3 day default the "mark unavailable until…" action (Section 7.7) uses for "repair"/"other"

// An item is usable only if it isn't flagged unavailable (in the wash,
// lost, being repaired) for a date range that covers this journey.
function isAvailable<T extends { unavailableUntil?: string }>(item: T, departTime: string): boolean {
  if (!item.unavailableUntil) return true;
  return new Date(item.unavailableUntil).getTime() < new Date(departTime).getTime();
}

// Warmth level 0 (warm) .. 4 (freezing), derived from the coldest outdoor
// leg's apparentTempC (Section 6.2) — NOT raw tempC. apparentTempC already
// folds in Open-Meteo's own wind/humidity/solar-radiation model for the
// general area, so this single input already reflects Auckland's
// persistent wind and humidity without the engine re-deriving either.
//
// `thresholds` defaults to the named constants below but can be overridden
// per-user via Section 3.6's opt-in AdvancedWarmthThresholds — callers
// resolve `{ freezingC: advanced?.freezingC ?? FREEZING_C, ... }` once and
// pass it in, the same "resolve once, engine only sees one final value"
// pattern already used for CarryPreference above.
function warmthLevelFromTemp(
  apparentTempC: number,
  thresholds: { freezingC: number; coolUpperC: number; warmOutdoorC: number } =
    { freezingC: FREEZING_C, coolUpperC: COOL_UPPER_C, warmOutdoorC: WARM_OUTDOOR_C }
): 0 | 1 | 2 | 3 | 4 {
  if (apparentTempC <= thresholds.freezingC) return 4;
  if (apparentTempC < 9) return 3;
  if (apparentTempC < thresholds.coolUpperC) return 2;
  if (apparentTempC < thresholds.warmOutdoorC) return 1;
  return 0;
}

// Section 7.9 — walking and cycling are evaluated against separate warmup
// thresholds (sustained cycling builds body heat faster than walking at
// the same duration), and both explicitly exclude isStationary legs
// (Section 3.5) — standing still on a platform generates no body heat at
// all, so it must never count toward either warmup discount.
function totalOutdoorExertionMinutes(journey: Journey, mode: "walk" | "cycle"): number {
  return journey.legs
    .filter(l => l.outdoor && !l.isStationary && l.mode === mode)
    .reduce((sum, l) => sum + l.durationMin, 0);
}

// Section 7.9 — the mirror image of the function above: total time spent
// standing still outdoors (transit waits, pickup queues), which aggravates
// cold exposure rather than offsetting it.
function totalOutdoorStationaryMinutes(journey: Journey): number {
  return journey.legs
    .filter(l => l.outdoor && l.isStationary)
    .reduce((sum, l) => sum + l.durationMin, 0);
}

// Which ClothingType(s) are actually needed at a given warmth level. Returns
// them in put-on order (base first). This is what makes recommendations
// multi-piece for cold conditions instead of a single "jacket" guess.
function layerPlanForWarmthLevel(level: 0 | 1 | 2 | 3 | 4, requirePackable: boolean): ClothingType[] {
  if (level === 4) return ["base", "midlayer", "jacket"];
  if (level === 3) return ["midlayer", "jacket"];
  if (level === 2) return requirePackable ? ["midlayer"] : ["jacket"];
  if (level === 1) return ["midlayer"];
  return []; // level 0 — no extra layer needed beyond whatever the user's already wearing
}

function pickLayer(
  inventory: Inventory,
  type: ClothingType,
  targetWarmth: number, // on the same 1-ITEM_WARMTH_SCALE_MAX (1-10) scale as ClothingItem.warmth (Section 3.6) — callers must scale warmthLevel (0-4) up onto this range before calling, not pass warmthLevel directly
  needsWaterproof: boolean,
  requirePackable: boolean,
  departTime: string,
  preferTags: string[] = [] // Section 7.9/7.10 — e.g. ["cycling"] or ["formal"]; biases ordering toward a tagged match without excluding untagged items, so a thin inventory still resolves to something
): LayerPick {
  const candidates = inventory.clothing.filter(c =>
    c.type === type && (!requirePackable || c.packable) && isAvailable(c, departTime));
  const picked = candidates.sort((a, b) =>
    (preferTags.length
      ? Number(preferTags.some(t => b.tags?.includes(t))) - Number(preferTags.some(t => a.tags?.includes(t)))
      : 0) ||
    (needsWaterproof ? Number(b.waterproof) - Number(a.waterproof) : 0) ||
    Math.abs(a.warmth - targetWarmth) - Math.abs(b.warmth - targetWarmth)
  )[0];
  return picked ?? { fallbackText: `No available ${type} for these conditions`, layerType: type };
}

// `carryPreferenceDefault` is the Settings-level default (Section 9.1);
// callers resolve `journey.carryPreference ?? carryPreferenceDefault`
// themselves before calling, or pass the already-resolved value — either
// way the engine only ever sees one final CarryPreference, not two sources
// to reconcile.
function recommendGear(
  journey: Journey,
  inventory: Inventory,
  calibration: WarmthCalibration,
  carryPreference: CarryPreference,
  advancedThresholds?: AdvancedWarmthThresholds // Section 3.6 — undefined for the vast majority of users; resolved once here, never read piecemeal below
): Recommendation {
  // Section 3.6 — resolve once; every reference to a warmth threshold
  // below reads from this object, never the bare named constants, so an
  // opted-in override is applied consistently rather than in some places
  // and not others.
  const thresholds = {
    freezingC: advancedThresholds?.freezingC ?? FREEZING_C,
    coolUpperC: advancedThresholds?.coolUpperC ?? COOL_UPPER_C,
    warmOutdoorC: advancedThresholds?.warmOutdoorC ?? WARM_OUTDOOR_C,
  };
  const outdoorLegs = journey.legs.filter(l => l.outdoor && l.weather);
  const worstOutdoor = outdoorLegs.reduce((worst, l) =>
    l.weather!.severity > (worst?.weather?.severity ?? -1) ? l : worst, null as JourneyLeg | null);
  // Section 6.2 — minTemp (the engine's actual temperature input) is drawn
  // from apparentTempC, not raw tempC. maxGust for the umbrella check is
  // drawn from windGustKph, not sustained windKph — see Section 7.8.
  const minTemp = Math.min(...outdoorLegs.map(l => l.weather!.apparentTempC));
  const maxGust = Math.max(...outdoorLegs.map(l => l.weather!.windGustKph));
  const hasWarmOutdoor = outdoorLegs.some(l => l.weather!.apparentTempC >= thresholds.warmOutdoorC);
  const season = getSeason(journey.departTime);           // Section 6.1
  const acContrast = acFeelsCold(journey, season, hasWarmOutdoor); // Section 6.1
  const walkingMinutes = totalOutdoorExertionMinutes(journey, "walk");
  const cyclingMinutes = totalOutdoorExertionMinutes(journey, "cycle");
  const stationaryMinutes = totalOutdoorStationaryMinutes(journey); // Section 7.9
  const isFormal = journey.formal ?? false; // Section 7.10
  const needsWaterproof = outdoorLegs.some(l => l.weather!.severity >= 2);
  // Puddle risk affects footwear only, independent of current rain — see Section 7.8.
  const puddleRisk = outdoorLegs.some(l =>
    l.puddleRisk || (l.weather!.recentPrecipMm6h ?? 0) >= PUDDLE_RISK_PRECIP_MM_6H);
  const anyRainCovered = outdoorLegs.some(l => l.rainCovered);

  const notes: string[] = [];

  // --- Umbrella ---
  let umbrella: Recommendation["umbrella"];
  if (worstOutdoor && worstOutdoor.weather!.severity >= 2) {
    const owned = inventory.umbrellas.find(u =>
      isAvailable(u, journey.departTime) && (maxGust > HIGH_WIND_KPH ? u.windRating !== "low" : true));
    umbrella = owned ?? { fallbackText: "No suitable umbrella owned or available — consider a wind-rated one" };
    notes.push(`${worstOutdoor.label}: ${worstOutdoor.weather!.label.toLowerCase()} expected`);
    // Informational only — a partially covered walk doesn't change *whether*
    // to bring an umbrella (the uncovered portion still needs one), just
    // sets expectations. See Section 7.8 for why this doesn't alter the
    // umbrella pick itself.
    if (anyRainCovered) {
      notes.push("Part of this route is covered — you may not need it out the whole way");
    }
  }

  // --- Shoes ---
  // needsWaterproof (currently raining) and puddleRisk (rained recently,
  // may be dry now) both push toward waterproof/grippy footwear, but for
  // different reasons — see Section 7.8.
  const shoesNeedWaterproof = needsWaterproof || puddleRisk;
  const shoeCandidates = inventory.shoes.filter(s =>
    isAvailable(s, journey.departTime) && (shoesNeedWaterproof ? s.waterproof : true));
  // Section 7.10 — a formal occasion prefers a formal-type shoe even at a
  // waterproof/grip penalty, falling back to the normal weather-first sort
  // only when no formal shoe is available, so the user isn't left with
  // nothing rather than something merely not-quite-optimal.
  let shoes: Recommendation["shoes"];
  if (isFormal) {
    const formalShoe = inventory.shoes.find(s => s.type === "formal" && isAvailable(s, journey.departTime));
    if (formalShoe) {
      shoes = formalShoe;
      if (shoesNeedWaterproof && !formalShoe.waterproof) {
        notes.push("Dress shoes picked for the occasion — bring an umbrella, conditions call for one");
      }
    }
  }
  if (!shoes) {
    shoes = shoeCandidates.sort((a, b) => (b.grip === "high" ? 1 : 0) - (a.grip === "high" ? 1 : 0))[0]
      ?? { fallbackText: shoesNeedWaterproof ? "No waterproof shoes owned or available" : "Any regular shoes fine" };
  }
  if (puddleRisk && !needsWaterproof) {
    notes.push("Rain earlier today — puddles likely, going with waterproof/grippy shoes even though it's dry now");
  }

  // --- Layers ---
  // 1. Start from a warmth level driven by the coldest outdoor leg's
  //    apparentTempC (Section 6.2 — already wind/humidity/solar-aware),
  //    then apply this user's personal calibration (Section 7.5) — someone
  //    who consistently reports "too warm" runs a lighter recommendation
  //    than the raw calculation from here on. resolveWarmthOffset()
  //    (Section 7.5.1) prefers the current season's own offset and falls
  //    back to the global offsetLevels when that season has no samples yet.
  let warmthLevel = Math.max(0, Math.min(4,
    warmthLevelFromTemp(minTemp, thresholds) + resolveWarmthOffset(calibration, season)
  )) as 0 | 1 | 2 | 3 | 4;

  // 1.5. Hyper-local wind/sun/reflection adjustments and stationary-wait
  //      adjustment — see Section 7.8/7.9 for the full rationale. The
  //      wind/sun checks below fire ONLY in the presence of an
  //      EnvironmentAnnotation (windEffect/sunEffect/highReflection) —
  //      there is deliberately no general ambient wind-chill or sun-warming
  //      check here, since apparentTempC (used for minTemp above) already
  //      folds in the citywide ambient wind/humidity/solar picture. A
  //      general check on top of that would double-count. These deltas
  //      represent only the *extra* local deviation a specific street or
  //      spot adds beyond the citywide baseline.
  let envDelta = 0;
  // Section 6.2 — only "amplified" (wind-tunnel) legs add a delta here.
  // "sheltered" legs are deliberately informational-only (surfaced as a
  // note, not a warmthLevel change) rather than subtracting a dampening
  // delta: apparentTempC is a single combined figure from Open-Meteo with
  // no exposed breakdown of how much of it is wind-driven, so there's no
  // reliable way to know how much to offset for a specific sheltered spot
  // — same reasoning as why puddle risk stays footwear-only rather than
  // guessing at a jacket implication (Section 7.8 below).
  const windLeg = outdoorLegs.find(l =>
    l.windEffect === "amplified" && l.weather!.windKph * WIND_TUNNEL_MULTIPLIER >= WIND_CHILL_KPH);
  if (windLeg && !isFormal) {
    // Section 7.10 — a formal occasion relies on the umbrella pick + note
    // above rather than an added layer, since a bulky wind-chill layer is
    // more likely to be visually wrong for the occasion than useful.
    // Section 7.5.2 — someone who's told the app they're more bothered by
    // wind than average gets a slightly larger bump here (clamped to
    // ±WIND_SENSITIVITY_OFFSET_CLAMP); someone less bothered gets a
    // slightly smaller one. This is the *only* place windSensitivityOffset
    // is read — it never touches the base warmthLevel or any other delta.
    const windBump = 1 + clamp(calibration.windSensitivityOffset ?? 0, -WIND_SENSITIVITY_OFFSET_CLAMP, WIND_SENSITIVITY_OFFSET_CLAMP);
    envDelta += windBump;
    notes.push(`Wind tunnel on ${windLeg.label} — dressing warmer for that stretch`);
  }
  const sunLeg = outdoorLegs.find(l =>
    l.sunEffect === "exposed" && l.weather!.isDaylight &&
    l.weather!.uvIndex >= (HIGH_UV_INDEX - (l.highReflection ? HIGH_REFLECTION_UV_OFFSET : 0)));
  if (sunLeg) {
    envDelta -= 1;
    notes.push(
      sunLeg.highReflection
        ? `Direct sun and reflection on ${sunLeg.label} will feel warmer than the temperature alone suggests`
        : `Direct sun on ${sunLeg.label} will feel warmer than the temperature alone suggests`
    );
  }
  // Section 7.9 — standing still outdoors (a delayed platform, a pickup
  // queue) generates no body heat, so a wait long enough in cool-or-colder
  // conditions is treated as an aggravating factor, the same direction as
  // wind chill. A windy wait earns this sooner than a calm one
  // (STATIONARY_WAIT_WINDY_MIN_MINUTES vs. STATIONARY_WAIT_MIN_MINUTES) —
  // wind chill is at its worst precisely when there's no body heat to
  // counter it, so duration alone isn't the whole story.
  const stationaryLegWindy = outdoorLegs.some(l => l.isStationary && l.weather!.windKph >= WIND_CHILL_KPH);
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

  // 1.6. Section 6.2 — a general note (not a warmthLevel change; apparentTempC
  //      already includes this) naming the gap when the worst leg's feels-like
  //      figure diverges meaningfully from the raw air temperature, whatever
  //      the cause — wind, Auckland's persistent humidity, or both. This
  //      replaces a wind-only note from an earlier draft with something more
  //      honest about what's actually driving the difference.
  if (worstOutdoor) {
    const gap = worstOutdoor.weather!.tempC - worstOutdoor.weather!.apparentTempC;
    if (gap >= APPARENT_TEMP_DIVERGENCE_NOTE_C) {
      notes.push(`Feels noticeably colder than the air temperature today — dressed for that, not just the number`);
    }
  }

  // 1.7. Section 7.15 — the engine is otherwise entirely cold-direction:
  //      warmthLevel 0 just means "nothing extra needed," with no positive
  //      guidance for a genuinely hot day. This is a note only, not an item
  //      pick — there's no `breathable` attribute on ClothingItem to match
  //      against (out of scope for v1, see Section 7.15), so the engine
  //      can flag the condition but not resolve a specific breathable item.
  if (outdoorLegs.some(l => l.weather!.apparentTempC >= HOT_C)) {
    notes.push("Warm enough today that something breathable and light-colored will feel better than your usual pick");
  }

  // 2. Warmup discount: sustained outdoor exertion generates enough body
  //    heat that the "textbook" layer for a given temp will feel like too
  //    much within a matter of minutes. Walking and cycling are evaluated
  //    against separate thresholds (Section 7.9) since cycling builds heat
  //    faster; a journey only earns the discount from whichever exertion
  //    type it actually has enough of. Freezing temps are exempt from
  //    both — hypothermia risk outweighs the warmup effect.
  const eligibleForWarmupDiscount =
    minTemp > thresholds.freezingC && minTemp < thresholds.coolUpperC &&
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

  // 3. Summer AC contrast: cooling indoor legs sandwiched between warm
  //    outdoor legs call for something removable, not a fixed heavy jacket.
  //    This only fires in summer — see Section 6.1 for why winter AC is
  //    treated as neutral. Note this reads journey.legs directly, so a
  //    location-override-forced "unconditioned" leg (Section 5.5) correctly
  //    stops counting as AC here without any extra logic.
  let requirePackable = false;
  if (acContrast) {
    requirePackable = true;
    warmthLevel = Math.max(warmthLevel, 2) as typeof warmthLevel; // ensure *something* is picked
    notes.push(
      "Summer AC on the bus/train will feel cold after being warm outside — " +
      "pick a layer you can put on and take off easily"
    );
  }
  // Section 7.9 — "avoid spares" overrides the AC-contrast packable
  // requirement above: the user has said they won't carry a spare
  // regardless of what's suggested, so recommend the warmest single
  // wearable layer instead of a packable one, and say so rather than
  // silently keeping requirePackable true.
  if (carryPreference === "avoid-spares" && requirePackable) {
    requirePackable = false;
    notes.push("Skipping a spare layer per your preference — the bus AC may feel cold");
  }

  // 4. Resolve the layer plan for the (possibly adjusted) warmth level into
  //    actual owned items — this is what produces "base + midlayer + jacket"
  //    for genuinely cold journeys instead of a single guess. Biases toward
  //    cycling-tagged items on a cycle leg and formal-tagged items on a
  //    formal occasion (Section 7.9/7.10) via pickLayer's preferTags.
  //    `warmthLevel * 2.5` maps the 0-4 warmthLevel range onto the 1-10
  //    ClothingItem.warmth scale (ITEM_WARMTH_SCALE_MAX, Section 3.6) —
  //    update this multiplier if either scale's range ever changes.
  const layerTypes = layerPlanForWarmthLevel(warmthLevel, requirePackable);
  const preferTags = [
    ...(cyclingMinutes > 0 ? ["cycling"] : []),
    ...(isFormal ? ["formal"] : []),
  ];
  let layers = layerTypes.map(type =>
    pickLayer(inventory, type, warmthLevel * 2.5, needsWaterproof, requirePackable, journey.departTime, preferTags)
  );
  // Section 7.12 — a jacket that's already insulated enough to do a
  // midlayer's job (ClothingItem.substitutesForMidlayer, Section 3.6, e.g.
  // a rain shell with a built-in thin puffer lining) makes a separately
  // recommended midlayer redundant. Only applies when both a midlayer and
  // a jacket were actually resolved to real items (not fallbackText) and
  // the jacket's own warmth already covers the target — a substitutable
  // jacket that's unavailable this trip still needs a normal midlayer.
  const pickedJacket = layers.find((l, i) => layerTypes[i] === "jacket");
  const midlayerIndex = layerTypes.indexOf("midlayer");
  if (
    midlayerIndex !== -1 &&
    pickedJacket && "id" in pickedJacket && pickedJacket.substitutesForMidlayer &&
    pickedJacket.warmth >= warmthLevel * 2.5
  ) {
    layers = layers.filter((_, i) => i !== midlayerIndex);
    notes.push(`Your ${pickedJacket.name} is warm enough on its own — no separate midlayer needed underneath`);
  }

  // 4.5. Legwear (Section 7.13) — evaluated independently of the layers
  //      stack above, since trousers don't "layer" the way base/midlayer/
  //      jacket do. Only surfaced when conditions specifically call for
  //      it — a genuine cold snap (thermal bottoms) or wet-and-windy-enough
  //      conditions that ordinary trousers would be miserable (rain
  //      trousers, not just a jacket). Reuses the same waterproof/gust
  //      reasoning as the umbrella-survival check (Section 6.2/7.8): a leg
  //      wet AND windy enough to threaten an umbrella is wet+windy enough
  //      to matter for legwear too.
  const needsWaterproofBottoms = needsWaterproof && maxGust >= HIGH_WIND_KPH;
  const needsThermalBottoms = warmthLevel >= BOTTOMS_COLD_WARMTH_LEVEL;
  let bottoms: Recommendation["bottoms"];
  if (needsWaterproofBottoms || needsThermalBottoms) {
    bottoms = pickLayer(
      inventory, "bottoms", warmthLevel * 2.5, needsWaterproofBottoms, false, journey.departTime, preferTags
    );
    if (needsWaterproofBottoms) {
      notes.push("Wet and windy enough to warrant rain trousers, not just a jacket");
    }
  }

  // --- Accessories (gloves/hat/scarf, plus sun/darkness gear — Section 7.6) ---
  const accessories: LayerPick[] = [];
  const availableAccessories = inventory.clothing.filter(c =>
    c.type === "accessory" && isAvailable(c, journey.departTime));

  // Only worth surfacing once it's actually cold — don't clutter the
  // recommendation card with an accessory suggestion at warmthLevel 0-2.
  if (warmthLevel >= ACCESSORY_WARMTH_LEVEL) {
    const warm = availableAccessories.filter(c => !c.tags || (!c.tags.includes("sunglasses")));
    if (warm.length > 0) {
      accessories.push(...warm);
    } else {
      accessories.push({ fallbackText: "Consider gloves/a hat — it's cold out", layerType: "accessory" });
    }
  }

  // Sun and low-light gear layer on top of (not instead of) cold-weather
  // accessories above — see Section 7.6 for these two functions.
  applySunProtection(accessories, availableAccessories, outdoorLegs, notes);
  applyDarknessGear(accessories, availableAccessories, outdoorLegs, notes);

  // --- Severe weather advisory (Section 7.14) ---
  // A suggestion to reconsider the mode itself, not a gear pick — scoped to
  // walk/cycle/hike legs (a severe drive/bus/train leg is the driver's/
  // operator's problem, not a clothing one) and kept as a single
  // non-blocking sentence, consistent with this app's stance elsewhere
  // (Section 13.8) that it recommends clothing, not safety decisions. Hike
  // legs are included deliberately, not as an afterthought — a multi-hour,
  // elevation-varying leg is if anything the case this advisory matters
  // most for, and excluding it would be a real gap, not a scope choice.
  // Reuses Section 7.11's established fold-over-`hikeSamples` pattern
  // rather than reading `l.weather` directly, since a hike leg's `.weather`
  // is unset in favor of per-sample readings (Section 3).
  const severeLeg = outdoorLegs.find(l => {
    if (l.mode === "hike" && l.hikeSamples) {
      return l.hikeSamples.some(s =>
        s.weather.severity >= SEVERE_WEATHER_SEVERITY || s.weather.windGustKph >= SEVERE_GUST_KPH);
    }
    return (l.mode === "walk" || l.mode === "cycle") &&
      (l.weather!.severity >= SEVERE_WEATHER_SEVERITY || l.weather!.windGustKph >= SEVERE_GUST_KPH);
  });
  const severeModeLabel = severeLeg?.mode === "cycle" ? "cycling" : severeLeg?.mode === "hike" ? "the hike" : "walking";
  const severeWeatherAdvisory = severeLeg
    ? `${severeLeg.label}: conditions look severe enough that you might want to reconsider ${severeModeLabel} today, if you have another option.`
    : undefined;

  return { layers, bottoms, accessories, shoes, umbrella, severeWeatherAdvisory, notes };
}
```

Wind chill, direct-sun/reflection warming, puddle risk, rain-cover
awareness, and the stationary-wait adjustment in the code above are
explained in full in Section 7.8/7.9, after the rest of the engine's
supporting logic below. Cycling exertion and the formal-occasion mode are
covered in Section 7.9 and 7.10 respectively.

Keep the logic table-driven (thresholds as named constants, above) so the
coding agent can tune cutoffs without touching control flow. `getSeason` and
`acFeelsCold` come from Section 6.1 and must be imported into
`src/lib/recommend.ts` alongside this function (or moved into a shared
`src/lib/weather.ts` — agent's choice, just keep them out of the UI layer).
`resolveWarmthOffset()` (Section 7.5.1) and a small generic `clamp(value,
min, max)` utility are used by both `recommendGear()` and
`applyGearFeedback()` — put `clamp` in a shared utils module rather than
duplicating it. `recordWear()` and `isSweatyConditions()` (Section 7.16)
are deliberately *not* called from inside `recommendGear()` — they belong
at the leave-by/RecommendationSnapshot-freeze call site (Section 7.3)
instead, alongside a `updateItemWearTracking()` SQLite write function
analogous to `saveWarmthCalibration()`.

The gear recommendation card (Section 9.3) renders `layers` as a small
ordered stack (base → midlayer → jacket) rather than a single slot, and
`accessories` as an optional row underneath that's simply omitted from
layout entirely when the array is empty — don't reserve visual space for it
on a mild day. `bottoms` (Section 7.13), when present, renders as its own
horizontal slot alongside `shoes`/`umbrella` — not part of the layers
stack, since legwear doesn't visually "stack" the way torso layers do.

### 7.3 Leave-by notifications

The most useful moment for this app is *before* the user opens it — so
scheduling a local notification is worth building in v1, not deferring:

```ts
import * as Notifications from "expo-notifications";

const LEAVE_BY_LEAD_MINUTES = 10; // how long before departure to notify

async function scheduleLeaveByNotification(journey: Journey, recommendation: Recommendation) {
  const departMs = new Date(journey.departTime).getTime();
  const triggerMs = departMs - LEAVE_BY_LEAD_MINUTES * 60_000;
  if (triggerMs <= Date.now()) return; // don't schedule for the past

  const summary = summarizeRecommendation(recommendation); // e.g. "Rain shell + waterproof boots"

  await Notifications.scheduleNotificationAsync({
    identifier: `leave-by:${journey.id}`, // stable id so re-planning cancels/replaces cleanly
    content: {
      title: `Leave in ${LEAVE_BY_LEAD_MINUTES} minutes`,
      body: `${journey.destination.label}: ${summary}`,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(triggerMs) },
  });
}
```

- Schedule/re-schedule whenever a Journey's weather or gear recommendation is
  (re)computed — including when a materialized recurring occurrence
  (Section 3) gets its data fetched for the day.
- If AT GTFS Realtime (Phase 7) reports a delay on a bus/train leg, recompute
  `triggerMs` and call `scheduleNotificationAsync` again with the same
  `identifier` — Expo replaces rather than duplicates.
- Cancel with `Notifications.cancelScheduledNotificationAsync(identifier)` if
  the user deletes the journey or turns off a recurrence's `active` flag.
- Request notification permission from the onboarding flow (Section 4.1) or
  the first time the user plans a journey — not silently on app launch.
- **Overlapping notifications, decided rather than left open**: two
  Journeys with close leave-by times each schedule and fire independently
  — no merging, stacking, or "you have two things happening" combined
  notification. This is deliberate, not an oversight: each notification's
  copy already names the specific route ("Leave by 8:12 to catch the 8:20
  train — grab your rain shell," Section 9.0.1), so even two arriving
  minutes apart are independently identifiable by content, and genuinely
  overlapping departures are low-frequency enough for a single-user commute
  app that dedicated merge logic isn't worth the complexity. If this
  proves wrong in practice, it's a small addition here later, not a
  structural change.
- The same point this notification fires — leave-by time, once nothing else
  is going to change the recommendation — is also when `Journey.recommendationSnapshot`
  (Section 3) gets frozen from the live `Recommendation`, so History (Section
  4.4) later shows exactly what was suggested rather than re-deriving it
  from whatever the inventory happens to look like by then. `recordWear()`
  (Section 7.16) fires at this same point, against the same final
  `Recommendation` being frozen and the same resolved `warmOutdoorC`
  (Section 3.6/7) already computed for that `recommendGear()` call — not
  earlier (a still-changeable recommendation shouldn't count as a real
  wear) and not deferred to the post-journey feedback prompt (Section 4.2),
  since that prompt is skippable and shouldn't gate whether wear gets
  recorded at all.

### 7.4 Home screen widget (native complexity — scope honestly)

A glanceable widget showing "next journey + top recommendation" is high
value but **cannot be built in Expo's plain managed workflow** — it needs a
native widget extension (`WidgetKit` on iOS, App Widgets on Android), which
means either `expo-dev-client` + a config plugin (e.g.
`react-native-android-widget` for Android; iOS widgets still require some
Swift/WidgetKit code even with Expo, there's no pure-JS path yet) or ejecting.
Full spec and phase placement is in Section 13.2 — it's sequenced after the
v1 core (Phases 1–11) since it's a separate native workstream, not because
it's undefined or optional.

### 7.5 Personal calibration from feedback

The warmth-level thresholds in the main engine are one reasonable default —
they won't match everyone, since people genuinely run hot or cold
differently. Rather than exposing five separate temperature-threshold
sliders in Settings (which nobody will tune correctly — see Section 3.6 for
the narrow, opt-in exception to this), calibrate from the low-friction
feedback prompt in Section 4.2, widened to a 5-point scale (Section 3,
`GearFeedback`) so "too warm" and "way too warm" move the offset by
different amounts:

```ts
// Section 3 — GearFeedback is 5-point, ordered coldest to warmest. Each
// value maps to a direction and magnitude relative to WARMTH_CALIBRATION_STEP:
// a "much_too_*" report moves the offset twice as far as a plain
// "too_*" one in the same direction, on the reasoning that someone who
// reaches for the more extreme option is telling you the gap was bigger.
const FEEDBACK_STEP_MULTIPLIER: Record<GearFeedback, number> = {
  much_too_cold: 2,
  too_cold: 1,
  just_right: 0,
  too_warm: -1,
  much_too_warm: -2,
};

async function applyGearFeedback(
  feedback: GearFeedback,
  current: WarmthCalibration,
  season: Season // Section 6.1 — the season the feedback journey actually happened in, not "now"
): Promise<WarmthCalibration> {
  const multiplier = FEEDBACK_STEP_MULTIPLIER[feedback];
  const now = new Date().toISOString();
  if (multiplier === 0) {
    return { ...current, lastFeedbackAt: now }; // "just right" still resets the decay clock (Section 7.5.3) — it's a real data point, not silence
  }
  const delta = multiplier * WARMTH_CALIBRATION_STEP;
  const seasonalOffsets = current.seasonalOffsets ?? { summer: current.offsetLevels, winter: current.offsetLevels, shoulder: current.offsetLevels };
  const seasonalSampleCounts = current.seasonalSampleCounts ?? { summer: 0, winter: 0, shoulder: 0 };
  const next: WarmthCalibration = {
    ...current,
    offsetLevels: clamp(current.offsetLevels + delta, -2, 2), // global fallback still updates too, so it stays a sensible default for a season with no samples yet
    sampleCount: current.sampleCount + 1,
    seasonalOffsets: { ...seasonalOffsets, [season]: clamp(seasonalOffsets[season] + delta, -2, 2) },
    seasonalSampleCounts: { ...seasonalSampleCounts, [season]: seasonalSampleCounts[season] + 1 },
    lastFeedbackAt: now,
  };
  await saveWarmthCalibration(next); // single-row SQLite upsert
  return next;
}

// Section 7.5.1 — what recommendGear() actually reads: prefer the current
// season's own offset once it has at least one sample, otherwise fall back
// to the global offsetLevels so a brand-new user (or a season that hasn't
// had feedback yet) still gets a sensible value instead of 0-with-no-history.
function resolveWarmthOffset(calibration: WarmthCalibration, season: Season): number {
  const seasonalCount = calibration.seasonalSampleCounts?.[season] ?? 0;
  if (seasonalCount > 0 && calibration.seasonalOffsets) {
    return calibration.seasonalOffsets[season];
  }
  return calibration.offsetLevels;
}
```

- Clamp every offset (global and seasonal) to ±2 — beyond that the
  calibration is more likely reflecting a one-off unusual day (sick, forgot
  a jacket, held a hot coffee) than a genuine baseline shift, and an
  unbounded offset could drift recommendations somewhere unsafe in
  genuinely cold conditions.
- This is a set of running offsets, not a model — no need for anything
  fancier than a small step per feedback event, per season, per axis.
- Show `sampleCount` next to the calibration value in Settings ("Adjusted
  from 12 check-ins") purely for transparency — it's not used in the
  calculation, just so the user can see the app isn't guessing blind. When
  seasonal data exists, show the per-season sample counts too (e.g. "Winter:
  adjusted from 5 check-ins · Summer: adjusted from 9"), so it's clear which
  season's number is actually driving today's recommendation.
- **Surface it in the moment, not just in Settings.** The first time
  `offsetLevels` (or the active season's offset) actually changes for each
  of the first ~3 occurrences, show a small non-blocking toast right after
  the feedback tap — "Noticed you run warm — dialing back a layer next
  time" (offset moved negative) or the cold-running equivalent. After those
  first few, stop showing it — this is a one-time "the app is learning"
  moment, not a recurring notification. Track a simple
  `calibrationToastsShown` counter (own row, alongside `WarmthCalibration`)
  to gate it.

#### 7.5.1 Seasonal calibration split

"I run warm" learned entirely from summer feedback doesn't necessarily
hold during a genuine Auckland cold snap, and vice versa — the two
situations call for different baseline adjustments. `WarmthCalibration`
(Section 3) tracks `seasonalOffsets`/`seasonalSampleCounts` per `Season`
(Section 6.1) alongside the original global `offsetLevels`/`sampleCount`,
which remain as the fallback for whichever season doesn't have samples
yet. `resolveWarmthOffset()` above is the single read path — nothing else
in the engine reads `calibration.offsetLevels` directly once seasonal data
exists for the relevant season. Settings (Section 9.1) shows all three
seasonal values together (not just the currently-active one) so the user
can see the full picture, with a one-line explanation of what "seasonal"
means here (see Section 9.1's copy).

#### 7.5.2 Wind-sensitivity axis

General warmth calibration (running hot/cold overall) and wind sensitivity
specifically are different things — someone can dress accurately for cold,
still-air mornings but consistently underestimate how much a windy stretch
affects them, or vice versa. `WarmthCalibration.windSensitivityOffset`
(Section 3) is a second, independent, smaller-range axis
(±`WIND_SENSITIVITY_OFFSET_CLAMP`) that only ever scales the annotation-
gated wind-tunnel bump in the main engine above — it never touches the base
`warmthLevel` calculation or any other delta. It isn't fed by the same
post-journey feedback prompt as `offsetLevels` (that prompt is about the
overall gear call, not wind specifically); instead, expose it directly in
Settings as a small three-position control ("Less bothered by wind" /
"Average" / "More bothered by wind"), each mapping to a fixed value
(-1 / 0 / +1) rather than a free slider, since there's no natural feedback
loop to learn this one from automatically. See Section 9.1 for the
required explanation copy.

#### 7.5.3 Calibration decay

A calibration value with no recent feedback is stale, not necessarily
wrong, but there's no way to tell the difference without checking — someone
who calibrated "runs warm" from a run of mild autumn mornings and then
stopped giving feedback for four months shouldn't have that value silently
govern a midwinter recommendation. Any bucket (`offsetLevels`, each entry
in `seasonalOffsets`, and `windSensitivityOffset`) whose most recent
contributing feedback is older than `CALIBRATION_DECAY_AFTER_DAYS` (60) is
nudged `CALIBRATION_DECAY_STEP` (0.25) closer to 0 each time the decay
check runs, rather than left frozen indefinitely. Run the check on app
foreground (cheap, local-only — no new background task needed) using
`lastFeedbackAt` as the reference point; Section 12.2's dev menu should
expose a manual "run calibration decay now" trigger so this is testable
without waiting 60 real days. Decay stops once an offset reaches 0 — it
never overshoots into the opposite sign.

### 7.6 Sun and low-light gear

Rain and cold aren't the only conditions worth dressing for — Open-Meteo's
`uv_index` and `is_day` fields (already requested per-leg, Section 2) cover
the other common cases:

```ts
function applySunProtection(
  accessories: LayerPick[],
  available: ClothingItem[],
  outdoorLegs: JourneyLeg[],
  notes: string[]
) {
  // Effective UV per leg reuses the same highReflection offset as the main
  // engine's sunLeg check (Section 7.8) — one composed number, not a
  // separate reflection-specific accessory threshold to keep in sync.
  const effectiveUv = (l: JourneyLeg) => l.weather!.uvIndex + (l.highReflection ? HIGH_REFLECTION_UV_OFFSET : 0);
  const maxEffectiveUv = Math.max(...outdoorLegs.map(effectiveUv));
  if (maxEffectiveUv < HIGH_UV_INDEX) return;
  const sunglasses = available.find(c => c.tags?.includes("sunglasses"));
  accessories.push(sunglasses ?? { fallbackText: "UV is high — sunglasses/a hat recommended", layerType: "accessory" });
  const anyReflective = outdoorLegs.some(l => l.highReflection);
  notes.push(
    anyReflective
      ? `UV index reaching ${Math.round(Math.max(...outdoorLegs.map(l => l.weather!.uvIndex)))} today, higher still with reflection off sand/water`
      : `UV index reaching ${Math.round(maxEffectiveUv)} today`
  );
}

function applyDarknessGear(
  accessories: LayerPick[],
  available: ClothingItem[],
  outdoorLegs: JourneyLeg[],
  notes: string[]
) {
  const anyDarkLeg = outdoorLegs.some(l => l.weather && !l.weather.isDaylight);
  if (!anyDarkLeg) return;
  const reflective = available.find(c => c.tags?.includes("reflective"));
  if (reflective) {
    accessories.push(reflective);
    notes.push("Part of this trip is in the dark — reflective gear picked");
  } else {
    notes.push("Part of this trip is in the dark — consider something reflective or a light, if you own one");
  }
}
```

Both functions only add to `accessories`/`notes` when relevant — most
journeys hit neither, and the card stays uncluttered on a normal daylight,
low-UV commute. `ClothingItem.tags` (Section 3) is how the engine tells a
pair of sunglasses or a reflective vest apart from a plain wool hat — the
onboarding gear checklist (Section 4.1) and Gear CRUD screens should let the
user attach tags when adding an accessory, with `sunglasses`/`reflective`/
`gloves`/`hat`/`scarf`/`socks` offered as quick-select chips rather than
free text, so the engine can actually rely on matching against them. The
same quick-select mechanism applies to jackets/midlayers/bottoms, offering
`cycling` (Section 7.9) and `formal` (Section 7.10) chips there, so
`pickLayer()`'s `preferTags` has something real to match against —
`bottoms` (Section 7.13) reuses the identical two chips rather than
introducing legwear-specific ones.

### 7.7 Unavailable gear

An item that's in the wash, lost, or at the dry cleaner shouldn't keep
getting recommended with false confidence. Every selection function above
(`pickLayer`, the umbrella `find`, the shoe filter) already checks
`isAvailable(item, journey.departTime)` before considering an item a
candidate — this section just covers the UI side: the Gear CRUD screens
(Section 4) need a lightweight "mark unavailable until…" action per item
rather than requiring the user to delete and re-add an item they still own
but can't currently wear. An unavailable item still shows in its Gear list
(greyed out, with the return date) — it's excluded from recommendations,
not from inventory.

The action now includes a reason picker (`unavailableReason`, Section 3):
Laundry / Repair / Lost / Other, each with its own sensible default
turnaround the user can still adjust — Laundry defaults to
`LAUNDRY_DEFAULT_TURNAROUND_DAYS` (2 days, a realistic wash-and-dry cycle),
Repair/Other default to +3 days as before, Lost defaults to no date (open-
ended until the user finds it or deletes the item). Choosing "Laundry"
also resets `wearsSinceClean` to 0 and clears `needsCleaning` (Section
7.16) in the same action — one combined write, since marking something as
being washed and resetting its wear count are really the same event. The
Gear list shows the specific reason rather than a generic "Unavailable"
("In the laundry — back Thursday" vs. "Being repaired — back Thursday").

### 7.8 Feels-like adjustments: wind, sun, and puddles

These signals (Sections 3.4, 5.5) adjust `recommendGear()` without needing
any new API call beyond what Section 2/6.2 already requests. **All of the
adjustments below are hyper-local corrections layered on top of
`apparentTempC` (Section 6.2), not a restatement of general ambient
conditions** — `apparentTempC` already incorporates Open-Meteo's own
wind/humidity/solar model for the general area, so there is no separate
"is it windy today" or "is it sunny today" check here. These only fire when
an `EnvironmentAnnotation` (Section 3.4) says a *specific* street or spot
deviates from that citywide baseline.

- **Wind chill (annotation-gated)** only fires on a leg flagged
  `windEffect === "amplified"` (a wind-tunnel annotation) whose effective
  wind (raw `windKph` × `WIND_TUNNEL_MULTIPLIER`) clears `WIND_CHILL_KPH`.
  This is deliberately separate from `HIGH_WIND_KPH` (the umbrella-rating
  threshold, 30kph, using `windGustKph` — Section 6.2) — wind chill affects
  *layering*, umbrella rating affects *which umbrella survives being
  outside*, and there's no reason those two thresholds or fields need to
  match. **`WIND_CHILL_KPH` is 15, not 20** — corrected from an earlier
  draft. The standard NWS/Environment Canada wind-chill formula shows a
  real, human-noticeable feels-like depression (~2°C) already at around
  15kph of sustained wind at typical Auckland winter temperatures, and
  Auckland's own average wind speed (14–18kph) sits right at that point —
  a threshold at or above the city's average was suppressing a real effect
  on an ordinary day rather than reserving the note for something unusual.
  How often a true effect fires isn't a reason to raise the bar for
  reporting it. One caveat worth carrying forward rather than hiding: that
  formula is formally validated only for ambient temperatures at or below
  ~10°C, and a lot of Auckland's "cool and breezy" mornings sit a few
  degrees past that — treat the resulting `apparentTempC` in that band as a
  well-grounded approximation, not an exact physiological reading, the same
  spirit as Section 5.3's forecast-confidence caveat. The `+1` bump this
  produces is itself scaled per-user by `WarmthCalibration.windSensitivityOffset`
  (Section 7.5.2) — someone who's told the app they're more bothered by
  wind than average gets a slightly larger bump here specifically, without
  changing how any other, non-wind delta behaves.
- **Direct-sun/reflection warming (annotation-gated)** only fires on a leg
  flagged `sunEffect === "exposed"`, when it's actually daylight
  (`isDaylight`) and UV is high (reusing `HIGH_UV_INDEX` — the same
  threshold that already drives sunglasses in Section 7.6, and which
  matches the WHO UV index scale's official "High" band starting at 6).
  It's a one-level warmth reduction, the same nominal magnitude as the
  wind-tunnel bump, so a windy-tunnel-but-sunny-exposed leg can net to no
  change — a simplification worth naming honestly: published outdoor
  thermal-comfort research doesn't agree on whether wind or sun has the
  larger effect (it's highly context-dependent — cloud cover, sun angle,
  wind speed all matter, and different field studies have found each
  effect larger than the other), so treating them as equal-and-opposite
  here is a defensible approximation, not a precisely-measured tradeoff.
  `sun-exposed` annotations don't add an *extra* reduction beyond the
  UV-index check — they exist mainly to override a `shaded` assumption
  that wouldn't otherwise trigger, not to stack with it. A `highReflection`
  leg (Section 3.4/3.5) composes into the *same* check by lowering the
  effective threshold via `HIGH_REFLECTION_UV_OFFSET`, rather than adding a
  second reduction — a beach leg still only ever costs one warmth level,
  it's just easier to trigger than a shaded-city-street leg at the same raw
  UV reading.
- **Puddle risk** is scoped to footwear only, never jacket/umbrella
  choice — by definition it's checked because current conditions are dry
  (a currently-raining leg is already caught by `needsWaterproof`), so
  there's nothing for a jacket to protect against beyond what's already
  handled. It's also intentionally coarse (one boolean per journey, not
  per-leg precision) — see Section 5.5 for why a single
  `recentPrecipMm6h` value is reused across all of a journey's legs.
- **Rain cover** is the one signal here that's informational only — it
  doesn't change *whether* to bring an umbrella (the uncovered part of the
  route still needs one), just adds a note setting expectations for the
  covered stretch.
- All of the notes these adjustments add follow the voice guide (Section
  9.0.1) — naming the specific leg/annotation rather than a generic
  "it'll feel different than expected," since specificity is the entire
  point of this feature.

### 7.9 Stationary waits, cycling exertion, and carry preference

Three related refinements to how the engine reasons about *how* someone is
moving through a journey, not just what the weather is doing — grouped here
since all three touch the same warmup/exertion logic in the core function
above rather than adding an independent adjustment like Section 7.8's.

- **Stationary waits** (`JourneyLeg.isStationary`, Section 3.5, wired in
  Section 5.6): standing on an open platform for a delayed train, or
  waiting in a pickup queue, is outdoor exposure with none of the
  body-heat generation a walking leg assumes. `totalOutdoorStationaryMinutes()`
  totals this time separately from `totalOutdoorExertionMinutes()`, and a
  wait of `STATIONARY_WAIT_MIN_MINUTES` or more in cool-or-colder
  conditions bumps `warmthLevel` up by one — the same direction and
  magnitude as wind chill (Section 7.8), on the reasoning that "cold and
  standing still" behaves more like "cold and windy" than "cold and
  walking." Critically, a stationary leg is *excluded* from the warmup
  discount below — it must never accidentally count toward the minutes
  that make a recommendation lighter.
- **Cycling exertion**: `totalOutdoorExertionMinutes()` evaluates `walk`
  and `cycle` legs against separate thresholds
  (`WARMUP_WALK_MIN_MINUTES` vs. the lower `WARMUP_CYCLE_MIN_MINUTES`),
  since sustained cycling builds body heat faster than walking over the
  same duration — the original single shared threshold undersold how much
  lighter a cyclist can dress for a given temperature. A journey with both
  a walking leg and a cycling leg earns the discount from whichever one
  actually clears its own threshold, and the note names whichever exertion
  type qualified rather than a generic "walking" label. `pickLayer()`
  additionally biases toward a `"cycling"`-tagged jacket or trouser
  (Section 3, `ClothingItem.tags`) when the journey has any cycling
  minutes and `needsWaterproof` is true, since cycling rain gear (a
  cycling-cut waterproof, less bulky at the knees) is a genuinely
  different pick from a standing-still-friendly walking shell.
- **Carry preference** (`CarryPreference`, Section 3, 4.3.1, 9.1): someone
  moving between classes or meetings with a full bag often won't actually
  carry a spare layer even when the engine would otherwise recommend a
  packable one. `recommendGear()` takes the resolved `CarryPreference` as
  a parameter — the caller resolves `journey.carryPreference ??
  <Settings default>` before calling — and when it's `"avoid-spares"`,
  overrides the AC-contrast branch's `requirePackable = true` back to
  `false`, trading the removable-layer strategy for the warmest single
  wearable layer and a note explaining the tradeoff ("Skipping a spare
  layer per your preference — the bus AC may feel cold"). This is a
  deliberate user-chosen override of Section 6.1's AC-contrast logic, not
  a bug in it.
- **Explicitly out of scope**: tracking or suggesting a post-cycling
  change of clothes (e.g. "you'll arrive sweaty") is not a gear
  *recommendation* concern — this app tells you what to wear, not what to
  pack as a spare outfit — and is left out entirely rather than half-built
  as a stray note, keeping the engine's output limited to items it can
  actually resolve from `Inventory`.

### 7.10 Formal-occasion mode

`Journey.formal` (Section 3, set via the Plan-screen toggle in Section
4.3.1) changes what `recommendGear()` optimizes for: appearance-appropriate
items over the usual grip/waterproof-first selection, on the reasoning that
someone dressing for a wedding or a work function would rather carry an
umbrella than show up in technically-optimal but visually-wrong footwear.

- **Shoes**: when `isFormal` is true, the engine looks for an available
  `ShoeItem` with `type === "formal"` *before* falling back to the normal
  grip/waterproof sort — `ShoeType` already includes `"formal"` (Section
  3), so this needed no new data model, only a reordered selection path. If
  the chosen formal shoe isn't waterproof and conditions call for one, a
  note says so explicitly rather than silently downgrading
  weather-appropriateness without explanation — the umbrella is doing the
  weather-protection work in this mode, not the shoe.
- **Layers**: the wind-chill `+1` adjustment (Section 7.8) is suppressed
  when `isFormal` is true — a heavy added layer is more likely to clash
  with the occasion than help, so the engine relies on the umbrella pick
  and a note instead. The AC-contrast and warmup-discount logic are
  unaffected; formal mode changes what's *added* for wind, not the
  baseline warmth calculation.
- `pickLayer()` also biases toward `"formal"`-tagged jackets/midlayers
  (Section 3, `ClothingItem.tags`) the same way it biases toward
  `"cycling"`-tagged ones in Section 7.9, via the shared `preferTags`
  parameter.

### 7.11 Hike engine adjustments

Full context in Section 13.8 (Phase 20) — this subsection covers only how
`recommendGear()` itself changes for a `hike` leg (Section 3, 3.5, 5.7),
since a multi-hour, elevation-varying leg doesn't reduce to a single
`weather` reading the way every other leg type does:

- Wherever the core function reads `l.weather!.apparentTempC`/`.windGustKph`/
  etc. for an ordinary outdoor leg, a `hike` leg instead contributes the
  *worst* (coldest / gustiest) reading across its `hikeSamples[]` array —
  i.e. `minTemp` and `maxGust` fold in `Math.min`/`Math.max` across every
  sample point, not just the leg as a whole, so a summit's colder, gustier
  conditions aren't averaged away by a milder trailhead reading. Note that
  `apparentTempC`'s own wind/humidity/solar model (Section 6.2) is computed
  by Open-Meteo per sample point already, so no separate per-sample
  wind-chill calculation is needed here beyond that fold.
- The warmup discount uses a third exertion threshold,
  `WARMUP_HIKE_MIN_MINUTES` (set higher than both `WARMUP_WALK_MIN_MINUTES`
  and `WARMUP_CYCLE_MIN_MINUTES` — sustained hiking effort still builds
  heat, but elevation gain adds a countervailing cooling effect a flat
  urban walk doesn't have to account for), evaluated against the hike
  leg's total duration rather than folded into
  `totalOutdoorExertionMinutes()`'s walk/cycle split.
- Forecast confidence (Section 5.3) matters more here, not less — hikes
  are disproportionately planned days ahead. When any of a hike leg's
  `hikeSamples[].weather.forecastConfidence` is `medium`/`low`, add a note
  to that effect even though Journey Detail's confidence banner (Section
  9.3) already surfaces it visually, since a multi-hour hike is a worse
  place to be caught by a wrong forecast than a 10-minute commute and
  deserves the redundancy.
- Named constants for this subsection (`WARMUP_HIKE_MIN_MINUTES` and any
  elevation-gain offset the agent tunes in) belong alongside the rest of
  Section 7's threshold block when Phase 20 is implemented, following the
  same "thresholds as named constants, don't touch control flow" rule the
  rest of this section already follows.
- The severe-weather advisory (Section 7.14) already accounts for `hike`
  legs via this same `hikeSamples[]` fold, written now alongside the rest
  of `recommendGear()` even though it stays effectively dead code until
  `mode === "hike"` legs actually exist (Phase 20) — consistent with
  `hikeSamples` itself being in the Phase 1 schema early for the same
  reason (nothing before Phase 20 writes to it, but the shape is right).

### 7.12 Dual-purpose jackets (jacket-absorbs-midlayer)

Some jackets already do a midlayer's job — a rain shell with a built-in
thin puffer lining is the motivating example: it's simultaneously the
`waterproof` pick for a wet leg and warm enough that nothing needs to go
under it. Without this section, `layerPlanForWarmthLevel()` would still
resolve `["midlayer", "jacket"]` at warmth level 3 and `pickLayer()` would
fill both slots independently, telling the user to add a separate midlayer
underneath a jacket that's already doing that job.

- `ClothingItem.substitutesForMidlayer` (Section 3.6) marks an item as
  capable of this. It's a per-item boolean the user sets explicitly in the
  Gear CRUD form when adding/editing a jacket — the engine never infers it
  from `warmth` alone, since a high `warmth` rating on its own doesn't tell
  the engine whether the item is cut/insulated to actually replace a
  separate layer versus just being a heavy jacket meant to go over one.
- After the normal layer resolution (main function, step 4), if a
  `midlayer` slot was resolved *and* the resolved `jacket` is a real owned
  item (not `fallbackText`) with `substitutesForMidlayer: true` *and* its
  own `warmth` already meets or exceeds the leg's target warmth, the
  midlayer is dropped from the final `layers[]` and a note explains why
  ("Your Blue rain shell is warm enough on its own — no separate midlayer
  needed underneath") rather than silently shrinking the recommendation
  with no explanation.
- If the substitutable jacket is unavailable this trip (Section 7.7) or
  wasn't the item actually picked (e.g. a warmer non-substituting jacket
  won the sort instead), the normal two-slot plan applies unchanged — this
  only fires when the specific substitutable item is the one being
  recommended.
- Deliberately scoped narrowly to jacket-absorbing-midlayer only, not a
  general "any item can stand in for any layer" system — see the note in
  `DECISIONS.md` on why this stays a single boolean rather than a more
  general substitution graph, which would be a genuinely different scale
  of change (the same category of decision as the multi-user (Section 2.2)
  and cloud-sync (Section 13.7) scope calls elsewhere in this spec).

### 7.13 Legwear (bottoms)

Before this section, the engine had no concept of trousers/leggings at
all — `ClothingType` covered only torso layers and accessories, despite
`pickLayer()`'s own comments elsewhere referencing a "trouser" as if it
were already a recommendable type. `"bottoms"` (Section 3) fills that gap,
evaluated independently of the base/midlayer/jacket stack in the main
function's step 4.5, since legwear doesn't "layer" the way torso items do
— there's one bottoms slot, not an ordered stack.

- **When it fires**: only two triggers, both narrow on purpose so a normal
  mild/dry commute doesn't get a redundant "regular trousers are fine"
  slot cluttering the card (Section 9.3 omits `Recommendation.bottoms`
  entirely when `undefined`, the same "hide, don't reserve space" pattern
  layers/accessories already use):
  - **Thermal**: `warmthLevel >= BOTTOMS_COLD_WARMTH_LEVEL` (4) — a
    genuine cold snap, the same tier that already triggers the full
    base+midlayer+jacket stack.
  - **Waterproof**: `needsWaterproof && maxGust >= HIGH_WIND_KPH` — reusing
    the exact same gust field and threshold as the umbrella-survival check
    (Section 6.2/7.8). The reasoning: a leg wet *and* windy enough to
    threaten an umbrella is also wet+windy enough that ordinary trousers
    are genuinely miserable, not just a jacket-and-umbrella problem. Plain
    rain without that wind isn't enough on its own — an umbrella already
    covers that case adequately.
- **Selection**: reuses `pickLayer()` directly rather than a separate
  function — `pickLayer(inventory, "bottoms", warmthLevel * 2.5,
  needsWaterproofBottoms, false, journey.departTime, preferTags)`. The same
  `preferTags` array computed for the layers stack (cycling/formal,
  Section 7.9/7.10) applies here too, so a cycling-tagged legging or a
  formal-tagged trouser is preferred the same way a cycling/formal jacket
  already is.
- **`requirePackable` is always `false` for bottoms** — the AC-contrast
  packable requirement (Section 6.1) is specifically about a removable
  torso layer for a bus/train temperature swing; trousers aren't
  reasonably "packable" in the same sense, so this never applies to the
  bottoms slot.
- **Fallback text** falls out of `pickLayer()`'s existing generic fallback
  ("No available bottoms for these conditions") with no extra code needed,
  since `ClothingType` already includes `"bottoms"` end to end.

### 7.14 Severe-weather advisory

Everything in this section up to now only ever changes *what to wear* —
nothing tells the user that today's conditions might mean reconsidering
*whether* to walk or cycle at all, despite the engine already tracking
storm-level `severity` and gust speed. `Recommendation.severeWeatherAdvisory`
(above) closes that gap as a single suggestion sentence, kept deliberately
narrow:

- **Trigger**: any `walk`, `cycle`, or `hike` leg where `severity >=
  SEVERE_WEATHER_SEVERITY` (4, "Stormy") or `windGustKph >=
  SEVERE_GUST_KPH` (60 — well above `HIGH_WIND_KPH`'s 30kph
  umbrella-survival threshold, since this is about the walk/cycle/hike
  itself being unpleasant or unsafe, not just an umbrella surviving it). A
  `hike` leg checks this against the worst reading across its
  `hikeSamples[]` (Section 7.11's established fold), not a single
  `.weather` reading, which hike legs don't populate. Deliberately excludes
  `drive`/`bus`/`train`/indoor legs — a storm is the driver's or transit
  operator's problem on those modes, not a clothing or route-choice one for
  the rider. Hike is included deliberately rather than as an oversight — a
  multi-hour, elevation-varying, exposed leg is arguably the case this
  advisory matters most for, not a marginal one.
- **Not a blocking action**: this is a suggestion surfaced as its own
  banner on Journey Detail (Section 9.3), not a modal, not a re-routing
  prompt, and not folded into `notes[]` (which is about gear reasoning,
  not mode reasoning). The user can plan and depart exactly as before;
  the advisory is informational.
- **Consistent with the app's existing safety stance**: Section 13.8
  (hike mode) already draws an explicit line that this app "recommends
  clothing from the user's own inventory; it is not a hiking safety app."
  This advisory doesn't cross that line — it's one sentence derived from
  data the engine already has, not a live weather-safety monitoring
  feature, live tracking, or anything that implies the app is watching
  out for the user beyond the single planning-time check.
- **Only the worst matching leg is named** — if multiple legs qualify,
  the first one found is used for the sentence (consistent with
  `worstOutdoor`'s "first sufficiently bad match" pattern elsewhere in
  this function); a journey rarely has more than one severe leg, and
  naming all of them would turn one sentence into several.

### 7.15 Hot-weather guidance

The engine is otherwise entirely cold-direction: `warmthLevelFromTemp()`
bottoms out at level 0 for anything at or above `WARM_OUTDOOR_C`, and
level 0 means "no extra layer" with no further guidance — silent on a
genuinely hot, humid Auckland summer day rather than offering anything
positive. `HOT_C` (24°C, deliberately higher than `WARM_OUTDOOR_C`'s 18°C
so this doesn't fire on every merely-mild day) adds a single note when any
outdoor leg's `apparentTempC` reaches it: "Warm enough today that
something breathable and light-colored will feel better than your usual
pick."

- **Note only, not an item pick** — there's no `breathable` attribute on
  `ClothingItem` to match against, so the engine can flag the condition
  honestly but can't resolve a specific breathable item the way it
  resolves a jacket or umbrella. Adding a `breathable` boolean/tag and
  biasing `pickLayer()`'s base-layer sort toward it (the same `preferTags`
  mechanism already used for cycling/formal) is a natural next step if
  this proves not enough, but is left out here deliberately rather than
  half-built — see `DECISIONS.md`.
- Composes normally with the rest of the notes array; a hot, high-UV,
  daylight leg can reasonably show both this note and the sun-protection
  note from Section 7.6 in the same recommendation, since they're
  independent signals.

### 7.16 Wardrobe rotation & wash reminders

Section 3.7 introduces the data shape (`wearsSinceClean`, `lastWornAt`,
`needsCleaning`, `unavailableReason`); this section covers the mechanism
that actually updates it.

```ts
// Called once per completed Journey — the same trigger point as the
// post-journey feedback prompt (Section 4.2) and the RecommendationSnapshot
// freeze (Section 7.3), i.e. departTime + total leg duration has passed.
// NEVER called from inside recommendGear() itself: recommendGear() must
// stay a pure function with no I/O (Section 11.1) and can legitimately be
// called many times against the same still-future Journey (re-planning,
// forecast-drift refreshes, Section 5.2) without each call counting as a
// real-world "wear." `warmOutdoorC` is passed in rather than re-read from
// the raw named constant, so a user's `AdvancedWarmthThresholds` override
// (Section 3.6) is respected here the same way it already is inside
// `recommendGear()` — the call site (Section 7.3) already has this
// resolved value on hand from the same `recommendGear()` call whose output
// is being frozen, so it costs nothing extra to pass along.
async function recordWear(recommendation: Recommendation, journey: Journey, warmOutdoorC: number): Promise<void> {
  const wornItems = [
    recommendation.bottoms,
    recommendation.shoes,
    ...recommendation.layers,
    // Section 7.16 — accessories are otherwise excluded from wear tracking
    // (see the note below), but a sock-tagged item is the one clear
    // exception: it's a real recommended item (Section 7.6 pushes any
    // available non-sunglasses accessory, socks included, once cold enough)
    // and genuinely needs washing as often as a base layer does.
    ...recommendation.accessories.filter(a => "id" in a && a.tags?.includes("socks")),
  ].filter((item): item is ClothingItem | ShoeItem => !!item && "id" in item);
  const sweaty = isSweatyConditions(journey, warmOutdoorC);
  for (const item of wornItems) {
    const wearsSinceClean = (item.wearsSinceClean ?? 0) + 1;
    await updateItemWearTracking(item.id, {
      wearsSinceClean,
      lastWornAt: journey.departTime,
      needsCleaning: sweaty || wearsSinceClean >= WASH_REMINDER_WEAR_COUNT,
    });
  }
}

// Reuses the exact same exertion signals already computed for the warmup
// discount (Section 7.9) — sustained walking/cycling exertion in
// warm-enough conditions is the same "you probably worked up a sweat"
// proxy either way, so this doesn't introduce a second definition of it.
function isSweatyConditions(journey: Journey, warmOutdoorC: number): boolean {
  const walkingMinutes = totalOutdoorExertionMinutes(journey, "walk");
  const cyclingMinutes = totalOutdoorExertionMinutes(journey, "cycle");
  const hasWarmOutdoor = journey.legs.some(l => l.outdoor && l.weather && l.weather.apparentTempC >= warmOutdoorC);
  return hasWarmOutdoor && (walkingMinutes >= WARMUP_WALK_MIN_MINUTES || cyclingMinutes >= WARMUP_CYCLE_MIN_MINUTES);
}
```

- **Accessories (other than socks) and umbrellas are deliberately
  excluded** from `wornItems` — an umbrella doesn't need "washing" the way
  clothing does, and cold-weather accessories like gloves/hats/scarves are
  a lower-value target for this reminder than the layers/bottoms/shoes
  that actually touch skin and generate sweat; left out to keep the
  reminder meaningful rather than noisy. A sock-tagged accessory item is
  the deliberate exception (see `recordWear()` above) — it's exactly the
  kind of item that needs washing as often as a base layer, and singling
  it out by tag is simpler and more honest than either tracking every
  accessory or excluding socks along with gloves/hats for no good reason.
- **`needsCleaning` is a reminder, never an automatic exclusion.** A
  flagged item still gets recommended by `pickLayer()`/the shoe sort until
  the user actually acts on it — nothing in `isAvailable()` (Section 7)
  reads `needsCleaning`. Only `unavailableUntil` excludes an item, and
  that's still only ever set by an explicit user action.
- **"Mark as washing" action** (Gear list badge, Section 4/9.4.1): sets
  `unavailableUntil = now + LAUNDRY_DEFAULT_TURNAROUND_DAYS`,
  `unavailableReason = "laundry"`, resets `wearsSinceClean = 0`, and clears
  `needsCleaning` — one combined write, not three separate ones the user
  has to trigger.
- **Not a rotation algorithm.** This never changes `pickLayer()`'s sort
  order or deprioritizes a recently-worn-but-clean item in favor of an
  equally-suitable one that's been worn less — it only ever tells the user
  "this one probably needs a wash." See Section 3.7 for why active
  rotation was deliberately left out.

---

