import { dayLabel, groupJourneysByDay } from "./historyGrouping";
import type { Journey, SavedLocation } from "../types";

const home: SavedLocation = { id: "home", label: "Home", address: "1 Home St", lat: -36.8485, lng: 174.7633 };
const work: SavedLocation = { id: "work", label: "Work", address: "2 Work St", lat: -36.86, lng: 174.77 };

function journey(id: string, departTime: string): Journey {
  return { id, origin: home, destination: work, departTime, legs: [] };
}

// Built from local-time components (not UTC "Z" strings) so the day
// boundaries this test asserts on don't depend on the machine's timezone.
const NOW_MS = new Date(2026, 6, 21, 18, 0, 0).getTime(); // 21 Jul 2026, local afternoon

describe("dayLabel", () => {
  it("labels the same calendar day as Today", () => {
    expect(dayLabel(new Date(2026, 6, 21, 8, 0, 0).toISOString(), NOW_MS)).toBe("Today");
  });

  it("labels the previous calendar day as Yesterday", () => {
    expect(dayLabel(new Date(2026, 6, 20, 8, 0, 0).toISOString(), NOW_MS)).toBe("Yesterday");
  });

  it("falls back to a full date further back", () => {
    const label = dayLabel(new Date(2026, 6, 10, 8, 0, 0).toISOString(), NOW_MS);
    expect(label).not.toBe("Today");
    expect(label).not.toBe("Yesterday");
    expect(label).toContain("Jul");
  });
});

describe("groupJourneysByDay", () => {
  it("groups consecutive same-day journeys under one section, preserving order", () => {
    const journeys = [
      journey("a", new Date(2026, 6, 21, 8, 0, 0).toISOString()),
      journey("b", new Date(2026, 6, 21, 18, 0, 0).toISOString()),
      journey("c", new Date(2026, 6, 20, 8, 0, 0).toISOString()),
    ];
    const sections = groupJourneysByDay(journeys, NOW_MS);
    expect(sections).toHaveLength(2);
    expect(sections[0]).toEqual({ title: "Today", data: [journeys[0], journeys[1]] });
    expect(sections[1]).toEqual({ title: "Yesterday", data: [journeys[2]] });
  });

  it("returns an empty list for no journeys", () => {
    expect(groupJourneysByDay([], NOW_MS)).toEqual([]);
  });
});
