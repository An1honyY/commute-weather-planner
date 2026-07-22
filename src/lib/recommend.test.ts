import { recommendGear, type Inventory } from "./recommend";
import type { ClothingItem, Journey, JourneyLeg, ShoeItem, UmbrellaItem, WarmthCalibration, WeatherSnapshot } from "../types";

// docs/11-testing-strategy.md §11.1 — recommendGear() is "the highest-value
// target in the app": table-driven cases across warmth levels, AC-contrast,
// the apparent-temperature divergence note, unavailable-gear filtering,
// calibration offset, cycling-vs-walking warmup split, carryPreference
// override, formal-mode overrides, dual-purpose jacket, bottoms triggers,
// severe-weather advisory, hot-weather note, sun/darkness accessories, and
// the stationary-wait aggravation, plus (Phase 6) puddle risk, rain-cover,
// and the annotation-gated wind/sun/reflection deltas (§7.8).

const HOME = { id: "home", label: "Home", address: "1 Home St", lat: -36.8485, lng: 174.7633 };
const WORK = { id: "work", label: "Work", address: "2 Work St", lat: -36.86, lng: 174.77 };
const NO_CALIBRATION: WarmthCalibration = { offsetLevels: 0, sampleCount: 0 };

function weather(overrides: Partial<WeatherSnapshot> = {}): WeatherSnapshot {
  return {
    time: "2026-07-20T08:00:00.000Z",
    weatherCode: 1,
    precipMm: 0,
    precipProbability: 10,
    tempC: 15,
    apparentTempC: 15,
    windKph: 10,
    windGustKph: 15,
    relativeHumidityPct: 60,
    uvIndex: 2,
    isDaylight: true,
    forecastConfidence: "high",
    ...overrides,
  };
}

function walkLeg(overrides: Partial<JourneyLeg> = {}): JourneyLeg {
  return {
    id: "leg-1",
    mode: "walk",
    label: "Walk to Work",
    durationMin: 10,
    startTime: "2026-07-20T08:00:00.000Z",
    outdoor: true,
    weather: weather(),
    ...overrides,
  };
}

function journeyWithLegs(legs: JourneyLeg[], overrides: Partial<Journey> = {}): Journey {
  return {
    id: "journey-1",
    origin: HOME,
    destination: WORK,
    departTime: "2026-07-20T08:00:00.000Z",
    legs,
    ...overrides,
  };
}

let clothingCounter = 0;
function clothingItem(overrides: Partial<ClothingItem> = {}): ClothingItem {
  clothingCounter++;
  return {
    id: `clothing-${clothingCounter}`,
    name: `Item ${clothingCounter}`,
    type: "jacket",
    warmth: 5,
    waterproof: false,
    windproof: false,
    packable: false,
    ...overrides,
  };
}

function shoeItem(overrides: Partial<ShoeItem> = {}): ShoeItem {
  return { id: "shoe-1", name: "Sneakers", type: "sneaker", waterproof: false, grip: "med", ...overrides };
}

function umbrellaItem(overrides: Partial<UmbrellaItem> = {}): UmbrellaItem {
  return { id: "umbrella-1", name: "Compact umbrella", type: "compact", windRating: "med", ...overrides };
}

function inventory(overrides: Partial<Inventory> = {}): Inventory {
  return { clothing: [], shoes: [shoeItem()], umbrellas: [umbrellaItem()], ...overrides };
}

describe("recommendGear — warmth levels", () => {
  const fullInventory = inventory({
    clothing: [
      clothingItem({ type: "base", warmth: 1 }),
      clothingItem({ type: "midlayer", warmth: 5 }),
      clothingItem({ type: "jacket", warmth: 8 }),
    ],
  });

  it("freezing (level 4): base + midlayer + jacket", () => {
    const journey = journeyWithLegs([walkLeg({ weather: weather({ apparentTempC: 1 }) })]);
    const result = recommendGear(journey, fullInventory, NO_CALIBRATION, "no-preference");
    expect(result.layers.map((l) => ("id" in l ? l.type : l.layerType))).toEqual(["base", "midlayer", "jacket"]);
  });

  it("cold (level 3): midlayer + jacket", () => {
    const journey = journeyWithLegs([walkLeg({ weather: weather({ apparentTempC: 5 }) })]);
    const result = recommendGear(journey, fullInventory, NO_CALIBRATION, "no-preference");
    expect(result.layers.map((l) => ("id" in l ? l.type : l.layerType))).toEqual(["midlayer", "jacket"]);
  });

  it("cool (level 2), no packable requirement: jacket only", () => {
    const journey = journeyWithLegs([walkLeg({ weather: weather({ apparentTempC: 10 }) })]);
    const result = recommendGear(journey, fullInventory, NO_CALIBRATION, "no-preference");
    expect(result.layers.map((l) => ("id" in l ? l.type : l.layerType))).toEqual(["jacket"]);
  });

  it("mild (level 1): midlayer only", () => {
    const journey = journeyWithLegs([walkLeg({ weather: weather({ apparentTempC: 15.5 }) })]);
    const result = recommendGear(journey, fullInventory, NO_CALIBRATION, "no-preference");
    expect(result.layers.map((l) => ("id" in l ? l.type : l.layerType))).toEqual(["midlayer"]);
  });

  it("warm (level 0): no extra layers", () => {
    const journey = journeyWithLegs([walkLeg({ weather: weather({ apparentTempC: 20 }) })]);
    const result = recommendGear(journey, fullInventory, NO_CALIBRATION, "no-preference");
    expect(result.layers).toEqual([]);
  });
});

describe("recommendGear — advanced threshold overrides (§3.6, §7, §11.1)", () => {
  const fullInventory = inventory({
    clothing: [
      clothingItem({ type: "base", warmth: 1 }),
      clothingItem({ type: "midlayer", warmth: 5 }),
      clothingItem({ type: "jacket", warmth: 8 }),
    ],
  });

  // Default coolUpperC is 14 — 13°C is normally "cool" (level 2, jacket only).
  it("a custom coolUpperC moves warmthLevelFromTemp()'s boundary", () => {
    const journey = journeyWithLegs([walkLeg({ weather: weather({ apparentTempC: 13 }) })]);
    const defaultResult = recommendGear(journey, fullInventory, NO_CALIBRATION, "no-preference");
    expect(defaultResult.layers.map((l) => ("id" in l ? l.type : l.layerType))).toEqual(["jacket"]);

    // With coolUpperC lowered to 10, 13°C now falls into the next bucket up
    // (mild, level 1: midlayer only) since it's no longer below the cutoff.
    const overriddenResult = recommendGear(journey, fullInventory, NO_CALIBRATION, "no-preference", { coolUpperC: 10 });
    expect(overriddenResult.layers.map((l) => ("id" in l ? l.type : l.layerType))).toEqual(["midlayer"]);
  });

  it("a custom freezingC moves the freezing boundary", () => {
    const journey = journeyWithLegs([walkLeg({ weather: weather({ apparentTempC: 3 }) })]);
    // Default freezingC is 2 — 3°C isn't freezing (falls into level 3: midlayer + jacket).
    const defaultResult = recommendGear(journey, fullInventory, NO_CALIBRATION, "no-preference");
    expect(defaultResult.layers.map((l) => ("id" in l ? l.type : l.layerType))).toEqual(["midlayer", "jacket"]);

    // Raising freezingC to 5 makes 3°C count as freezing (level 4: base + midlayer + jacket).
    const overriddenResult = recommendGear(journey, fullInventory, NO_CALIBRATION, "no-preference", { freezingC: 5 });
    expect(overriddenResult.layers.map((l) => ("id" in l ? l.type : l.layerType))).toEqual(["base", "midlayer", "jacket"]);
  });

  it("no override supplied leaves the default named constants untouched", () => {
    const journey = journeyWithLegs([walkLeg({ weather: weather({ apparentTempC: 13 }) })]);
    const noArgResult = recommendGear(journey, fullInventory, NO_CALIBRATION, "no-preference");
    const emptyOverrideResult = recommendGear(journey, fullInventory, NO_CALIBRATION, "no-preference", {});
    expect(emptyOverrideResult.layers).toEqual(noArgResult.layers);
  });

  it("a custom warmOutdoorC changes when the summer AC-contrast note triggers", () => {
    const busLeg = walkLeg({ id: "bus", mode: "bus", outdoor: false, climate: "ac", weather: undefined });
    // 16°C is below the default warmOutdoorC (18) — no AC-contrast note.
    const journey = journeyWithLegs(
      [walkLeg({ weather: weather({ apparentTempC: 16 }) }), busLeg],
      { departTime: "2026-01-15T08:00:00.000Z" } // summer
    );
    const defaultResult = recommendGear(journey, fullInventory, NO_CALIBRATION, "no-preference");
    expect(defaultResult.notes.some((n) => n.includes("AC on the bus/train will feel cold"))).toBe(false);

    // Lowering warmOutdoorC to 15 makes 16°C count as warm enough to trigger it.
    const overriddenResult = recommendGear(journey, fullInventory, NO_CALIBRATION, "no-preference", { warmOutdoorC: 15 });
    expect(overriddenResult.notes.some((n) => n.includes("AC on the bus/train will feel cold"))).toBe(true);
  });
});

describe("recommendGear — missing weather note (§5.1 point 2)", () => {
  const fullInventory = inventory({
    clothing: [clothingItem({ type: "jacket", warmth: 8 })],
  });

  it("an outdoor leg with no weather (Open-Meteo failed) adds the fallback note", () => {
    const journey = journeyWithLegs([
      walkLeg({ weather: weather({ apparentTempC: 1 }) }),
      walkLeg({ id: "leg-2", label: "Walk from station", weather: undefined }),
    ]);
    const result = recommendGear(journey, fullInventory, NO_CALIBRATION, "no-preference");
    expect(result.notes).toContain("Couldn't fetch weather — showing route only");
  });

  it("every outdoor leg has weather: no fallback note", () => {
    const journey = journeyWithLegs([walkLeg({ weather: weather({ apparentTempC: 1 }) })]);
    const result = recommendGear(journey, fullInventory, NO_CALIBRATION, "no-preference");
    expect(result.notes).not.toContain("Couldn't fetch weather — showing route only");
  });

  it("an indoor leg with no weather doesn't trigger the note (expected, not a failure)", () => {
    const busLeg = walkLeg({ id: "bus", mode: "bus", outdoor: false, climate: "ac", weather: undefined });
    const journey = journeyWithLegs([walkLeg({ weather: weather({ apparentTempC: 10 }) }), busLeg]);
    const result = recommendGear(journey, fullInventory, NO_CALIBRATION, "no-preference");
    expect(result.notes).not.toContain("Couldn't fetch weather — showing route only");
  });
});

describe("recommendGear — AC contrast (§6.1)", () => {
  const busLeg = walkLeg({
    id: "bus",
    mode: "bus",
    outdoor: false,
    climate: "ac",
    weather: undefined,
  });
  const warmWalkLeg = walkLeg({ weather: weather({ apparentTempC: 22 }) });
  const packableJacket = clothingItem({ type: "jacket", warmth: 5, packable: true });
  const nonPackableJacket = clothingItem({ type: "jacket", warmth: 5, packable: false });
  const midlayer = clothingItem({ type: "midlayer", warmth: 5, packable: true });

  it("summer + warm outdoor + AC leg: requires a packable layer and notes it", () => {
    const journey = journeyWithLegs([warmWalkLeg, busLeg], { departTime: "2026-01-15T08:00:00.000Z" }); // summer
    const result = recommendGear(journey, inventory({ clothing: [packableJacket, nonPackableJacket, midlayer] }), NO_CALIBRATION, "no-preference");
    expect(result.notes.some((n) => n.includes("AC on the bus/train will feel cold"))).toBe(true);
    // requirePackable forces the midlayer-only plan (layerPlanForWarmthLevel level>=2 + requirePackable -> ["midlayer"])
    expect(result.layers).toHaveLength(1);
    expect(result.layers[0]).toMatchObject({ id: midlayer.id });
  });

  it("winter + AC leg: no contrast adjustment", () => {
    const journey = journeyWithLegs([warmWalkLeg, busLeg], { departTime: "2026-07-15T08:00:00.000Z" }); // winter
    const result = recommendGear(journey, inventory({ clothing: [packableJacket, nonPackableJacket, midlayer] }), NO_CALIBRATION, "no-preference");
    expect(result.notes.some((n) => n.includes("AC on the bus/train"))).toBe(false);
  });
});

describe("recommendGear — carryPreference overrides AC-contrast packable requirement (§7.9)", () => {
  const busLeg = walkLeg({ id: "bus", mode: "bus", outdoor: false, climate: "ac", weather: undefined });
  const warmWalkLeg = walkLeg({ weather: weather({ apparentTempC: 22 }) });
  const jacket = clothingItem({ type: "jacket", warmth: 5, packable: false });
  const midlayer = clothingItem({ type: "midlayer", warmth: 5, packable: true });

  it("avoid-spares: skips the packable requirement and picks the warmest single layer instead", () => {
    const journey = journeyWithLegs([warmWalkLeg, busLeg], { departTime: "2026-01-15T08:00:00.000Z" });
    const result = recommendGear(journey, inventory({ clothing: [jacket, midlayer] }), NO_CALIBRATION, "avoid-spares");
    expect(result.notes.some((n) => n.includes("Skipping a spare layer"))).toBe(true);
    expect(result.layers.map((l) => ("id" in l ? l.type : l.layerType))).toEqual(["jacket"]);
  });
});

describe("recommendGear — apparent-temperature divergence note (§6.2)", () => {
  it("gap >= 2°C: note present", () => {
    const journey = journeyWithLegs([walkLeg({ weather: weather({ tempC: 14, apparentTempC: 12 }) })]);
    const result = recommendGear(journey, inventory(), NO_CALIBRATION, "no-preference");
    expect(result.notes.some((n) => n.includes("Feels noticeably colder"))).toBe(true);
  });

  it("gap < 2°C: no note", () => {
    const journey = journeyWithLegs([walkLeg({ weather: weather({ tempC: 14, apparentTempC: 13 }) })]);
    const result = recommendGear(journey, inventory(), NO_CALIBRATION, "no-preference");
    expect(result.notes.some((n) => n.includes("Feels noticeably colder"))).toBe(false);
  });
});

describe("recommendGear — unavailable-gear filtering (§7.7)", () => {
  it("an unavailable jacket is excluded, falling back to fallbackText when nothing else fits", () => {
    const unavailableJacket = clothingItem({
      type: "jacket",
      warmth: 8,
      unavailableUntil: "2099-01-01T00:00:00.000Z",
    });
    const journey = journeyWithLegs([walkLeg({ weather: weather({ apparentTempC: 10 }) })]); // level 2 -> jacket only
    const result = recommendGear(journey, inventory({ clothing: [unavailableJacket] }), NO_CALIBRATION, "no-preference");
    expect(result.layers[0]).toMatchObject({ fallbackText: expect.stringContaining("No available jacket") });
  });

  it("an available jacket is picked normally", () => {
    const availableJacket = clothingItem({ type: "jacket", warmth: 8 });
    const journey = journeyWithLegs([walkLeg({ weather: weather({ apparentTempC: 10 }) })]);
    const result = recommendGear(journey, inventory({ clothing: [availableJacket] }), NO_CALIBRATION, "no-preference");
    expect(result.layers[0]).toMatchObject({ id: availableJacket.id });
  });
});

describe("recommendGear — calibration offset (§7.5.1)", () => {
  const jacket = clothingItem({ type: "jacket", warmth: 5 });
  const midlayer = clothingItem({ type: "midlayer", warmth: 5 });

  it("running cold (+2 offset) bumps a level-0 day up to needing a layer", () => {
    const journey = journeyWithLegs([walkLeg({ weather: weather({ apparentTempC: 19 }) })]); // level 0 unadjusted
    const cold: WarmthCalibration = { offsetLevels: 2, sampleCount: 5 };
    const result = recommendGear(journey, inventory({ clothing: [jacket, midlayer] }), cold, "no-preference");
    expect(result.layers.length).toBeGreaterThan(0);
  });

  it("running warm (-2 offset) drops a level-2 day down to needing nothing", () => {
    const journey = journeyWithLegs([walkLeg({ weather: weather({ apparentTempC: 10 }) })]); // level 2 unadjusted
    const warm: WarmthCalibration = { offsetLevels: -2, sampleCount: 5 };
    const result = recommendGear(journey, inventory({ clothing: [jacket, midlayer] }), warm, "no-preference");
    expect(result.layers).toEqual([]);
  });

  it("resolveWarmthOffset prefers the current season's own offset over the global fallback", () => {
    const journey = journeyWithLegs([walkLeg({ weather: weather({ apparentTempC: 19 }) })], {
      departTime: "2026-07-15T08:00:00.000Z", // winter
    });
    const calibration: WarmthCalibration = {
      offsetLevels: 0,
      sampleCount: 5,
      seasonalOffsets: { summer: 0, winter: 2, shoulder: 0 },
      seasonalSampleCounts: { summer: 0, winter: 3, shoulder: 0 },
    };
    const result = recommendGear(journey, inventory({ clothing: [jacket, midlayer] }), calibration, "no-preference");
    expect(result.layers.length).toBeGreaterThan(0); // winter's +2 offset applied, not the global 0
  });
});

describe("recommendGear — cycling-vs-walking warmup split (§7.9)", () => {
  const jacket = clothingItem({ type: "jacket", warmth: 5 });

  it("15+ min walking at a cool temp earns the warmup discount", () => {
    const journey = journeyWithLegs([walkLeg({ durationMin: 20, weather: weather({ apparentTempC: 10 }) })]); // level 2, discount -> level 1
    const result = recommendGear(journey, inventory({ clothing: [jacket, clothingItem({ type: "midlayer" })] }), NO_CALIBRATION, "no-preference");
    expect(result.notes.some((n) => n.includes("min of walking"))).toBe(true);
  });

  it("8+ min cycling at the same temp also earns the discount (lower threshold than walking)", () => {
    const journey = journeyWithLegs([walkLeg({ mode: "cycle", durationMin: 9, weather: weather({ apparentTempC: 10 }) })]);
    const result = recommendGear(journey, inventory({ clothing: [jacket, clothingItem({ type: "midlayer" })] }), NO_CALIBRATION, "no-preference");
    expect(result.notes.some((n) => n.includes("min of cycling"))).toBe(true);
  });

  it("a short walk under both thresholds gets no discount", () => {
    const journey = journeyWithLegs([walkLeg({ durationMin: 5, weather: weather({ apparentTempC: 10 }) })]);
    const result = recommendGear(journey, inventory({ clothing: [jacket] }), NO_CALIBRATION, "no-preference");
    expect(result.notes.some((n) => n.includes("min of walking"))).toBe(false);
  });

  it("a stationary leg's minutes never count toward the warmup discount even if mode is walk", () => {
    const journey = journeyWithLegs([
      walkLeg({ durationMin: 20, isStationary: true, weather: weather({ apparentTempC: 10, windKph: 5 }) }),
    ]);
    const result = recommendGear(journey, inventory({ clothing: [jacket] }), NO_CALIBRATION, "no-preference");
    expect(result.notes.some((n) => n.includes("min of walking"))).toBe(false);
  });
});

describe("recommendGear — formal-occasion mode (§7.10)", () => {
  it("picks a formal shoe over the normal grip/waterproof sort, with a note when it's not waterproof but conditions call for one", () => {
    const formalShoe = shoeItem({ id: "formal-1", type: "formal", waterproof: false, grip: "low" });
    const grippyShoe = shoeItem({ id: "grippy-1", type: "sneaker", waterproof: true, grip: "high" });
    const journey = journeyWithLegs([walkLeg({ weather: weather({ weatherCode: 61, precipMm: 2 }) })], { formal: true }); // rain -> needsWaterproof
    const result = recommendGear(journey, inventory({ shoes: [formalShoe, grippyShoe] }), NO_CALIBRATION, "no-preference");
    expect(result.shoes).toMatchObject({ id: "formal-1" });
    expect(result.notes.some((n) => n.includes("Dress shoes picked"))).toBe(true);
  });

  it("falls back to the normal sort when no formal shoe is available", () => {
    const grippyShoe = shoeItem({ id: "grippy-1", type: "sneaker", waterproof: true, grip: "high" });
    const journey = journeyWithLegs([walkLeg()], { formal: true });
    const result = recommendGear(journey, inventory({ shoes: [grippyShoe] }), NO_CALIBRATION, "no-preference");
    expect(result.shoes).toMatchObject({ id: "grippy-1" });
  });
});

describe("recommendGear — dual-purpose jacket (§7.12)", () => {
  it("drops the midlayer when the resolved jacket substitutes for it and meets the target warmth", () => {
    const substitutableJacket = clothingItem({ type: "jacket", warmth: 8, substitutesForMidlayer: true });
    const midlayer = clothingItem({ type: "midlayer", warmth: 5 });
    const journey = journeyWithLegs([walkLeg({ weather: weather({ apparentTempC: 5 }) })]); // level 3 -> midlayer+jacket
    const result = recommendGear(journey, inventory({ clothing: [substitutableJacket, midlayer] }), NO_CALIBRATION, "no-preference");
    expect(result.layers.map((l) => ("id" in l ? l.type : l.layerType))).toEqual(["jacket"]);
    expect(result.notes.some((n) => n.includes("warm enough on its own"))).toBe(true);
  });

  it("keeps the midlayer when the substitutable jacket's own warmth is below the target", () => {
    const weakSubstitutableJacket = clothingItem({ type: "jacket", warmth: 3, substitutesForMidlayer: true });
    const midlayer = clothingItem({ type: "midlayer", warmth: 5 });
    const journey = journeyWithLegs([walkLeg({ weather: weather({ apparentTempC: 5 }) })]); // level 3, target = 7.5
    const result = recommendGear(journey, inventory({ clothing: [weakSubstitutableJacket, midlayer] }), NO_CALIBRATION, "no-preference");
    expect(result.layers.map((l) => ("id" in l ? l.type : l.layerType))).toEqual(["midlayer", "jacket"]);
  });

  it("a non-substituting jacket never drops the midlayer regardless of warmth", () => {
    const warmNonSubstitutingJacket = clothingItem({ type: "jacket", warmth: 10, substitutesForMidlayer: false });
    const midlayer = clothingItem({ type: "midlayer", warmth: 5 });
    const journey = journeyWithLegs([walkLeg({ weather: weather({ apparentTempC: 5 }) })]);
    const result = recommendGear(journey, inventory({ clothing: [warmNonSubstitutingJacket, midlayer] }), NO_CALIBRATION, "no-preference");
    expect(result.layers.map((l) => ("id" in l ? l.type : l.layerType))).toEqual(["midlayer", "jacket"]);
  });
});

describe("recommendGear — bottoms (§7.13)", () => {
  const bottomsItem = clothingItem({ type: "bottoms", warmth: 5, waterproof: true });

  it("waterproof trigger: needs both wet AND high gust — high gust alone doesn't add the rain-trousers note", () => {
    const journey = journeyWithLegs([walkLeg({ weather: weather({ windGustKph: 40, weatherCode: 1, precipMm: 0 }) })]); // dry
    const result = recommendGear(journey, inventory({ clothing: [bottomsItem] }), NO_CALIBRATION, "no-preference");
    // Bottoms is always attempted now (§7.13 expansion, see DECISIONS.md) —
    // the item is still picked, it's the wet+windy-specific note that's gated.
    expect(result.bottoms).toMatchObject({ id: bottomsItem.id });
    expect(result.notes).not.toContain("Wet and windy enough to warrant rain trousers, not just a jacket");
  });

  it("waterproof trigger: wet alone (low gust) doesn't add the rain-trousers note", () => {
    const journey = journeyWithLegs([walkLeg({ weather: weather({ windGustKph: 10, weatherCode: 61, precipMm: 2 }) })]);
    const result = recommendGear(journey, inventory({ clothing: [bottomsItem] }), NO_CALIBRATION, "no-preference");
    expect(result.bottoms).toMatchObject({ id: bottomsItem.id });
    expect(result.notes).not.toContain("Wet and windy enough to warrant rain trousers, not just a jacket");
  });

  it("waterproof trigger: wet AND high gust together fire it", () => {
    const journey = journeyWithLegs([walkLeg({ weather: weather({ windGustKph: 40, weatherCode: 61, precipMm: 2 }) })]);
    const result = recommendGear(journey, inventory({ clothing: [bottomsItem] }), NO_CALIBRATION, "no-preference");
    expect(result.bottoms).toMatchObject({ id: bottomsItem.id });
  });

  it("thermal trigger: a genuine cold snap (level 4) alone fires it, dry and calm", () => {
    const journey = journeyWithLegs([walkLeg({ weather: weather({ apparentTempC: 0, windGustKph: 5, weatherCode: 1, precipMm: 0 }) })]);
    const result = recommendGear(journey, inventory({ clothing: [bottomsItem] }), NO_CALIBRATION, "no-preference");
    expect(result.bottoms).toMatchObject({ id: bottomsItem.id });
  });

  it("a mild dry journey still picks bottoms (§7.13 expansion — always attempted, not just cold/wet)", () => {
    const journey = journeyWithLegs([walkLeg({ weather: weather({ apparentTempC: 15 }) })]);
    const result = recommendGear(journey, inventory({ clothing: [bottomsItem] }), NO_CALIBRATION, "no-preference");
    expect(result.bottoms).toMatchObject({ id: bottomsItem.id });
  });
});

describe("recommendGear — severe-weather advisory (§7.14)", () => {
  it("fires on storm-severity alone for a walk leg", () => {
    const journey = journeyWithLegs([walkLeg({ weather: weather({ weatherCode: 95, windGustKph: 10 }) })]);
    const result = recommendGear(journey, inventory(), NO_CALIBRATION, "no-preference");
    expect(result.severeWeatherAdvisory).toBeDefined();
  });

  it("fires on gust alone (>=60kph) even without storm severity", () => {
    const journey = journeyWithLegs([walkLeg({ weather: weather({ weatherCode: 1, windGustKph: 60 }) })]);
    const result = recommendGear(journey, inventory(), NO_CALIBRATION, "no-preference");
    expect(result.severeWeatherAdvisory).toBeDefined();
  });

  it("does not fire for a severe drive/bus/train leg", () => {
    const severeDrive = walkLeg({ mode: "drive", outdoor: false, weather: undefined });
    const calmWalk = walkLeg({ id: "walk-2", weather: weather({ weatherCode: 1, windGustKph: 10 }) });
    const journey = journeyWithLegs([calmWalk, severeDrive]);
    const result = recommendGear(journey, inventory(), NO_CALIBRATION, "no-preference");
    expect(result.severeWeatherAdvisory).toBeUndefined();
  });

  it("produces exactly one sentence even with multiple qualifying legs", () => {
    const leg1 = walkLeg({ id: "l1", weather: weather({ windGustKph: 70 }) });
    const leg2 = walkLeg({ id: "l2", weather: weather({ windGustKph: 70 }) });
    const journey = journeyWithLegs([leg1, leg2]);
    const result = recommendGear(journey, inventory(), NO_CALIBRATION, "no-preference");
    expect(result.severeWeatherAdvisory?.split(".").filter(Boolean).length).toBeLessThanOrEqual(1);
  });
});

describe("recommendGear — hot-weather note (§7.15)", () => {
  it("does not fire at 20°C (warm enough for AC-contrast, but not HOT_C)", () => {
    const journey = journeyWithLegs([walkLeg({ weather: weather({ apparentTempC: 20 }) })]);
    const result = recommendGear(journey, inventory(), NO_CALIBRATION, "no-preference");
    expect(result.notes.some((n) => n.includes("breathable"))).toBe(false);
  });

  it("fires at/above 24°C", () => {
    const journey = journeyWithLegs([walkLeg({ weather: weather({ apparentTempC: 24 }) })]);
    const result = recommendGear(journey, inventory(), NO_CALIBRATION, "no-preference");
    expect(result.notes.some((n) => n.includes("breathable"))).toBe(true);
  });
});

describe("recommendGear — sun and darkness accessories (§7.6)", () => {
  it("high UV daylight leg picks a tagged sunglasses item and notes the UV reading", () => {
    const sunglasses = clothingItem({ type: "accessory", tags: ["sunglasses"] });
    const journey = journeyWithLegs([walkLeg({ weather: weather({ uvIndex: 7, isDaylight: true }) })]);
    const result = recommendGear(journey, inventory({ clothing: [sunglasses] }), NO_CALIBRATION, "no-preference");
    expect(result.accessories.some((a) => "id" in a && a.id === sunglasses.id)).toBe(true);
    expect(result.notes.some((n) => n.includes("UV index reaching"))).toBe(true);
  });

  it("high UV with no sunglasses owned falls back to a text suggestion", () => {
    const journey = journeyWithLegs([walkLeg({ weather: weather({ uvIndex: 7, isDaylight: true }) })]);
    const result = recommendGear(journey, inventory(), NO_CALIBRATION, "no-preference");
    expect(result.accessories.some((a) => "fallbackText" in a && a.fallbackText.includes("sunglasses"))).toBe(true);
  });

  it("a dark leg picks a tagged reflective item", () => {
    const reflectiveVest = clothingItem({ type: "accessory", tags: ["reflective"] });
    const journey = journeyWithLegs([walkLeg({ weather: weather({ isDaylight: false, uvIndex: 0 }) })]);
    const result = recommendGear(journey, inventory({ clothing: [reflectiveVest] }), NO_CALIBRATION, "no-preference");
    expect(result.accessories.some((a) => "id" in a && a.id === reflectiveVest.id)).toBe(true);
    expect(result.notes.some((n) => n.includes("reflective gear picked"))).toBe(true);
  });

  it("an all-daylight, low-UV journey adds no sun/dark accessories", () => {
    const journey = journeyWithLegs([walkLeg({ weather: weather({ uvIndex: 2, isDaylight: true }) })]);
    const result = recommendGear(journey, inventory(), NO_CALIBRATION, "no-preference");
    expect(result.accessories).toEqual([]);
  });
});

describe("recommendGear — stationary-wait aggravation (§7.9)", () => {
  it("a windy wait bumps warmth after only the shorter (windy) threshold", () => {
    const wait = walkLeg({
      isStationary: true,
      durationMin: 6, // >= STATIONARY_WAIT_WINDY_MIN_MINUTES (5), < the calm threshold (10)
      weather: weather({ apparentTempC: 10, windKph: 20 }), // >= WIND_CHILL_KPH (15)
    });
    const journey = journeyWithLegs([wait]);
    const result = recommendGear(journey, inventory(), NO_CALIBRATION, "no-preference");
    expect(result.notes.some((n) => n.includes("waiting in the wind"))).toBe(true);
  });

  it("the same short wait does NOT fire when calm (needs the longer threshold)", () => {
    const wait = walkLeg({
      isStationary: true,
      durationMin: 6,
      weather: weather({ apparentTempC: 10, windKph: 5 }), // calm
    });
    const journey = journeyWithLegs([wait]);
    const result = recommendGear(journey, inventory(), NO_CALIBRATION, "no-preference");
    expect(result.notes.some((n) => n.includes("waiting"))).toBe(false);
  });

  it("a calm wait fires once it reaches the longer threshold", () => {
    const wait = walkLeg({
      isStationary: true,
      durationMin: 10,
      weather: weather({ apparentTempC: 10, windKph: 5 }),
    });
    const journey = journeyWithLegs([wait]);
    const result = recommendGear(journey, inventory(), NO_CALIBRATION, "no-preference");
    expect(result.notes.some((n) => n.includes("waiting outdoors"))).toBe(true);
  });
});

describe("recommendGear — pickLayer resolves against the widened 1-10 warmth scale (§3.6)", () => {
  it("picks the item closest to warmthLevel * 2.5, not just the warmest one available", () => {
    const closeJacket = clothingItem({ type: "jacket", warmth: 8 }); // |8 - 10| = 2
    const farJacket = clothingItem({ type: "jacket", warmth: 4 }); // |4 - 10| = 6
    const journey = journeyWithLegs([walkLeg({ weather: weather({ apparentTempC: 1 }) })]); // level 4 -> target 10
    const result = recommendGear(
      journey,
      inventory({ clothing: [farJacket, closeJacket, clothingItem({ type: "base" }), clothingItem({ type: "midlayer" })] }),
      NO_CALIBRATION,
      "no-preference"
    );
    const jacketPick = result.layers.find((l) => "id" in l && l.type === "jacket");
    expect(jacketPick).toMatchObject({ id: closeJacket.id });
  });
});

describe("recommendGear — §7.8 annotation-gated wind/sun/reflection deltas (Phase 6)", () => {
  const layered = inventory({
    clothing: [
      clothingItem({ type: "base", warmth: 1 }),
      clothingItem({ type: "midlayer", warmth: 5 }),
      clothingItem({ type: "jacket", warmth: 8 }),
    ],
  });
  const layerTypes = (result: ReturnType<typeof recommendGear>) =>
    result.layers.map((l) => ("id" in l ? l.type : l.layerType));

  it("wind-tunnel leg whose amplified wind clears WIND_CHILL_KPH bumps one warmth level", () => {
    // 10°C = level 2; windKph 10 × 1.5 = 15 >= 15 → level 3.
    const journey = journeyWithLegs([
      walkLeg({ windEffect: "amplified", weather: weather({ apparentTempC: 10, windKph: 10 }) }),
    ]);
    const result = recommendGear(journey, layered, NO_CALIBRATION, "no-preference");
    expect(layerTypes(result)).toEqual(["midlayer", "jacket"]);
    expect(result.notes.some((n) => n.startsWith("Wind tunnel on"))).toBe(true);
  });

  it("wind-tunnel leg below the effective threshold does not bump", () => {
    // windKph 9 × 1.5 = 13.5 < 15.
    const journey = journeyWithLegs([
      walkLeg({ windEffect: "amplified", weather: weather({ apparentTempC: 10, windKph: 9 }) }),
    ]);
    const result = recommendGear(journey, layered, NO_CALIBRATION, "no-preference");
    expect(layerTypes(result)).toEqual(["jacket"]);
  });

  it("a sheltered leg never bumps — the delta is amplified-only", () => {
    const journey = journeyWithLegs([
      walkLeg({ windEffect: "sheltered", weather: weather({ apparentTempC: 10, windKph: 40 }) }),
    ]);
    const result = recommendGear(journey, layered, NO_CALIBRATION, "no-preference");
    expect(layerTypes(result)).toEqual(["jacket"]);
  });

  it("a formal occasion skips the wind-tunnel bump (§7.10)", () => {
    const journey = journeyWithLegs(
      [walkLeg({ windEffect: "amplified", weather: weather({ apparentTempC: 10, windKph: 10 }) })],
      { formal: true }
    );
    const result = recommendGear(journey, layered, NO_CALIBRATION, "no-preference");
    expect(result.notes.some((n) => n.startsWith("Wind tunnel on"))).toBe(false);
  });

  it("windSensitivityOffset scales the bump and is clamped to ±1 (§7.5.2)", () => {
    const journey = journeyWithLegs([
      walkLeg({ windEffect: "amplified", weather: weather({ apparentTempC: 10, windKph: 10 }) }),
    ]);
    const moreSensitive: WarmthCalibration = { offsetLevels: 0, sampleCount: 0, windSensitivityOffset: 1 };
    expect(layerTypes(recommendGear(journey, layered, moreSensitive, "no-preference"))).toEqual([
      "base",
      "midlayer",
      "jacket",
    ]); // level 2 + bump 2 = 4
    const outOfRange: WarmthCalibration = { offsetLevels: 0, sampleCount: 0, windSensitivityOffset: 5 };
    expect(layerTypes(recommendGear(journey, layered, outOfRange, "no-preference"))).toEqual([
      "base",
      "midlayer",
      "jacket",
    ]); // clamped to the same +2 total, never further
  });

  it("sun-exposed leg at high UV in daylight drops one warmth level", () => {
    const journey = journeyWithLegs([
      walkLeg({ sunEffect: "exposed", weather: weather({ apparentTempC: 10, uvIndex: 6 }) }),
    ]);
    const result = recommendGear(journey, layered, NO_CALIBRATION, "no-preference");
    expect(layerTypes(result)).toEqual(["midlayer"]); // level 2 - 1 = 1
    expect(result.notes.some((n) => n.startsWith("Direct sun on"))).toBe(true);
  });

  it("sun-exposed leg after dark does not fire", () => {
    const journey = journeyWithLegs([
      walkLeg({ sunEffect: "exposed", weather: weather({ apparentTempC: 10, uvIndex: 6, isDaylight: false }) }),
    ]);
    const result = recommendGear(journey, layered, NO_CALIBRATION, "no-preference");
    expect(layerTypes(result)).toEqual(["jacket"]);
  });

  it("highReflection lowers the effective UV threshold by HIGH_REFLECTION_UV_OFFSET", () => {
    const atUv5 = (highReflection: boolean) =>
      recommendGear(
        journeyWithLegs([
          walkLeg({ sunEffect: "exposed", highReflection, weather: weather({ apparentTempC: 10, uvIndex: 5 }) }),
        ]),
        layered,
        NO_CALIBRATION,
        "no-preference"
      );
    expect(layerTypes(atUv5(false))).toEqual(["jacket"]); // 5 < 6, no reduction
    const reflected = atUv5(true); // 5 >= 6 - 1, fires
    expect(layerTypes(reflected)).toEqual(["midlayer"]);
    expect(reflected.notes.some((n) => n.includes("sun and reflection"))).toBe(true);
  });

  it("highReflection without a sun-exposed pin has no warmth effect (§3.4)", () => {
    const journey = journeyWithLegs([
      walkLeg({ highReflection: true, weather: weather({ apparentTempC: 10, uvIndex: 6 }) }),
    ]);
    const result = recommendGear(journey, layered, NO_CALIBRATION, "no-preference");
    expect(layerTypes(result)).toEqual(["jacket"]);
  });
});

describe("recommendGear — puddle risk & rain cover (§7.8, Phase 6)", () => {
  it("dry now but recent rain: requires waterproof shoes with the puddle note", () => {
    const wetGround = weather({ recentPrecipMm6h: 6 }); // >= PUDDLE_RISK_PRECIP_MM_6H, dry conditions
    const boots = shoeItem({ id: "boots", name: "Boots", waterproof: true });
    const journey = journeyWithLegs([walkLeg({ weather: wetGround })]);
    const result = recommendGear(
      journey,
      inventory({ shoes: [shoeItem(), boots] }),
      NO_CALIBRATION,
      "no-preference"
    );
    expect(result.shoes).toMatchObject({ id: "boots" });
    expect(result.notes.some((n) => n.startsWith("Rain earlier today"))).toBe(true);
    expect(result.umbrella).toBeUndefined(); // footwear only — never umbrella/jacket (§7.8)
  });

  it("a stamped leg.puddleRisk flag triggers the same path without the snapshot field", () => {
    const journey = journeyWithLegs([walkLeg({ puddleRisk: true })]);
    const result = recommendGear(journey, inventory(), NO_CALIBRATION, "no-preference");
    expect(result.shoes).toMatchObject({ fallbackText: "No waterproof shoes owned or available — mind the puddles" });
  });

  it("below the 6h threshold nothing changes", () => {
    const journey = journeyWithLegs([walkLeg({ weather: weather({ recentPrecipMm6h: 3 }) })]);
    const result = recommendGear(journey, inventory(), NO_CALIBRATION, "no-preference");
    expect(result.notes.some((n) => n.startsWith("Rain earlier today"))).toBe(false);
  });

  it("a rain-covered stretch adds the informational note without changing the umbrella pick", () => {
    const rainy = weather({ weatherCode: 61, precipMm: 2 });
    const journey = journeyWithLegs([walkLeg({ weather: rainy, rainCovered: true })]);
    const result = recommendGear(journey, inventory(), NO_CALIBRATION, "no-preference");
    expect(result.umbrella).toMatchObject({ id: "umbrella-1" });
    expect(result.notes.some((n) => n.startsWith("Part of this route is covered"))).toBe(true);
  });
});

describe("recommendGear — never-set-up vs. genuinely-unavailable gear copy", () => {
  it("an empty inventory assumes a reasonable midlayer rather than reporting none owned", () => {
    const cold = journeyWithLegs([walkLeg({ weather: weather({ apparentTempC: 6 }) })]); // level 3: midlayer + jacket
    const result = recommendGear(cold, inventory({ clothing: [], shoes: [], umbrellas: [] }), NO_CALIBRATION, "no-preference");
    const midlayerPick = result.layers.find((l) => "layerType" in l && l.layerType === "midlayer");
    expect(midlayerPick).toMatchObject({ fallbackText: "Wear a midlayer", isGenericAssumption: true });
    expect(result.notes).toContain("These are generic picks — add your gear in the Gear tab for suggestions tailored to what you own.");
  });

  it("gear set up but this category empty gives a workaround, not a generic assumption", () => {
    const cold = journeyWithLegs([walkLeg({ weather: weather({ apparentTempC: 6 }) })]);
    // Only a jacket is set up — midlayer category is genuinely empty.
    const result = recommendGear(cold, inventory({ clothing: [clothingItem({ type: "jacket", warmth: 8 })] }), NO_CALIBRATION, "no-preference");
    const midlayerPick = result.layers.find((l) => "layerType" in l && l.layerType === "midlayer");
    expect(midlayerPick).toMatchObject({
      fallbackText: "No available midlayer for these conditions — an extra top layer or a brisker pace will help",
    });
    expect((midlayerPick as { isGenericAssumption?: boolean }).isGenericAssumption).toBeFalsy();
  });

  it("umbrella fallback substitutes an owned rain-shell combo when one exists", () => {
    const rainyWindy = weather({ weatherCode: 61, precipMm: 3, windGustKph: 10 });
    const journey = journeyWithLegs([walkLeg({ weather: rainyWindy })]);
    const rainJacket = clothingItem({ type: "jacket", name: "Storm Shell", waterproof: true });
    const rainBottoms = clothingItem({ type: "bottoms", name: "Rain Pants", waterproof: true });
    const rainShoes = shoeItem({ id: "shoe-2", name: "Gumboots", waterproof: true });
    // An umbrella is set up (hasNoUmbrellaSetup === false) but unavailable
    // for this journey — exercises the "genuinely unavailable" workaround
    // branch rather than the never-set-up generic-assumption branch.
    const unavailableUmbrella = umbrellaItem({ unavailableUntil: "2026-07-21T00:00:00.000Z" });
    const result = recommendGear(
      journey,
      inventory({ clothing: [rainJacket, rainBottoms], shoes: [rainShoes], umbrellas: [unavailableUmbrella] }),
      NO_CALIBRATION,
      "no-preference"
    );
    expect(result.umbrella).toMatchObject({
      fallbackText: "No suitable umbrella — your Storm Shell, Rain Pants and Gumboots should keep you mostly dry",
    });
  });
});
