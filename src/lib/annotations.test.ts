import { applyAnnotationsToLegs, decodePolyline, distanceMeters, matchAnnotationsToPoints } from "./annotations";
import type { EnvironmentAnnotation, JourneyLeg } from "../types";

// Minimal encoder (inverse of decodePolyline) so tests can build legs with
// real encoded polylines instead of hand-computed strings.
function encodePolyline(points: { lat: number; lng: number }[]): string {
  let out = "";
  let prevLat = 0;
  let prevLng = 0;
  for (const p of points) {
    for (const [value, prev] of [
      [Math.round(p.lat * 1e5), prevLat],
      [Math.round(p.lng * 1e5), prevLng],
    ] as const) {
      let delta = value - prev;
      delta = delta < 0 ? ~(delta << 1) : delta << 1;
      while (delta >= 0x20) {
        out += String.fromCharCode((0x20 | (delta & 0x1f)) + 63);
        delta >>= 5;
      }
      out += String.fromCharCode(delta + 63);
    }
    prevLat = Math.round(p.lat * 1e5);
    prevLng = Math.round(p.lng * 1e5);
  }
  return out;
}

function annotation(overrides: Partial<EnvironmentAnnotation>): EnvironmentAnnotation {
  return {
    id: "a1",
    label: "Test spot",
    effect: "wind-tunnel",
    lat: -36.8485,
    lng: 174.7633,
    radiusM: 100,
    createdAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("decodePolyline", () => {
  it("decodes Google's documented example", () => {
    const points = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    expect(points).toEqual([
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ]);
  });

  it("round-trips through the test encoder", () => {
    const original = [
      { lat: -36.8485, lng: 174.7633 },
      { lat: -36.8501, lng: 174.7658 },
    ];
    expect(decodePolyline(encodePolyline(original))).toEqual(original);
  });
});

describe("distanceMeters", () => {
  it("measures ~111m for 0.001° of latitude", () => {
    const d = distanceMeters({ lat: -36.8485, lng: 174.7633 }, { lat: -36.8475, lng: 174.7633 });
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(117);
  });
});

describe("matchAnnotationsToPoints", () => {
  const queenSt = { lat: -36.8485, lng: 174.7633 };
  // ~111m north of queenSt — outside a 100m radius, inside a 150m one.
  const nearby = { lat: -36.8475, lng: 174.7633 };

  it("matches an annotation within radius and records its id", () => {
    const stamps = matchAnnotationsToPoints([queenSt], [annotation({ effect: "wind-tunnel" })]);
    expect(stamps.windEffect).toBe("amplified");
    expect(stamps.matchedAnnotationIds).toEqual(["a1"]);
  });

  it("ignores an annotation outside its radius", () => {
    const stamps = matchAnnotationsToPoints([nearby], [annotation({ radiusM: 100 })]);
    expect(stamps).toEqual({});
  });

  it("applies same-category duplicates once but records all ids", () => {
    const stamps = matchAnnotationsToPoints(
      [queenSt],
      [annotation({ id: "a1" }), annotation({ id: "a2" })]
    );
    expect(stamps.windEffect).toBe("amplified");
    expect(stamps.matchedAnnotationIds).toEqual(expect.arrayContaining(["a1", "a2"]));
  });

  it("resolves a same-category conflict to the closer annotation, keeping both ids", () => {
    const stamps = matchAnnotationsToPoints(
      [queenSt],
      [
        annotation({ id: "far-shaded", effect: "shaded", lat: nearby.lat, radiusM: 150 }),
        annotation({ id: "near-sun", effect: "sun-exposed", radiusM: 150 }),
      ]
    );
    expect(stamps.sunEffect).toBe("exposed");
    expect(stamps.matchedAnnotationIds).toEqual(expect.arrayContaining(["far-shaded", "near-sun"]));
  });

  it("composes high-reflection additively with sun-exposed", () => {
    const stamps = matchAnnotationsToPoints(
      [queenSt],
      [
        annotation({ id: "sun", effect: "sun-exposed" }),
        annotation({ id: "reflect", effect: "high-reflection" }),
      ]
    );
    expect(stamps.sunEffect).toBe("exposed");
    expect(stamps.highReflection).toBe(true);
  });

  it("stamps rainCovered for a rain-cover annotation", () => {
    const stamps = matchAnnotationsToPoints([queenSt], [annotation({ effect: "rain-cover" })]);
    expect(stamps.rainCovered).toBe(true);
    expect(stamps.windEffect).toBeUndefined();
  });
});

describe("applyAnnotationsToLegs", () => {
  const baseLeg: JourneyLeg = {
    id: "l1",
    mode: "walk",
    label: "Walk down Queen St",
    durationMin: 10,
    startTime: "2026-07-21T08:00:00.000Z",
    outdoor: true,
    polyline: encodePolyline([
      { lat: -36.8485, lng: 174.7633 },
      { lat: -36.8501, lng: 174.7658 },
    ]),
  };

  it("stamps outdoor legs whose polyline passes through an annotation", () => {
    const [leg] = applyAnnotationsToLegs([baseLeg], [annotation({ effect: "wind-tunnel" })]);
    expect(leg.windEffect).toBe("amplified");
    expect(leg.matchedAnnotationIds).toEqual(["a1"]);
  });

  it("leaves indoor and polyline-less legs untouched", () => {
    const indoor: JourneyLeg = { ...baseLeg, id: "l2", mode: "indoor", outdoor: false, polyline: undefined };
    const [leg] = applyAnnotationsToLegs([indoor], [annotation({})]);
    expect(leg).toBe(indoor);
  });

  it("clears stale stamps when a re-run no longer matches", () => {
    const stale: JourneyLeg = { ...baseLeg, windEffect: "amplified", matchedAnnotationIds: ["gone"] };
    const [leg] = applyAnnotationsToLegs([stale], []);
    expect(leg.windEffect).toBeUndefined();
    expect(leg.matchedAnnotationIds).toBeUndefined();
  });
});
