import { acFeelsCold, classifyWeather, forecastConfidence, getSeason, rainIntensityBucket, resolveWeatherMood } from "./weather";
import type { Journey, JourneyLeg } from "../types";

// docs/11-testing-strategy.md §11.1 — table-driven over the full WMO code
// range including the boundary codes (45/48, 51, 61, 95), the mm > 4
// branch inside the rain case, and the windKph > 25 branch.
describe("classifyWeather", () => {
  const cases: [code: number, mm: number, windKph: number, label: string, severity: number][] = [
    [0, 0, 10, "Dry", 0],
    [2, 0, 10, "Dry", 0],
    [3, 0, 10, "Overcast", 0],
    [3, 0, 30, "Overcast", 0], // code takes priority over the windy check below it
    [10, 0, 26, "Windy", 1],
    [10, 0, 25, "Dry", 0], // boundary: windKph > 25, not >=
    [44, 0, 10, "Dry", 0],
    [45, 0, 10, "Foggy", 1],
    [48, 0, 10, "Foggy", 1],
    [49, 0, 10, "Dry", 0],
    [50, 0, 10, "Dry", 0],
    [51, 0, 10, "Light rain", 1],
    [60, 0, 10, "Light rain", 1],
    [61, 2, 10, "Rain", 2],
    [61, 4, 10, "Rain", 2], // boundary: mm > 4, not >=
    [61, 5, 10, "Heavy rain", 3],
    [94, 5, 10, "Heavy rain", 3],
    [95, 0, 10, "Stormy", 4],
    [99, 100, 100, "Stormy", 4],
  ];

  it.each(cases)("code=%s mm=%s wind=%s -> %s (severity %s)", (code, mm, windKph, label, severity) => {
    const result = classifyWeather(code, mm, windKph);
    expect(result.label).toBe(label);
    expect(result.severity).toBe(severity);
  });
});

// §6/§9.5 — the hourly rain-intensity gauge's bucket boundaries.
describe("rainIntensityBucket", () => {
  it.each([
    [0, 19, "none"], // below the probability gate regardless of mm
    [10, 19, "none"],
    [0, 20, "low"], // at the probability boundary, mm below 0.5
    [0.4, 20, "low"],
    [0.5, 20, "med"], // mm boundary: < 0.5, not <=
    [4, 20, "med"],
    [4.01, 20, "high"], // mm boundary: <= 4, not <
    [10, 100, "high"],
  ] as const)("mm=%s probability=%s -> %s", (mm, probability, expected) => {
    expect(rainIntensityBucket(mm, probability)).toBe(expected);
  });
});

// docs/11-testing-strategy.md §11.1 — the three lead-time buckets and their
// boundaries (48h, 120h).
describe("forecastConfidence", () => {
  const fetchedAt = "2026-07-20T00:00:00.000Z";

  it("high: at or under 48h lead time", () => {
    expect(forecastConfidence("2026-07-22T00:00:00.000Z", fetchedAt)).toBe("high"); // exactly 48h
    expect(forecastConfidence("2026-07-20T01:00:00.000Z", fetchedAt)).toBe("high");
  });

  it("medium: over 48h and at/under 120h", () => {
    expect(forecastConfidence("2026-07-22T00:00:00.001Z", fetchedAt)).toBe("medium"); // just over 48h
    expect(forecastConfidence("2026-07-25T00:00:00.000Z", fetchedAt)).toBe("medium"); // exactly 120h
  });

  it("low: over 120h", () => {
    expect(forecastConfidence("2026-07-25T00:00:00.001Z", fetchedAt)).toBe("low");
    expect(forecastConfidence("2026-08-01T00:00:00.000Z", fetchedAt)).toBe("low");
  });
});

// docs/11-testing-strategy.md §11.1 — boundary months (Nov→Dec, Feb→Mar,
// May→Jun, Aug→Sep).
describe("getSeason", () => {
  it.each([
    ["2026-11-30T00:00:00.000Z", "shoulder"],
    ["2026-12-01T00:00:00.000Z", "summer"],
    ["2027-02-28T00:00:00.000Z", "summer"],
    ["2027-03-01T00:00:00.000Z", "shoulder"],
    ["2027-05-31T00:00:00.000Z", "shoulder"],
    ["2027-06-01T00:00:00.000Z", "winter"],
    ["2027-08-31T00:00:00.000Z", "winter"],
    ["2027-09-01T00:00:00.000Z", "shoulder"],
  ] as const)("%s -> %s", (iso, season) => {
    expect(getSeason(iso)).toBe(season);
  });
});

// docs/11-testing-strategy.md §11.1 — the three season × hasWarmOutdoor
// combinations (only summer + warm triggers the contrast).
describe("acFeelsCold", () => {
  const acLeg: JourneyLeg = {
    id: "1",
    mode: "bus",
    label: "Bus",
    durationMin: 10,
    startTime: "2026-01-01T00:00:00.000Z",
    outdoor: false,
    climate: "ac",
  };
  const journeyWithAc: Journey = {
    id: "j",
    origin: { id: "o", label: "O", address: "", lat: 0, lng: 0 },
    destination: { id: "d", label: "D", address: "", lat: 0, lng: 0 },
    departTime: "2026-01-01T00:00:00.000Z",
    legs: [acLeg],
  };

  it("summer + warm outdoor -> true", () => {
    expect(acFeelsCold(journeyWithAc, "summer", true)).toBe(true);
  });

  it("summer + not warm outdoor -> false", () => {
    expect(acFeelsCold(journeyWithAc, "summer", false)).toBe(false);
  });

  it("winter + warm outdoor -> false (winter AC is neutral)", () => {
    expect(acFeelsCold(journeyWithAc, "winter", true)).toBe(false);
  });

  it("shoulder + warm outdoor -> false", () => {
    expect(acFeelsCold(journeyWithAc, "shoulder", true)).toBe(false);
  });

  it("no AC leg at all -> false regardless of season/warmth", () => {
    const journeyNoAc: Journey = { ...journeyWithAc, legs: [{ ...acLeg, climate: "heated" }] };
    expect(acFeelsCold(journeyNoAc, "summer", true)).toBe(false);
  });
});

// docs/09-design-system.md §9.1 (2026-07-21) — Today tab's weather-reactive
// tint, boundary cases at COLD_MOOD_MAX_C/WARM_MOOD_MIN_C independently from
// the severity gates.
describe("resolveWeatherMood", () => {
  it("at/below the cold boundary -> cold, regardless of severity", () => {
    expect(resolveWeatherMood(8, 0)).toBe("cold");
    expect(resolveWeatherMood(4, 0)).toBe("cold");
  });

  it("just above the cold boundary with low severity -> mild", () => {
    expect(resolveWeatherMood(9, 0)).toBe("mild");
  });

  it("heavy rain or storm forces cold even on a mild-temperature day", () => {
    expect(resolveWeatherMood(15, 3)).toBe("cold");
    expect(resolveWeatherMood(15, 4)).toBe("cold");
  });

  it("rain (severity 2) does not force cold on its own", () => {
    expect(resolveWeatherMood(15, 2)).toBe("mild");
  });

  it("at/above the warm boundary with low severity -> warm", () => {
    expect(resolveWeatherMood(22, 0)).toBe("warm");
    expect(resolveWeatherMood(28, 1)).toBe("warm");
  });

  it("just below the warm boundary -> mild", () => {
    expect(resolveWeatherMood(21, 0)).toBe("mild");
  });

  it("warm temperature but rainy (severity >= 2) stays mild, not warm", () => {
    expect(resolveWeatherMood(25, 2)).toBe("mild");
  });

  it("a mid-range temperature with ordinary conditions -> mild", () => {
    expect(resolveWeatherMood(15, 1)).toBe("mild");
  });
});
