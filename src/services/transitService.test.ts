import { getRealtimeDelay } from "./transitService";

const PARAMS = {
  routeId: "70",
  stopId: "Britomart",
  scheduledDepartTime: "2026-07-21T08:10:00.000Z",
  mode: "bus" as const,
};

describe("transitService.getRealtimeDelay", () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env.EXPO_PUBLIC_AT_SUBSCRIPTION_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.EXPO_PUBLIC_AT_SUBSCRIPTION_KEY = originalEnv;
  });

  it("returns { error: 'unreachable' } and never calls fetch when no subscription key is configured", async () => {
    delete process.env.EXPO_PUBLIC_AT_SUBSCRIPTION_KEY;
    global.fetch = jest.fn();

    const result = await getRealtimeDelay(PARAMS);

    expect(result).toEqual({ error: "unreachable" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns the matching stop_time_update's delay in minutes, rounded", async () => {
    process.env.EXPO_PUBLIC_AT_SUBSCRIPTION_KEY = "test-key";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        response: {
          entity: [
            {
              trip_update: {
                trip: { route_id: "70" },
                stop_time_update: [
                  { stop_id: "Some Other Stop", arrival: { delay: 600 } },
                  { stop_id: "Britomart", arrival: { delay: 725 } },
                ],
              },
            },
          ],
        },
      }),
    }) as unknown as typeof fetch;

    const result = await getRealtimeDelay(PARAMS);

    expect(result).toEqual({ data: { delayMinutes: 12, stopType: "street-stop" } });
  });

  it("infers a train's stop as a platform, a bus's as a street-stop", async () => {
    process.env.EXPO_PUBLIC_AT_SUBSCRIPTION_KEY = "test-key";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        response: {
          entity: [{ trip_update: { stop_time_update: [{ stop_id: "Britomart", arrival: { delay: 0 } }] } }],
        },
      }),
    }) as unknown as typeof fetch;

    const result = await getRealtimeDelay({ ...PARAMS, mode: "train" });

    expect(result).toEqual({ data: { delayMinutes: 0, stopType: "platform" } });
  });

  it("returns { error: 'unreachable' } when the feed has no matching stop_time_update", async () => {
    process.env.EXPO_PUBLIC_AT_SUBSCRIPTION_KEY = "test-key";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: { entity: [] } }),
    }) as unknown as typeof fetch;

    const result = await getRealtimeDelay(PARAMS);

    expect(result).toEqual({ error: "unreachable" });
  });

  it("maps a network error and rate-limit responses to the shared ServiceError shape", async () => {
    process.env.EXPO_PUBLIC_AT_SUBSCRIPTION_KEY = "test-key";

    global.fetch = jest.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch;
    expect(await getRealtimeDelay(PARAMS)).toEqual({ error: "network" });

    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 }) as unknown as typeof fetch;
    expect(await getRealtimeDelay(PARAMS)).toEqual({ error: "rate-limited" });
  });
});
