import { materializeTodaysJourneys } from "./materializeToday";
import { listJourneysOnDate, listRecurringTemplates } from "../db/repositories/journeys";
import { planJourney } from "./planJourney";
import type { Journey, SavedLocation } from "../types";

jest.mock("../db/repositories/journeys", () => ({
  listJourneysOnDate: jest.fn(),
  listRecurringTemplates: jest.fn(),
}));
jest.mock("./planJourney", () => ({ planJourney: jest.fn() }));

const mockListJourneysOnDate = listJourneysOnDate as jest.Mock;
const mockListRecurringTemplates = listRecurringTemplates as jest.Mock;
const mockPlanJourney = planJourney as jest.Mock;

const HOME: SavedLocation = { id: "home", label: "Home", address: "1 Home St", lat: -36.8485, lng: 174.7633 };
const WORK: SavedLocation = { id: "work", label: "Work", address: "2 Work St", lat: -36.86, lng: 174.77 };

// A Tuesday, so daysOfWeek: [2] templates are due.
const TUESDAY = new Date("2026-07-21T00:00:00.000Z");

function template(overrides: Partial<Journey> = {}): Journey {
  return {
    id: "template-1",
    origin: HOME,
    destination: WORK,
    departTime: "2026-06-01T08:00:00.000Z",
    legs: [{ id: "l1", mode: "walk", label: "Walk to Work", durationMin: 20, startTime: "2026-06-01T08:00:00.000Z", outdoor: true }],
    recurrence: { daysOfWeek: [2], departTimeOfDay: "08:00", active: true },
    ...overrides,
  };
}

describe("materializeTodaysJourneys", () => {
  beforeEach(() => jest.clearAllMocks());

  it("materializes a due template that hasn't been planned yet today", async () => {
    mockListRecurringTemplates.mockResolvedValue([template()]);
    mockListJourneysOnDate.mockResolvedValue([]);
    const newOccurrence: Journey = { ...template(), id: "occurrence-1", templateId: "template-1", recurrence: undefined };
    mockPlanJourney.mockResolvedValue({ kind: "success", journey: newOccurrence });

    const result = await materializeTodaysJourneys(TUESDAY);

    // departTimeOfDay is documented as local time (types/index.ts's
    // RecurrenceRule comment), so the expected instant is TZ-dependent —
    // compute it the same way rather than hardcoding a UTC string.
    const expectedDepartTime = new Date(2026, 6, 21, 8, 0).toISOString();
    expect(mockPlanJourney).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: "template-1", mode: "walk", departTime: expectedDepartTime })
    );
    expect(result).toEqual([newOccurrence]);
  });

  it("reuses an already-materialized occurrence instead of re-planning", async () => {
    mockListRecurringTemplates.mockResolvedValue([template()]);
    const existing: Journey = { ...template(), id: "occurrence-1", templateId: "template-1", recurrence: undefined, departTime: "2026-07-21T08:00:00.000Z" };
    mockListJourneysOnDate.mockResolvedValue([existing]);

    const result = await materializeTodaysJourneys(TUESDAY);

    expect(mockPlanJourney).not.toHaveBeenCalled();
    expect(result).toEqual([existing]);
  });

  it("skips a template not due today (wrong day of week)", async () => {
    mockListRecurringTemplates.mockResolvedValue([template({ recurrence: { daysOfWeek: [1], departTimeOfDay: "08:00", active: true } })]);
    mockListJourneysOnDate.mockResolvedValue([]);

    const result = await materializeTodaysJourneys(TUESDAY);

    expect(mockPlanJourney).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it("skips an inactive template even if the day matches", async () => {
    mockListRecurringTemplates.mockResolvedValue([template({ recurrence: { daysOfWeek: [2], departTimeOfDay: "08:00", active: false } })]);
    mockListJourneysOnDate.mockResolvedValue([]);

    const result = await materializeTodaysJourneys(TUESDAY);

    expect(mockPlanJourney).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it("includes one-off journeys planned directly for today, sorted alongside materialized ones by departTime", async () => {
    mockListRecurringTemplates.mockResolvedValue([]);
    const oneOffEarly: Journey = { ...template(), id: "one-off-1", recurrence: undefined, departTime: "2026-07-21T06:00:00.000Z" };
    const oneOffLate: Journey = { ...template(), id: "one-off-2", recurrence: undefined, departTime: "2026-07-21T18:00:00.000Z" };
    mockListJourneysOnDate.mockResolvedValue([oneOffLate, oneOffEarly]);

    const result = await materializeTodaysJourneys(TUESDAY);

    expect(result.map((j) => j.id)).toEqual(["one-off-1", "one-off-2"]);
  });

  it("drops a template whose materialization failed rather than throwing", async () => {
    mockListRecurringTemplates.mockResolvedValue([template()]);
    mockListJourneysOnDate.mockResolvedValue([]);
    mockPlanJourney.mockResolvedValue({ kind: "failed" });

    const result = await materializeTodaysJourneys(TUESDAY);

    expect(result).toEqual([]);
  });
});
