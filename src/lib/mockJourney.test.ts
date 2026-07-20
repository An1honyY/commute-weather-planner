import { buildMockJourney } from "./mockJourney";
import type { SavedLocation } from "../types";

const HOME: SavedLocation = { id: "home", label: "Home", address: "1 Home St", lat: -36.8485, lng: 174.7633 };
const WORK: SavedLocation = { id: "work", label: "Work", address: "2 Work St", lat: -36.86, lng: 174.77 };
const CAFE: SavedLocation = {
  id: "cafe",
  label: "Cafe",
  address: "3 Cafe St",
  lat: -36.855,
  lng: 174.765,
  hasReliableClimateControl: false,
};

describe("buildMockJourney", () => {
  it("walk: produces a single outdoor leg", () => {
    const journey = buildMockJourney({
      origin: HOME,
      destination: WORK,
      waypoints: [],
      departTime: "2026-07-20T08:00:00.000Z",
      mode: "walk",
      formal: false,
      carryPreference: "no-preference",
    });

    expect(journey.legs).toHaveLength(1);
    expect(journey.legs[0]).toMatchObject({ mode: "walk", outdoor: true });
    expect(journey.legs[0].weather).toBeDefined();
  });

  it("bus: expands to walk-to-stop + stationary wait + the transit leg", () => {
    const journey = buildMockJourney({
      origin: HOME,
      destination: WORK,
      waypoints: [],
      departTime: "2026-07-20T08:00:00.000Z",
      mode: "bus",
      formal: false,
      carryPreference: "no-preference",
    });

    expect(journey.legs.map((l) => l.mode)).toEqual(["walk", "bus", "bus"]);
    expect(journey.legs[1].isStationary).toBe(true);
    expect(journey.legs[2].isStationary).toBeUndefined();
    expect(journey.legs[2].outdoor).toBe(false);
    expect(journey.legs[2].climate).toBe("ac");
  });

  it("drive: a single non-outdoor leg (enclosed in the vehicle)", () => {
    const journey = buildMockJourney({
      origin: HOME,
      destination: WORK,
      waypoints: [],
      departTime: "2026-07-20T08:00:00.000Z",
      mode: "drive",
      formal: false,
      carryPreference: "no-preference",
    });

    expect(journey.legs).toHaveLength(1);
    expect(journey.legs[0]).toMatchObject({ mode: "drive", outdoor: false, climate: "heated" });
  });

  it("waypoints: inserts an indoor dwell leg per stop, honoring hasReliableClimateControl", () => {
    const journey = buildMockJourney({
      origin: HOME,
      destination: WORK,
      waypoints: [CAFE],
      departTime: "2026-07-20T08:00:00.000Z",
      mode: "walk",
      formal: false,
      carryPreference: "no-preference",
    });

    // walk to cafe, indoor dwell at cafe, walk to work
    expect(journey.legs.map((l) => l.mode)).toEqual(["walk", "indoor", "walk"]);
    expect(journey.legs[1]).toMatchObject({ climate: "unconditioned" }); // CAFE.hasReliableClimateControl === false
    expect(journey.waypoints).toEqual([CAFE]);
  });

  it("legs are sequenced in time with no overlap", () => {
    const journey = buildMockJourney({
      origin: HOME,
      destination: WORK,
      waypoints: [CAFE],
      departTime: "2026-07-20T08:00:00.000Z",
      mode: "bus",
      formal: false,
      carryPreference: "no-preference",
    });

    for (let i = 1; i < journey.legs.length; i++) {
      const prevEnd = new Date(journey.legs[i - 1].startTime).getTime() + journey.legs[i - 1].durationMin * 60_000;
      expect(new Date(journey.legs[i].startTime).getTime()).toBe(prevEnd);
    }
  });
});
