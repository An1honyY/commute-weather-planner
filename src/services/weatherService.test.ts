import { getForecast, getHourlyForecast } from "./weatherService";

function mockOpenMeteoResponse(pointCount: number) {
  const hours = Array.from({ length: 24 }, (_, i) => `2026-07-20T${String(i).padStart(2, "0")}:00`);
  const location = {
    hourly: {
      time: hours,
      temperature_2m: hours.map((_, i) => 10 + i),
      weather_code: hours.map(() => 61),
      precipitation: hours.map(() => 2),
      precipitation_probability: hours.map(() => 80),
      apparent_temperature: hours.map((_, i) => 8 + i),
      wind_speed_10m: hours.map(() => 12),
      wind_gusts_10m: hours.map(() => 20),
      relative_humidity_2m: hours.map(() => 75),
      uv_index: hours.map(() => 3),
      is_day: hours.map((_, i) => (i >= 6 && i <= 18 ? 1 : 0)),
    },
  };
  return pointCount === 1 ? location : Array.from({ length: pointCount }, () => location);
}

describe("weatherService.getForecast", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns an empty array without calling fetch when given no points", async () => {
    global.fetch = jest.fn();
    const result = await getForecast([]);
    expect(result).toEqual({ data: [] });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("picks the nearest hourly reading for each point and maps every field", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockOpenMeteoResponse(2),
    }) as unknown as typeof fetch;

    const result = await getForecast([
      { lat: -36.8485, lng: 174.7633, time: "2026-07-20T09:05:00.000Z" }, // nearest hour: 09:00 (index 9)
      { lat: -36.86, lng: 174.77, time: "2026-07-20T14:40:00.000Z" }, // nearest hour: 15:00 (index 15)
    ]);

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toMatchObject({
      tempC: 19, // 10 + 9
      apparentTempC: 17, // 8 + 9
      weatherCode: 61,
      precipMm: 2,
      windGustKph: 20,
      isDaylight: true,
    });
    expect(result.data[1]).toMatchObject({ tempC: 25, apparentTempC: 23 }); // 10+15, 8+15
  });

  it("requests past_days=1 and sums the 6 hours before now into recentPrecipMm6h", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-20T12:30:00.000Z"));
    try {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockOpenMeteoResponse(1),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await getForecast([{ lat: -36.8485, lng: 174.7633, time: "2026-07-20T15:00:00.000Z" }]);

      expect(fetchMock.mock.calls[0][0]).toContain("past_days=1");
      expect("data" in result).toBe(true);
      if (!("data" in result)) return;
      // Window (06:30, 12:30] covers the 07:00–12:00 readings — 6 × 2mm.
      expect(result.data[0].recentPrecipMm6h).toBe(12);
    } finally {
      jest.useRealTimers();
    }
  });

  it("maps a network error to { error: 'network' }", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch;
    const result = await getForecast([{ lat: 0, lng: 0, time: "2026-07-20T00:00:00.000Z" }]);
    expect(result).toEqual({ error: "network" });
  });

  it("maps a 429 response to { error: 'rate-limited' } and other non-2xx to 'unreachable'", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 }) as unknown as typeof fetch;
    expect(await getForecast([{ lat: 0, lng: 0, time: "2026-07-20T00:00:00.000Z" }])).toEqual({
      error: "rate-limited",
    });

    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;
    expect(await getForecast([{ lat: 0, lng: 0, time: "2026-07-20T00:00:00.000Z" }])).toEqual({
      error: "unreachable",
    });
  });
});

// §9.5 — the hourly strip's data source, a single-location read of the
// same Open-Meteo hourly response getForecast() already reads.
describe("weatherService.getHourlyForecast", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("starts at the first hour >= fromIso and returns exactly `hours` readings", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockOpenMeteoResponse(1),
    }) as unknown as typeof fetch;

    const result = await getHourlyForecast({ lat: -36.8485, lng: 174.7633 }, "2026-07-20T09:05:00.000Z", 3);

    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.map((r) => r.time)).toEqual([
      "2026-07-20T10:00Z",
      "2026-07-20T11:00Z",
      "2026-07-20T12:00Z",
    ]);
  });

  it("derives each hour's rainIntensity bucket from that hour's precip/probability", async () => {
    const hours = ["2026-07-20T00:00", "2026-07-20T01:00", "2026-07-20T02:00", "2026-07-20T03:00"];
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        hourly: {
          time: hours,
          temperature_2m: hours.map(() => 15),
          weather_code: hours.map(() => 61),
          precipitation: [0, 0.2, 2, 5],
          precipitation_probability: [10, 30, 80, 90], // first hour fails the probability gate entirely
          apparent_temperature: hours.map(() => 14),
          wind_speed_10m: hours.map(() => 10),
          wind_gusts_10m: hours.map(() => 15),
          relative_humidity_2m: hours.map(() => 70),
          uv_index: hours.map(() => 2),
          is_day: hours.map(() => 1),
        },
      }),
    }) as unknown as typeof fetch;

    const result = await getHourlyForecast({ lat: 0, lng: 0 }, "2026-07-20T00:00:00.000Z", 4);
    expect("data" in result).toBe(true);
    if (!("data" in result)) return;
    expect(result.data.map((r) => r.rainIntensity)).toEqual(["none", "low", "med", "high"]);
  });

  it("returns an empty array when every hourly entry is before fromIso", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockOpenMeteoResponse(1),
    }) as unknown as typeof fetch;

    const result = await getHourlyForecast({ lat: 0, lng: 0 }, "2026-07-21T00:00:00.000Z", 3);
    expect(result).toEqual({ data: [] });
  });

  it("maps a network error to { error: 'network' }", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch;
    const result = await getHourlyForecast({ lat: 0, lng: 0 }, "2026-07-20T00:00:00.000Z", 3);
    expect(result).toEqual({ error: "network" });
  });
});
