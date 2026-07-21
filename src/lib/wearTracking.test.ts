import { isSweatyConditions, recordWear, toRecommendationSnapshot } from "./wearTracking";
import { updateClothingWearTracking } from "../db/repositories/clothing";
import { updateShoeWearTracking } from "../db/repositories/shoes";
import type { Recommendation } from "./recommend";
import type { ClothingItem, Journey, JourneyLeg, ShoeItem } from "../types";

jest.mock("../db/repositories/clothing", () => ({ updateClothingWearTracking: jest.fn() }));
jest.mock("../db/repositories/shoes", () => ({ updateShoeWearTracking: jest.fn() }));

const mockUpdateClothing = updateClothingWearTracking as jest.Mock;
const mockUpdateShoe = updateShoeWearTracking as jest.Mock;

const HOME = { id: "home", label: "Home", address: "1 Home St", lat: -36.8485, lng: 174.7633 };
const WORK = { id: "work", label: "Work", address: "2 Work St", lat: -36.86, lng: 174.77 };

function walkLeg(overrides: Partial<JourneyLeg> = {}): JourneyLeg {
  return {
    id: "leg-1",
    mode: "walk",
    label: "Walk to Work",
    durationMin: 20,
    startTime: "2026-07-20T08:00:00.000Z",
    outdoor: true,
    weather: {
      time: "2026-07-20T08:00:00.000Z",
      weatherCode: 1,
      precipMm: 0,
      precipProbability: 10,
      tempC: 22,
      apparentTempC: 22,
      windKph: 10,
      windGustKph: 15,
      relativeHumidityPct: 60,
      uvIndex: 3,
      isDaylight: true,
      forecastConfidence: "high",
    },
    ...overrides,
  };
}

function journey(legs: JourneyLeg[]): Journey {
  return { id: "journey-1", origin: HOME, destination: WORK, departTime: "2026-07-20T08:00:00.000Z", legs };
}

function clothingItem(overrides: Partial<ClothingItem> = {}): ClothingItem {
  return {
    id: "base-1",
    name: "Cotton tee",
    type: "base",
    warmth: 2,
    waterproof: false,
    windproof: false,
    packable: true,
    ...overrides,
  };
}

function shoeItem(overrides: Partial<ShoeItem> = {}): ShoeItem {
  return { id: "shoe-1", name: "Sneakers", type: "sneaker", waterproof: false, grip: "med", ...overrides };
}

describe("isSweatyConditions", () => {
  it("true when a warm-outdoor leg has enough sustained walking exertion", () => {
    expect(isSweatyConditions(journey([walkLeg({ durationMin: 20 })]), 18)).toBe(true);
  });

  it("false when the leg is cool, even with enough exertion minutes", () => {
    expect(isSweatyConditions(journey([walkLeg({ durationMin: 20, weather: { ...walkLeg().weather!, apparentTempC: 10 } })]), 18)).toBe(false);
  });

  it("false when warm but exertion is too short (e.g. a stationary wait)", () => {
    expect(isSweatyConditions(journey([walkLeg({ durationMin: 5 })]), 18)).toBe(false);
  });
});

describe("recordWear", () => {
  beforeEach(() => jest.clearAllMocks());

  it("increments wearsSinceClean for layers/bottoms/shoes, flags needsCleaning at the wash-reminder threshold", async () => {
    const recommendation: Recommendation = {
      layers: [clothingItem({ id: "jacket-1", wearsSinceClean: 2 })],
      bottoms: clothingItem({ id: "bottoms-1", type: "bottoms", wearsSinceClean: 0 }),
      accessories: [],
      shoes: shoeItem({ wearsSinceClean: 0 }),
      notes: [],
    };
    await recordWear(recommendation, journey([walkLeg({ durationMin: 5 })]), 18); // not sweaty — cool/short

    expect(mockUpdateClothing).toHaveBeenCalledWith("jacket-1", {
      wearsSinceClean: 3, // crosses WASH_REMINDER_WEAR_COUNT (3)
      lastWornAt: "2026-07-20T08:00:00.000Z",
      needsCleaning: true,
    });
    expect(mockUpdateClothing).toHaveBeenCalledWith("bottoms-1", {
      wearsSinceClean: 1,
      lastWornAt: "2026-07-20T08:00:00.000Z",
      needsCleaning: false,
    });
    expect(mockUpdateShoe).toHaveBeenCalledWith("shoe-1", {
      wearsSinceClean: 1,
      lastWornAt: "2026-07-20T08:00:00.000Z",
      needsCleaning: false,
    });
  });

  it("sweaty conditions flag needsCleaning immediately regardless of wear count", async () => {
    const recommendation: Recommendation = {
      layers: [clothingItem({ id: "base-1", wearsSinceClean: 0 })],
      accessories: [],
      notes: [],
    };
    await recordWear(recommendation, journey([walkLeg({ durationMin: 20 })]), 18); // warm + sustained walk = sweaty

    expect(mockUpdateClothing).toHaveBeenCalledWith("base-1", {
      wearsSinceClean: 1,
      lastWornAt: "2026-07-20T08:00:00.000Z",
      needsCleaning: true,
    });
  });

  it("excludes non-sock accessories and umbrellas, but includes a sock-tagged accessory", async () => {
    const recommendation: Recommendation = {
      layers: [],
      accessories: [
        clothingItem({ id: "gloves-1", type: "accessory", tags: ["gloves"] }),
        clothingItem({ id: "socks-1", type: "accessory", tags: ["socks"], wearsSinceClean: 0 }),
      ],
      umbrella: { id: "brolly-1", name: "Compact", type: "compact", windRating: "med" },
      notes: [],
    };
    await recordWear(recommendation, journey([walkLeg({ durationMin: 5 })]), 18);

    expect(mockUpdateClothing).toHaveBeenCalledTimes(1);
    expect(mockUpdateClothing).toHaveBeenCalledWith(
      "socks-1",
      expect.objectContaining({ wearsSinceClean: 1 })
    );
  });

  it("skips fallback (non-real) picks — nothing to update if nothing resolved to an owned item", async () => {
    const recommendation: Recommendation = {
      layers: [{ fallbackText: "No available jacket", layerType: "jacket" }],
      accessories: [],
      shoes: { fallbackText: "No waterproof shoes owned" },
      notes: [],
    };
    await recordWear(recommendation, journey([walkLeg()]), 18);

    expect(mockUpdateClothing).not.toHaveBeenCalled();
    expect(mockUpdateShoe).not.toHaveBeenCalled();
  });
});

describe("toRecommendationSnapshot", () => {
  it("flattens real items to names and fallbacks to their fallbackText", () => {
    const recommendation: Recommendation = {
      layers: [clothingItem({ name: "Rain shell" }), { fallbackText: "No available midlayer", layerType: "midlayer" }],
      accessories: [{ fallbackText: "Consider gloves/a hat — it's cold out", layerType: "accessory" }],
      shoes: { fallbackText: "No waterproof shoes owned" },
      umbrella: { id: "brolly-1", name: "Compact", type: "compact", windRating: "med" },
      notes: ["Rain expected"],
    };
    const snapshot = toRecommendationSnapshot(recommendation);

    expect(snapshot.layerNames).toEqual(["Rain shell", "No available midlayer"]);
    expect(snapshot.accessoryNames).toEqual(["Consider gloves/a hat — it's cold out"]);
    expect(snapshot.shoeName).toBe("No waterproof shoes owned");
    expect(snapshot.umbrellaName).toBe("Compact");
    expect(snapshot.notes).toEqual(["Rain expected"]);
    expect(typeof snapshot.snapshotAt).toBe("string");
  });

  it("umbrellaName/shoeName are null when neither was recommended", () => {
    const snapshot = toRecommendationSnapshot({ layers: [], accessories: [], notes: [] });
    expect(snapshot.shoeName).toBeNull();
    expect(snapshot.umbrellaName).toBeNull();
  });
});
