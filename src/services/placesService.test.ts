import { autocompletePlaces, getPlaceLocation, hasPlacesApiKey, newSessionToken } from "./placesService";

describe("placesService", () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env.EXPO_PUBLIC_GOOGLE_ROUTES_API_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.EXPO_PUBLIC_GOOGLE_ROUTES_API_KEY = originalEnv;
  });

  it("returns { error: 'unreachable' } and never calls fetch when no API key is configured", async () => {
    delete process.env.EXPO_PUBLIC_GOOGLE_ROUTES_API_KEY;
    global.fetch = jest.fn();

    const result = await autocompletePlaces("Queen St", "session-1");

    expect(result).toEqual({ error: "unreachable" });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(hasPlacesApiKey()).toBe(false);
  });

  it("returns an empty list without calling fetch for blank input", async () => {
    process.env.EXPO_PUBLIC_GOOGLE_ROUTES_API_KEY = "test-key";
    global.fetch = jest.fn();

    const result = await autocompletePlaces("   ", "session-1");

    expect(result).toEqual({ data: [] });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("maps place predictions to suggestions", async () => {
    process.env.EXPO_PUBLIC_GOOGLE_ROUTES_API_KEY = "test-key";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        suggestions: [
          {
            placePrediction: {
              placeId: "abc123",
              structuredFormat: { mainText: { text: "Ponsonby" }, secondaryText: { text: "Auckland, New Zealand" } },
            },
          },
        ],
      }),
    }) as unknown as typeof fetch;

    const result = await autocompletePlaces("Ponsonby", "session-1");

    expect(result).toEqual({ data: [{ placeId: "abc123", primaryText: "Ponsonby", secondaryText: "Auckland, New Zealand" }] });
  });

  it("maps a rate-limited response to { error: 'rate-limited' }", async () => {
    process.env.EXPO_PUBLIC_GOOGLE_ROUTES_API_KEY = "test-key";
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 }) as unknown as typeof fetch;

    const result = await autocompletePlaces("Ponsonby", "session-1");

    expect(result).toEqual({ error: "rate-limited" });
  });

  it("getPlaceLocation resolves lat/lng from place details", async () => {
    process.env.EXPO_PUBLIC_GOOGLE_ROUTES_API_KEY = "test-key";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ location: { latitude: -36.85, longitude: 174.75 }, formattedAddress: "Ponsonby, Auckland" }),
    }) as unknown as typeof fetch;

    const result = await getPlaceLocation("abc123", "session-1");

    expect(result).toEqual({ data: { lat: -36.85, lng: 174.75, formattedAddress: "Ponsonby, Auckland" } });
  });

  it("getPlaceLocation returns { error: 'unreachable' } when no key is configured", async () => {
    delete process.env.EXPO_PUBLIC_GOOGLE_ROUTES_API_KEY;
    global.fetch = jest.fn();

    const result = await getPlaceLocation("abc123", "session-1");

    expect(result).toEqual({ error: "unreachable" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("newSessionToken returns a v4-shaped UUID and a fresh one each call", () => {
    const a = newSessionToken();
    const b = newSessionToken();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toEqual(b);
  });
});
