import { checkForecastDrift } from "./forecastDrift";
import { getForecast } from "../services/weatherService";
import { scheduleLeaveByNotification } from "./notifications";
import { updateJourney } from "../db/repositories/journeys";
import { listClothing } from "../db/repositories/clothing";
import { listShoes } from "../db/repositories/shoes";
import { listUmbrellas } from "../db/repositories/umbrellas";
import { getWarmthCalibration } from "../db/repositories/calibration";
import { getCarryPreferenceDefault } from "../db/repositories/settings";
import { getAdvancedThresholds } from "../db/repositories/advancedThresholds";
import type { ClothingItem, Journey, JourneyLeg, WeatherSnapshot } from "../types";

// Explicit factories throughout — same reasoning as planJourney.test.ts:
// a bare jest.mock(path) auto-mock still loads the real module (and its
// expo-sqlite/expo-notifications import chain) before substituting it.
jest.mock("../services/weatherService", () => ({ getForecast: jest.fn() }));
jest.mock("./notifications", () => ({ scheduleLeaveByNotification: jest.fn() }));
jest.mock("../db/repositories/journeys", () => ({ updateJourney: jest.fn() }));
jest.mock("../db/repositories/clothing", () => ({ listClothing: jest.fn() }));
jest.mock("../db/repositories/shoes", () => ({ listShoes: jest.fn() }));
jest.mock("../db/repositories/umbrellas", () => ({ listUmbrellas: jest.fn() }));
jest.mock("../db/repositories/calibration", () => ({ getWarmthCalibration: jest.fn() }));
jest.mock("../db/repositories/settings", () => ({ getCarryPreferenceDefault: jest.fn() }));
jest.mock("../db/repositories/advancedThresholds", () => ({ getAdvancedThresholds: jest.fn() }));

const mockGetForecast = getForecast as jest.Mock;
const mockScheduleNotification = scheduleLeaveByNotification as jest.Mock;
const mockUpdateJourney = updateJourney as jest.Mock;
const mockListClothing = listClothing as jest.Mock;
const mockListShoes = listShoes as jest.Mock;
const mockListUmbrellas = listUmbrellas as jest.Mock;
const mockGetCalibration = getWarmthCalibration as jest.Mock;
const mockGetCarryPreferenceDefault = getCarryPreferenceDefault as jest.Mock;
const mockGetAdvancedThresholds = getAdvancedThresholds as jest.Mock;

const HOME = { id: "home", label: "Home", address: "1 Home St", lat: -36.8485, lng: 174.7633 };
const WORK = { id: "work", label: "Work", address: "2 Work St", lat: -36.86, lng: 174.77 };

// Google's own reference example encoded polyline (three points) —
// docs.polyline encoding algorithm sample, used purely so decodePolyline()
// has a real string to decode; the exact coordinates don't matter since
// getForecast is mocked and ignores its arguments.
const POLYLINE = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";

function weather(overrides: Partial<WeatherSnapshot> = {}): WeatherSnapshot {
  return {
    time: "2026-07-20T08:00:00.000Z",
    weatherCode: 1,
    precipMm: 0,
    precipProbability: 10,
    tempC: 15,
    apparentTempC: 14,
    windKph: 10,
    windGustKph: 15,
    relativeHumidityPct: 70,
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
    durationMin: 20,
    startTime: "2026-07-20T08:00:00.000Z",
    outdoor: true,
    polyline: POLYLINE,
    weather: weather(),
    ...overrides,
  };
}

function futureJourney(legs: JourneyLeg[]): Journey {
  return {
    id: "journey-1",
    origin: HOME,
    destination: WORK,
    departTime: new Date(Date.now() + 60 * 60_000).toISOString(),
    legs,
  };
}

function jacket(overrides: Partial<ClothingItem> = {}): ClothingItem {
  return { id: "jacket-1", name: "Rain shell", type: "jacket", warmth: 8, waterproof: true, windproof: true, packable: false, ...overrides };
}

describe("checkForecastDrift", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListClothing.mockResolvedValue([jacket()]);
    mockListShoes.mockResolvedValue([]);
    mockListUmbrellas.mockResolvedValue([]);
    mockGetCalibration.mockResolvedValue({ offsetLevels: 0, sampleCount: 0 });
    mockGetCarryPreferenceDefault.mockResolvedValue("no-preference");
    mockGetAdvancedThresholds.mockResolvedValue({});
  });

  it("no-ops for a journey whose departTime has already passed", async () => {
    const journey: Journey = { ...futureJourney([walkLeg()]), departTime: "2020-01-01T00:00:00.000Z" };
    const result = await checkForecastDrift(journey);
    expect(result.changed).toBe(false);
    expect(mockGetForecast).not.toHaveBeenCalled();
  });

  it("no-ops when the re-fetch fails, leaving the stored journey untouched (§5.1)", async () => {
    mockGetForecast.mockResolvedValue({ error: "network" });
    const journey = futureJourney([walkLeg()]);
    const result = await checkForecastDrift(journey);
    expect(result.changed).toBe(false);
    expect(result.journey).toBe(journey);
    expect(mockUpdateJourney).not.toHaveBeenCalled();
  });

  it("silently refreshes stored weather without notifying when the recommendation doesn't materially change", async () => {
    // Same freezing-cold apparent temp before and after — warmthLevel 4
    // either way, so the resolved jacket pick is identical.
    mockGetForecast.mockResolvedValue({ data: [weather({ apparentTempC: -1 })] });
    const journey = futureJourney([walkLeg({ weather: weather({ apparentTempC: -2 }) })]);

    const result = await checkForecastDrift(journey);

    expect(result.changed).toBe(false);
    expect(mockUpdateJourney).toHaveBeenCalledTimes(1);
    expect(result.journey.legs[0].weather?.apparentTempC).toBe(-1);
    expect(mockScheduleNotification).not.toHaveBeenCalled();
  });

  it("updates the journey and reschedules with changed copy when the recommendation flips (no jacket owned -> fallback vs resolved)", async () => {
    // Before: mild, no jacket needed. After: freezing, jacket now required
    // — but no umbrella/bottoms owned, so only the layer pick differs.
    mockGetForecast.mockResolvedValue({ data: [weather({ apparentTempC: -1 })] });
    const journey = futureJourney([walkLeg({ weather: weather({ apparentTempC: 20 }) })]);

    const result = await checkForecastDrift(journey);

    expect(result.changed).toBe(true);
    expect(mockUpdateJourney).toHaveBeenCalledTimes(1);
    expect(mockScheduleNotification).toHaveBeenCalledTimes(1);
    expect(mockScheduleNotification.mock.calls[0][2]).toEqual({ changed: true });
  });

  it("no-ops when no leg has a resolvable point (no polyline data yet)", async () => {
    const journey = futureJourney([walkLeg({ polyline: undefined })]);
    const result = await checkForecastDrift(journey);
    expect(result.changed).toBe(false);
    expect(mockGetForecast).not.toHaveBeenCalled();
  });
});
