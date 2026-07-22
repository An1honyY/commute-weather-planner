import { computeRoute, hasRoutesApiKey } from "./routesService";

const HOME = { lat: -36.8485, lng: 174.7633, label: "Home" };
const WORK = { lat: -36.86, lng: 174.77, label: "Work" };

describe("routesService.computeRoute", () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env.EXPO_PUBLIC_GOOGLE_ROUTES_API_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.EXPO_PUBLIC_GOOGLE_ROUTES_API_KEY = originalEnv;
  });

  it("returns { error: 'unreachable' } and never calls fetch when no API key is configured", async () => {
    delete process.env.EXPO_PUBLIC_GOOGLE_ROUTES_API_KEY;
    global.fetch = jest.fn();

    const result = await computeRoute({ origin: HOME, destination: WORK, mode: "walk", departTime: "2026-07-20T08:00:00.000Z" });

    expect(result).toEqual({ error: "unreachable" });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(hasRoutesApiKey()).toBe(false);
  });

  it("walk: maps one Google leg per hop", async () => {
    process.env.EXPO_PUBLIC_GOOGLE_ROUTES_API_KEY = "test-key";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [
          {
            legs: [
              { duration: "600s", polyline: { encodedPolyline: "abc123" } },
            ],
          },
        ],
      }),
    }) as unknown as typeof fetch;

    const result = await computeRoute({ origin: HOME, destination: WORK, mode: "walk", departTime: "2026-07-20T08:00:00.000Z" });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data).toEqual([{ mode: "walk", label: "Walk to Work", durationMin: 10, polyline: "abc123" }]);
  });

  it("waypoints: one leg per hop, labeled against each stop in order", async () => {
    process.env.EXPO_PUBLIC_GOOGLE_ROUTES_API_KEY = "test-key";
    const CAFE = { lat: -36.855, lng: 174.765, label: "Cafe" };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [
          {
            legs: [
              { duration: "300s", polyline: { encodedPolyline: "leg1" } },
              { duration: "420s", polyline: { encodedPolyline: "leg2" } },
            ],
          },
        ],
      }),
    }) as unknown as typeof fetch;

    const result = await computeRoute({
      origin: HOME,
      destination: WORK,
      waypoints: [CAFE],
      mode: "cycle",
      departTime: "2026-07-20T08:00:00.000Z",
    });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.map((s) => s.label)).toEqual(["Cycle to Cafe", "Cycle to Work"]);
  });

  it("bus: expands transit steps into walk + wait + transit legs", async () => {
    process.env.EXPO_PUBLIC_GOOGLE_ROUTES_API_KEY = "test-key";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [
          {
            legs: [
              {
                steps: [
                  { travelMode: "WALK", staticDuration: "300s", polyline: { encodedPolyline: "walk1" } },
                  {
                    travelMode: "TRANSIT",
                    staticDuration: "600s",
                    polyline: { encodedPolyline: "bus1" },
                    transitDetails: {
                      stopDetails: {
                        departureTime: "2026-07-20T08:10:00.000Z", // 5 min after the walk step ends (08:05)
                        arrivalTime: "2026-07-20T08:20:00.000Z",
                        arrivalStop: { name: "Britomart" },
                        departureStop: { name: "Queen St" },
                      },
                      transitLine: { vehicle: { type: "BUS" }, nameShort: "70" },
                    },
                  },
                ],
              },
            ],
          },
        ],
      }),
    }) as unknown as typeof fetch;

    const result = await computeRoute({ origin: HOME, destination: WORK, mode: "bus", departTime: "2026-07-20T08:00:00.000Z" });

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.map((s) => ({ mode: s.mode, label: s.label, durationMin: s.durationMin, isStationary: s.isStationary }))).toEqual([
      { mode: "walk", label: "Walk to Queen St", durationMin: 5, isStationary: undefined },
      { mode: "bus", label: "Waiting for the 70", durationMin: 5, isStationary: true },
      { mode: "bus", label: "Bus to Britomart", durationMin: 10, isStationary: undefined },
    ]);

    // Phase 7 (§5.6) — the transit step itself carries best-effort AT GTFS
    // Realtime lookup keys; the walk/wait steps around it don't.
    const transitStep = result.data[2];
    expect(transitStep.routeId).toBe("70");
    expect(transitStep.stopId).toBe("Queen St");
    expect(transitStep.scheduledDepartTime).toBe("2026-07-20T08:10:00.000Z");
    expect(result.data[0].routeId).toBeUndefined();
  });

  it("omits intermediates for transit (Google 400s on transit waypoints), but sends them for other modes", async () => {
    process.env.EXPO_PUBLIC_GOOGLE_ROUTES_API_KEY = "test-key";
    const CAFE = { lat: -36.855, lng: 174.765, label: "Cafe" };
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ routes: [{ legs: [{ steps: [] }] }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await computeRoute({ origin: HOME, destination: WORK, waypoints: [CAFE], mode: "bus", departTime: "2026-07-20T08:00:00.000Z" });
    const transitBody = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(transitBody.travelMode).toBe("TRANSIT");
    expect(transitBody.intermediates).toEqual([]);

    await computeRoute({ origin: HOME, destination: WORK, waypoints: [CAFE], mode: "cycle", departTime: "2026-07-20T08:00:00.000Z" });
    const cycleBody = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
    expect(cycleBody.intermediates).toHaveLength(1);
  });

  it("maps a network error and non-2xx responses to the shared ServiceError shape", async () => {
    process.env.EXPO_PUBLIC_GOOGLE_ROUTES_API_KEY = "test-key";

    global.fetch = jest.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch;
    expect(await computeRoute({ origin: HOME, destination: WORK, mode: "walk", departTime: "2026-07-20T08:00:00.000Z" })).toEqual({
      error: "network",
    });

    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 }) as unknown as typeof fetch;
    expect(await computeRoute({ origin: HOME, destination: WORK, mode: "walk", departTime: "2026-07-20T08:00:00.000Z" })).toEqual({
      error: "rate-limited",
    });
  });
});
