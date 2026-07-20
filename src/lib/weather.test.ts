import { classifyWeather, forecastConfidence } from "./weather";

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
