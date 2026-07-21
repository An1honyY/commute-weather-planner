import { planJourney } from "./planJourney";
import { computeRoute } from "../services/routesService";
import { getForecast } from "../services/weatherService";
import { getRealtimeDelay } from "../services/transitService";
import { createJourney, findRecentJourneyBetween } from "../db/repositories/journeys";
import { listAnnotations } from "../db/repositories/annotations";
import type { SavedLocation, WeatherSnapshot } from "../types";

// Explicit factories, not bare jest.mock(path) — an auto-mock still loads
// the real module to introspect its exports, and journeys.ts's import
// chain reaches expo-sqlite's native hooks (missing expo-asset outside a
// real Expo runtime), which would blow up module resolution before the
// mock ever takes effect.
jest.mock("../services/routesService", () => ({ computeRoute: jest.fn() }));
jest.mock("../services/weatherService", () => ({ getForecast: jest.fn() }));
jest.mock("../services/transitService", () => ({ getRealtimeDelay: jest.fn() }));
jest.mock("../db/repositories/journeys", () => ({
  createJourney: jest.fn(),
  findRecentJourneyBetween: jest.fn(),
}));
jest.mock("../db/repositories/annotations", () => ({ listAnnotations: jest.fn() }));
jest.mock("./leaveBy", () => ({ scheduleForJourney: jest.fn() }));

const mockComputeRoute = computeRoute as jest.Mock;
const mockGetForecast = getForecast as jest.Mock;
const mockGetRealtimeDelay = getRealtimeDelay as jest.Mock;
const mockCreateJourney = createJourney as jest.Mock;
const mockFindRecentJourneyBetween = findRecentJourneyBetween as jest.Mock;
const mockListAnnotations = listAnnotations as jest.Mock;

const HOME: SavedLocation = { id: "home", label: "Home", address: "1 Home St", lat: -36.8485, lng: 174.7633 };
const WORK: SavedLocation = { id: "work", label: "Work", address: "2 Work St", lat: -36.86, lng: 174.77 };
const CAFE: SavedLocation = { id: "cafe", label: "Cafe", address: "3 Cafe St", lat: -36.855, lng: 174.765 };

function fakeWeather(): WeatherSnapshot {
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
  };
}

const baseInput = {
  origin: HOME,
  destination: WORK,
  waypoints: [] as SavedLocation[],
  departTime: "2026-07-20T08:00:00.000Z",
  mode: "walk" as const,
  formal: false,
  carryPreference: "no-preference" as const,
};

describe("planJourney", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateJourney.mockImplementation(async (j) => j);
    mockListAnnotations.mockResolvedValue([]);
  });

  it("live route success: builds legs and merges weather", async () => {
    mockComputeRoute.mockResolvedValue({
      data: [{ mode: "walk", label: "Walk to Work", durationMin: 20, polyline: "poly1" }],
    });
    mockGetForecast.mockResolvedValue({ data: [fakeWeather()] });

    const result = await planJourney(baseInput);

    expect(result.kind).toBe("success");
    if (result.kind !== "success") return;
    expect(result.journey.legs).toHaveLength(1);
    expect(result.journey.legs[0].weather).toEqual(fakeWeather());
    expect(mockCreateJourney).toHaveBeenCalledWith(result.journey);
  });

  it("waypoints: interleaves an indoor dwell leg and samples each hop's own midpoint (regression: hop-index must not double-advance across the indoor leg)", async () => {
    mockComputeRoute.mockResolvedValue({
      data: [
        { mode: "walk", label: "Walk to Cafe", durationMin: 10, polyline: "hop0" },
        { mode: "walk", label: "Walk to Work", durationMin: 10, polyline: "hop1" },
      ],
    });
    mockGetForecast.mockImplementation(async (points: { lat: number; lng: number }[]) => ({
      data: points.map(() => fakeWeather()),
    }));

    const result = await planJourney({ ...baseInput, waypoints: [CAFE] });

    expect(result.kind).toBe("success");
    if (result.kind !== "success") return;
    expect(result.journey.legs.map((l) => l.mode)).toEqual(["walk", "indoor", "walk"]);

    // hop0 = Home->Cafe, hop1 = Cafe->Work — each outdoor leg's forecast
    // point must come from *its own* hop, not the same one twice (this is
    // exactly the bug the hopIndex rewrite above fixed: naively advancing
    // the hop counter across the indoor leg too would put the second
    // point at Cafe->Cafe or shift it out of range entirely).
    const [points] = mockGetForecast.mock.calls[0];
    expect(points).toHaveLength(2);
    const hop0Mid = { lat: (HOME.lat + CAFE.lat) / 2, lng: (HOME.lng + CAFE.lng) / 2 };
    const hop1Mid = { lat: (CAFE.lat + WORK.lat) / 2, lng: (CAFE.lng + WORK.lng) / 2 };
    expect(points[0].lat).toBeCloseTo(hop0Mid.lat, 6);
    expect(points[0].lng).toBeCloseTo(hop0Mid.lng, 6);
    expect(points[1].lat).toBeCloseTo(hop1Mid.lat, 6);
    expect(points[1].lng).toBeCloseTo(hop1Mid.lng, 6);
  });

  it("stamps annotation effects and puddle risk onto outdoor legs (§5.5)", async () => {
    // "_p~iF~ps|U" decodes to the single point (38.5, -120.2) — the
    // wind-tunnel annotation sits right on it.
    mockComputeRoute.mockResolvedValue({
      data: [{ mode: "walk", label: "Walk to Work", durationMin: 20, polyline: "_p~iF~ps|U" }],
    });
    mockGetForecast.mockResolvedValue({ data: [{ ...fakeWeather(), recentPrecipMm6h: 6 }] });
    mockListAnnotations.mockResolvedValue([
      {
        id: "wt",
        label: "Wind tunnel",
        effect: "wind-tunnel",
        lat: 38.5,
        lng: -120.2,
        radiusM: 100,
        createdAt: "2026-07-01T00:00:00.000Z",
      },
    ]);

    const result = await planJourney(baseInput);

    expect(result.kind).toBe("success");
    if (result.kind !== "success") return;
    const [leg] = result.journey.legs;
    expect(leg.windEffect).toBe("amplified");
    expect(leg.matchedAnnotationIds).toEqual(["wt"]);
    expect(leg.puddleRisk).toBe(true); // recentPrecipMm6h 6 >= PUDDLE_RISK_PRECIP_MM_6H (5)
  });

  it("weather failure degrades gracefully: legs still build, weather stays undefined", async () => {
    mockComputeRoute.mockResolvedValue({
      data: [{ mode: "walk", label: "Walk to Work", durationMin: 20, polyline: "poly1" }],
    });
    mockGetForecast.mockResolvedValue({ error: "unreachable" });

    const result = await planJourney(baseInput);

    expect(result.kind).toBe("success");
    if (result.kind !== "success") return;
    expect(result.journey.legs[0].weather).toBeUndefined();
  });

  it("route failure with no cached journey: returns failed", async () => {
    mockComputeRoute.mockResolvedValue({ error: "unreachable" });
    mockFindRecentJourneyBetween.mockResolvedValue(undefined);

    const result = await planJourney(baseInput);

    expect(result).toEqual({ kind: "failed" });
    expect(mockCreateJourney).not.toHaveBeenCalled();
  });

  it("route failure with a cached journey: reuses its leg structure and still fetches fresh weather", async () => {
    mockComputeRoute.mockResolvedValue({ error: "network" });
    mockFindRecentJourneyBetween.mockResolvedValue({
      id: "old-journey",
      origin: HOME,
      destination: WORK,
      departTime: "2026-06-01T08:00:00.000Z",
      legs: [
        {
          id: "old-leg",
          mode: "walk",
          label: "Walk to Work",
          durationMin: 20,
          startTime: "2026-06-01T08:00:00.000Z",
          outdoor: true,
          weather: fakeWeather(), // stale — must not leak into the rebuilt journey
        },
      ],
    });
    mockGetForecast.mockResolvedValue({ data: [fakeWeather()] });

    const result = await planJourney(baseInput);

    expect(result.kind).toBe("success-cached");
    if (result.kind !== "success-cached") return;
    expect(result.cachedFromDate).toBe("2026-06-01T08:00:00.000Z");
    expect(result.journey.legs).toHaveLength(1);
    expect(result.journey.legs[0].startTime).toBe(baseInput.departTime); // re-timed to the new departTime, not the cached one
    expect(result.journey.id).not.toBe("old-journey"); // a fresh journey, not a mutated old one
    expect(mockGetForecast).toHaveBeenCalled();
  });

  // Phase 7 (§5.6) — AT GTFS Realtime wiring.
  describe("live transit delay", () => {
    it("resizes the preceding wait leg from a live delay and stamps delayMinutes on the transit leg", async () => {
      mockComputeRoute.mockResolvedValue({
        data: [
          { mode: "walk", label: "Walk to stop", durationMin: 5, polyline: "walk1" },
          { mode: "bus", label: "Waiting for transit", durationMin: 5, polyline: "", isStationary: true, waitContext: "transit-stop" },
          {
            mode: "bus",
            label: "Bus to Britomart",
            durationMin: 10,
            polyline: "bus1",
            routeId: "70",
            stopId: "Queen St",
            scheduledDepartTime: "2026-07-20T08:10:00.000Z",
          },
        ],
      });
      mockGetForecast.mockResolvedValue({ data: [fakeWeather(), fakeWeather()] });
      mockGetRealtimeDelay.mockResolvedValue({ data: { delayMinutes: 12, stopType: "street-stop" } });

      const result = await planJourney({ ...baseInput, mode: "bus" });

      expect(result.kind).toBe("success");
      if (result.kind !== "success") return;
      expect(mockGetRealtimeDelay).toHaveBeenCalledWith({
        routeId: "70",
        stopId: "Queen St",
        scheduledDepartTime: "2026-07-20T08:10:00.000Z",
        mode: "bus",
      });
      const [, wait, transit] = result.journey.legs;
      expect(wait.durationMin).toBe(12);
      expect(wait.label).toBe("Waiting at Queen St — delay 12 min");
      expect(transit.delayMinutes).toBe(12);
    });

    it("inserts a wait leg when Google reported no gap but AT GTFS Realtime reports a delay", async () => {
      mockComputeRoute.mockResolvedValue({
        data: [
          {
            mode: "bus",
            label: "Bus to Britomart",
            durationMin: 10,
            polyline: "bus1",
            routeId: "70",
            stopId: "Queen St",
            scheduledDepartTime: "2026-07-20T08:10:00.000Z",
          },
        ],
      });
      mockGetForecast.mockResolvedValue({ data: [] });
      mockGetRealtimeDelay.mockResolvedValue({ data: { delayMinutes: 6, stopType: "platform" } });

      const result = await planJourney({ ...baseInput, mode: "bus" });

      expect(result.kind).toBe("success");
      if (result.kind !== "success") return;
      expect(result.journey.legs).toHaveLength(2);
      expect(result.journey.legs[0]).toMatchObject({ isStationary: true, durationMin: 6, waitContext: "transit-platform" });
      expect(result.journey.legs[1].delayMinutes).toBe(6);
    });

    it("falls back to a flat 5-minute wait when AT GTFS Realtime has no data and no wait leg already exists (§5.6 point 2)", async () => {
      mockComputeRoute.mockResolvedValue({
        data: [
          {
            mode: "bus",
            label: "Bus to Britomart",
            durationMin: 10,
            polyline: "bus1",
            routeId: "70",
            stopId: "Queen St",
            scheduledDepartTime: "2026-07-20T08:10:00.000Z",
          },
        ],
      });
      mockGetForecast.mockResolvedValue({ data: [] });
      mockGetRealtimeDelay.mockResolvedValue({ error: "unreachable" });

      const result = await planJourney({ ...baseInput, mode: "bus" });

      expect(result.kind).toBe("success");
      if (result.kind !== "success") return;
      expect(result.journey.legs).toHaveLength(2);
      expect(result.journey.legs[0]).toMatchObject({ isStationary: true, durationMin: 5, waitContext: "transit-stop" });
      expect(result.journey.legs[0].label).toBe("Waiting at Queen St — delay 5 min");
      expect(result.journey.legs[1].delayMinutes).toBeUndefined();
    });

    it("skips the lookup entirely when routing didn't return matchable route/stop ids", async () => {
      mockComputeRoute.mockResolvedValue({
        data: [{ mode: "bus", label: "Bus to Britomart", durationMin: 10, polyline: "bus1" }],
      });
      mockGetForecast.mockResolvedValue({ data: [] });

      const result = await planJourney({ ...baseInput, mode: "bus" });

      expect(result.kind).toBe("success");
      expect(mockGetRealtimeDelay).not.toHaveBeenCalled();
    });
  });
});
